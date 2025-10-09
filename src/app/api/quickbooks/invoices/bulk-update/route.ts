import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
import {
  getAuthToken,
  updateInvoice,
  updateLineItemAmounts,
  calculateAmountDistribution,
} from '@/lib/quickbooks/qb-service'
import type { QBReconciliation, QBStoredInvoice } from '@/lib/quickbooks/types'

type UpdateResult = {
  id: string
  qb_id: string
  success: boolean
  new_amount?: number
  error?: string
}

/**
 * PATCH /api/quickbooks/invoices/bulk-update
 * Update one or more QB invoices to match the LT amount from reconciliation
 */
export async function PATCH(request: NextRequest) {
  try {
    const { reconciliation_id, invoice_ids, lt_amount } = await request.json()

    // Validation
    if (!reconciliation_id || !invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: reconciliation_id, invoice_ids' }, { status: 400 })
    }

    if (!lt_amount || typeof lt_amount !== 'number') {
      return NextResponse.json({ error: 'Invalid lt_amount' }, { status: 400 })
    }

    const supabase = createSupabaseServiceRoleClient()

    // Fetch reconciliation record
    const { data: recon, error: reconError } = await supabase
      .schema('integration')
      .from('qb_reconciliation')
      .select('*')
      .eq('id', reconciliation_id)
      .single()

    if (reconError || !recon) {
      return NextResponse.json({ error: 'Reconciliation record not found' }, { status: 404 })
    }

    const reconciliation = recon as QBReconciliation

    // Validate status - should be amount_mismatch
    if (reconciliation.match_status !== 'amount_mismatch') {
      return NextResponse.json(
        {
          error: `Cannot update invoices for match_status '${reconciliation.match_status}'. Expected 'amount_mismatch'.`,
        },
        { status: 400 }
      )
    }

    // Fetch QB invoices to update
    const { data: qbInvoices, error: invoicesError } = await supabase
      .schema('quickbooks')
      .from('qb_invoices')
      .select('*')
      .in('id', invoice_ids)

    if (invoicesError || !qbInvoices || qbInvoices.length === 0) {
      return NextResponse.json({ error: 'QB invoices not found' }, { status: 404 })
    }

    const invoices = qbInvoices as QBStoredInvoice[]

    // Verify all invoices are from same realm
    const realmIds = [...new Set(invoices.map((inv) => inv.realm_id))]
    if (realmIds.length > 1) {
      return NextResponse.json({ error: 'All invoices must be from the same QuickBooks company' }, { status: 400 })
    }

    const realmId = realmIds[0]

    // Get auth token
    const token = await getAuthToken(realmId)
    if (!token) {
      return NextResponse.json({ error: 'QuickBooks authentication failed' }, { status: 401 })
    }

    // Calculate distribution
    const currentAmounts = invoices.map((inv) => parseFloat(inv.total_amt))
    const distribution = calculateAmountDistribution(lt_amount, currentAmounts)

    console.log('[bulk-update] Distribution:', { currentAmounts, distribution, targetAmount: lt_amount })

    // Update each invoice
    const results: UpdateResult[] = []

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i]
      const newAmount = distribution[i]
      const oldAmount = parseFloat(invoice.total_amt)

      try {
        // Skip if amount is already correct
        if (Math.abs(oldAmount - newAmount) < 0.01) {
          console.log(`[bulk-update] Invoice ${invoice.qb_id} already has correct amount, skipping`)
          results.push({
            id: invoice.id,
            qb_id: invoice.qb_id,
            success: true,
            new_amount: newAmount,
          })
          continue
        }

        // Update line items with new amount
        const updatedLineItems = updateLineItemAmounts(invoice.line_items || [], oldAmount, newAmount)

        console.log(`[bulk-update] Updating invoice ${invoice.qb_id} from ${oldAmount} to ${newAmount}`)

        // Call QB API to update
        const updatedQBInvoice = await updateInvoice(
          realmId,
          invoice.qb_id,
          {
            Id: invoice.qb_id,
            SyncToken: invoice.sync_token!,
            Line: updatedLineItems,
            sparse: true,
          },
          token
        )

        // Update database
        await supabase
          .schema('quickbooks')
          .from('qb_invoices')
          .update({
            total_amt: parseFloat(updatedQBInvoice.TotalAmt),
            balance: parseFloat(updatedQBInvoice.Balance),
            line_items: updatedQBInvoice.Line,
            sync_token: updatedQBInvoice.SyncToken,
            raw_data: updatedQBInvoice,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoice.id)

        results.push({
          id: invoice.id,
          qb_id: invoice.qb_id,
          success: true,
          new_amount: parseFloat(updatedQBInvoice.TotalAmt),
        })

        // Add delay to respect API rate limits (500ms between requests)
        if (i < invoices.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } catch (error: any) {
        console.error(`[bulk-update] Error updating invoice ${invoice.qb_id}:`, error)
        results.push({
          id: invoice.id,
          qb_id: invoice.qb_id,
          success: false,
          error: error.message,
        })
      }
    }

    // Update reconciliation if all successful
    const allSuccessful = results.every((r) => r.success)
    const successfulCount = results.filter((r) => r.success).length

    if (allSuccessful && successfulCount > 0) {
      // Recalculate QB totals and balances
      const newQBTotal = distribution.reduce((sum, amt) => sum + amt, 0)

      // Calculate new total balance from updated invoices
      const { data: updatedInvoices } = await supabase
        .schema('quickbooks')
        .from('qb_invoices')
        .select('balance')
        .in('id', invoice_ids)

      const newQBTotalBalance = updatedInvoices
        ? updatedInvoices.reduce((sum, inv) => sum + parseFloat(inv.balance), 0)
        : 0

      const amountDifference = newQBTotal - lt_amount

      console.log('[bulk-update] Updating reconciliation:', {
        newQBTotal,
        newQBTotalBalance,
        lt_amount,
        amountDifference,
      })

      await supabase
        .schema('integration')
        .from('qb_reconciliation')
        .update({
          qb_total_amount: newQBTotal.toString(),
          qb_total_balance: newQBTotalBalance.toString(),
          match_status: Math.abs(amountDifference) < 0.01 ? 'matched' : 'amount_mismatch',
          amount_difference: amountDifference.toString(),
          last_reconciled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reconciliation_id)
    }

    return NextResponse.json({
      success: allSuccessful,
      updated_count: successfulCount,
      failed_count: results.filter((r) => !r.success).length,
      results,
      message: allSuccessful
        ? `Successfully updated ${successfulCount} invoice(s)`
        : `Updated ${successfulCount} of ${results.length} invoice(s)`,
    })
  } catch (error: any) {
    console.error('[PATCH /api/quickbooks/invoices/bulk-update] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
