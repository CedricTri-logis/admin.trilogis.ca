import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
import {
  getAuthToken,
  createInvoice,
  buildInvoicePayload,
  saveInvoiceToDatabase,
} from '@/lib/quickbooks/qb-service'
import type { QBReconciliation, QBInvoiceImport } from '@/lib/quickbooks/types'

/**
 * POST /api/quickbooks/invoices/create
 * Create a new invoice in QuickBooks for a reconciliation record with status 'no_qb_invoice'
 */
export async function POST(request: NextRequest) {
  try {
    const { reconciliation_id } = await request.json()

    // Validation
    if (!reconciliation_id) {
      return NextResponse.json({ error: 'Missing reconciliation_id' }, { status: 400 })
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

    // Validate status
    if (reconciliation.match_status !== 'no_qb_invoice') {
      return NextResponse.json(
        {
          error: `Cannot create invoice for match_status '${reconciliation.match_status}'. Expected 'no_qb_invoice'.`,
        },
        { status: 400 }
      )
    }

    // Check if qb_invoices_import entry exists, if not create it
    const { data: existingImport } = await supabase
      .schema('integration')
      .from('qb_invoices_import')
      .select('*')
      .eq('qb_reconciliation_id', reconciliation_id)
      .eq('import_status', 'pending')
      .maybeSingle()

    let importRecord: QBInvoiceImport

    if (existingImport) {
      importRecord = existingImport as QBInvoiceImport
    } else {
      // Need to create qb_invoices_import entry
      // First, get customer QB ID from qb_customers table
      const { data: customer, error: customerError } = await supabase
        .schema('quickbooks')
        .from('qb_customers')
        .select('qb_id, display_name, realm_id')
        .eq('id', reconciliation.qb_customer_id!)
        .single()

      if (customerError || !customer) {
        return NextResponse.json({ error: 'QB Customer not found' }, { status: 404 })
      }

      // Get class if needed (check if apartment_category maps to a class)
      let classQbId = null
      let className = null
      if (reconciliation.apartment_category) {
        const { data: classData } = await supabase
          .schema('quickbooks')
          .from('qb_classes')
          .select('qb_id, name')
          .eq('realm_id', customer.realm_id)
          .eq('name', reconciliation.apartment_category)
          .maybeSingle()

        if (classData) {
          classQbId = classData.qb_id
          className = classData.name
        }
      }

      // Create line items based on LT invoice data
      const lineItems = [
        {
          Amount: parseFloat(reconciliation.lt_amount),
          DetailType: 'SalesItemLineDetail',
          Description: `${reconciliation.apartment_name || 'Apartment'} - ${reconciliation.invoice_month}`,
          SalesItemLineDetail: {
            ItemRef: {
              value: '1', // Default item - you may need to customize this
              name: 'Services',
            },
            ...(classQbId && {
              ClassRef: {
                value: classQbId,
                name: className,
              },
            }),
          },
        },
      ]

      // Create import record
      const { data: newImport, error: importError } = await supabase
        .schema('integration')
        .from('qb_invoices_import')
        .insert({
          realm_id: customer.realm_id,
          qb_reconciliation_id: reconciliation_id,
          qb_customer_id: reconciliation.qb_customer_id,
          qb_customer_qb_id: customer.qb_id,
          customer_name: customer.display_name,
          qb_class_qb_id: classQbId,
          qb_class_name: className,
          txn_date: reconciliation.invoice_month,
          due_date: reconciliation.invoice_month,
          total_amt: reconciliation.lt_amount,
          line_items: lineItems,
          customer_memo: `Invoice for ${reconciliation.apartment_name} - ${reconciliation.invoice_month}`,
          import_status: 'pending',
        })
        .select()
        .single()

      if (importError || !newImport) {
        console.error('Error creating import record:', importError)
        return NextResponse.json({ error: 'Failed to create import record' }, { status: 500 })
      }

      importRecord = newImport as QBInvoiceImport
    }

    // Get auth token
    const token = await getAuthToken(importRecord.realm_id)
    if (!token) {
      return NextResponse.json({ error: 'QuickBooks authentication failed' }, { status: 401 })
    }

    // Build QB invoice payload
    const invoicePayload = buildInvoicePayload(importRecord)

    // Create invoice in QuickBooks
    const qbInvoice = await createInvoice(importRecord.realm_id, invoicePayload, token)

    // Save to database
    const savedInvoice = await saveInvoiceToDatabase(qbInvoice, importRecord.realm_id, importRecord.customer_name)

    // Update qb_invoices_import status
    await supabase
      .schema('integration')
      .from('qb_invoices_import')
      .update({
        import_status: 'imported',
        qb_id: qbInvoice.Id,
        qb_invoice_id: savedInvoice.id,
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', importRecord.id)

    // Update qb_reconciliation
    const { data: currentRecon } = await supabase
      .schema('integration')
      .from('qb_reconciliation')
      .select('qb_invoice_ids, qb_invoices_count, qb_total_amount, qb_total_balance')
      .eq('id', reconciliation_id)
      .single()

    if (currentRecon) {
      const newInvoiceIds = [...(currentRecon.qb_invoice_ids || []), savedInvoice.id]
      const newCount = (currentRecon.qb_invoices_count || 0) + 1
      const newTotalAmount = (parseFloat(currentRecon.qb_total_amount || '0') + parseFloat(savedInvoice.total_amt)).toString()
      const newTotalBalance = (parseFloat(currentRecon.qb_total_balance || '0') + parseFloat(savedInvoice.balance)).toString()

      await supabase
        .schema('integration')
        .from('qb_reconciliation')
        .update({
          qb_invoice_ids: newInvoiceIds,
          qb_invoices_count: newCount,
          qb_total_amount: newTotalAmount,
          qb_total_balance: newTotalBalance,
          match_status: 'matched',
          last_reconciled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reconciliation_id)
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice created successfully',
      invoice: {
        qb_id: qbInvoice.Id,
        doc_number: qbInvoice.DocNumber,
        total_amt: qbInvoice.TotalAmt,
        balance: qbInvoice.Balance,
      },
    })
  } catch (error: any) {
    console.error('[POST /api/quickbooks/invoices/create] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
