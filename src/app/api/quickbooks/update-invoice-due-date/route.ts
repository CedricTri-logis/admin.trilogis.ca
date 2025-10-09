import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
import { getAuthToken, updateInvoice } from '@/lib/quickbooks/qb-service'
import type { QBStoredInvoice } from '@/lib/quickbooks/types'

/**
 * POST /api/quickbooks/update-invoice-due-date
 * Update the due date of a QB invoice and sync to QuickBooks
 */
export async function POST(request: NextRequest) {
  try {
    const { invoiceId, qbId, dueDate } = await request.json()

    // Validation
    if (!invoiceId || !qbId || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields: invoiceId, qbId, dueDate' },
        { status: 400 }
      )
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dueDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. Expected YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServiceRoleClient()

    // Fetch the invoice from database
    const { data: invoice, error: invoiceError } = await supabase
      .schema('quickbooks')
      .from('qb_invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const qbInvoice = invoice as QBStoredInvoice

    // Verify qb_id matches
    if (qbInvoice.qb_id !== qbId) {
      return NextResponse.json({ error: 'Invoice ID mismatch' }, { status: 400 })
    }

    // Get auth token for the realm
    const token = await getAuthToken(qbInvoice.realm_id)
    if (!token) {
      return NextResponse.json({ error: 'QuickBooks authentication failed' }, { status: 401 })
    }

    console.log(`[update-invoice-due-date] Updating invoice ${qbId} due date to ${dueDate}`)

    // Update the invoice in QuickBooks
    const updatedQBInvoice = await updateInvoice(
      qbInvoice.realm_id,
      qbInvoice.qb_id,
      {
        Id: qbInvoice.qb_id,
        SyncToken: qbInvoice.sync_token!,
        DueDate: dueDate,
        sparse: true, // Only update specified fields
      },
      token
    )

    console.log(`[update-invoice-due-date] QuickBooks update successful for invoice ${qbId}`)

    // Update the invoice in the database
    const { error: updateError } = await supabase
      .schema('quickbooks')
      .from('qb_invoices')
      .update({
        due_date: updatedQBInvoice.DueDate,
        sync_token: updatedQBInvoice.SyncToken,
        raw_data: updatedQBInvoice,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('[update-invoice-due-date] Error updating database:', updateError)
      return NextResponse.json(
        { error: 'Failed to update database after QuickBooks update' },
        { status: 500 }
      )
    }

    console.log(`[update-invoice-due-date] Database updated successfully for invoice ${invoiceId}`)

    // Trigger refresh of qb_reconciliation by calling the recalculate function
    // This ensures the QB balance reflects the updated due date
    try {
      const { error: recalcError } = await supabase.rpc('calculate_invoice_balance', {
        v_customer_qb_id: qbInvoice.customer_qb_id!,
        v_realm_id: qbInvoice.realm_id,
      })

      if (recalcError) {
        console.error('[update-invoice-due-date] Error recalculating balance:', recalcError)
        // Don't fail the request, just log the error
      } else {
        console.log(`[update-invoice-due-date] QB balance recalculated for customer ${qbInvoice.customer_qb_id}`)
      }
    } catch (recalcErr) {
      console.error('[update-invoice-due-date] Error calling calculate_invoice_balance:', recalcErr)
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice due date updated successfully',
      data: {
        invoiceId,
        qbId,
        newDueDate: updatedQBInvoice.DueDate,
      },
    })
  } catch (error: any) {
    console.error('[POST /api/quickbooks/update-invoice-due-date] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
