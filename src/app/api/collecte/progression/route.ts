import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Types for our response
export type ReceivablesPeriod = 'daily' | 'weekly' | 'monthly'

export interface ReceivablesDataPoint {
  date: string
  period_label?: string // For weekly/monthly display
  total_receivables: number
  outstanding_invoices: number
  customers_with_balance: number
  payments_made: number
  payment_amount: number
  invoices_created: number
  invoice_amount: number
  daily_change: number | null
  daily_change_pct: number | null
}

export interface ReceivablesResponse {
  period: ReceivablesPeriod
  start_date: string
  end_date: string
  data: ReceivablesDataPoint[]
  summary: {
    current_receivables: number
    current_outstanding_invoices: number
    current_customers_with_balance: number
    period_change: number
    period_change_pct: number
    total_payments: number
    total_new_invoices: number
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams

    // Parse parameters
    const period = (searchParams.get('period') || 'daily') as ReceivablesPeriod
    const range = parseInt(searchParams.get('range') || '7')

    // Validate parameters
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period. Must be daily, weekly, or monthly' },
        { status: 400 }
      )
    }

    if (isNaN(range) || range < 1 || range > 365) {
      return NextResponse.json(
        { error: 'Invalid range. Must be between 1 and 365' },
        { status: 400 }
      )
    }

    // Get the realm_id (company ID)
    const { data: companies } = await supabase
      .schema('quickbooks')
      .from('qb_companies')
      .select('realm_id')
      .limit(1)
      .single()

    if (!companies?.realm_id) {
      return NextResponse.json(
        { error: 'No QuickBooks company found' },
        { status: 404 }
      )
    }

    const realmId = companies.realm_id

    // Calculate date range based on period and range
    const endDate = new Date()
    const startDate = new Date()

    switch (period) {
      case 'daily':
        startDate.setDate(endDate.getDate() - (range - 1))
        break
      case 'weekly':
        startDate.setDate(endDate.getDate() - (range * 7 - 1))
        break
      case 'monthly':
        startDate.setMonth(endDate.getMonth() - (range - 1))
        startDate.setDate(1) // Start of month
        break
    }

    // Get receivables data
    const data = await getReceivablesData(
      supabase,
      realmId,
      period,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    )

    // Calculate summary
    const summary = calculateSummary(data)

    const response: ReceivablesResponse = {
      period,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      data,
      summary
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching receivables progression:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get receivables data for the specified period
 */
async function getReceivablesData(
  supabase: any,
  realmId: string,
  period: ReceivablesPeriod,
  startDate: string,
  endDate: string
): Promise<ReceivablesDataPoint[]> {

  // Fetch all invoices (we need their balances, dates, and due dates)
  const { data: invoices, error: invoicesError } = await supabase
    .schema('quickbooks')
    .from('qb_invoices')
    .select('qb_id, txn_date, due_date, total_amt, balance, customer_qb_id, is_deleted')
    .eq('realm_id', realmId)
    .eq('is_deleted', false)
    .lte('txn_date', endDate)

  if (invoicesError) {
    console.error('Error fetching invoices:', invoicesError)
    throw invoicesError
  }

  // Fetch all payments in the date range
  const { data: payments, error: paymentsError} = await supabase
    .schema('quickbooks')
    .from('qb_payments')
    .select('qb_id, txn_date, total_amt, line_items, customer_qb_id, is_deleted')
    .eq('realm_id', realmId)
    .eq('is_deleted', false)
    .gte('txn_date', startDate)
    .lte('txn_date', endDate)
    .gt('total_amt', 0)

  if (paymentsError) {
    console.error('Error fetching payments:', paymentsError)
    throw paymentsError
  }

  // Calculate receivables for each day
  return calculateDailyReceivables(
    invoices || [],
    payments || [],
    period,
    startDate,
    endDate
  )
}

/**
 * Calculate daily receivables from invoices and payments data
 */
function calculateDailyReceivables(
  invoices: any[],
  payments: any[],
  period: ReceivablesPeriod,
  startDate: string,
  endDate: string
): ReceivablesDataPoint[] {

  // Create payment lookup map (invoice_qb_id -> payment details)
  const paymentsByInvoice = new Map<string, Array<{date: string, amount: number}>>()

  payments.forEach(payment => {
    const lineItems = payment.line_items || []
    lineItems.forEach((item: any) => {
      const linkedTxn = item.LinkedTxn?.[0]
      if (linkedTxn?.TxnId) {
        const invoiceId = linkedTxn.TxnId
        if (!paymentsByInvoice.has(invoiceId)) {
          paymentsByInvoice.set(invoiceId, [])
        }
        paymentsByInvoice.get(invoiceId)!.push({
          date: payment.txn_date,
          amount: parseFloat(item.Amount || 0)
        })
      }
    })
  })

  // Generate date range
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }

  // Calculate receivables for each date
  const dailyData = dates.map(date => {
    let totalReceivables = 0
    const customersSet = new Set<string>()
    let outstandingCount = 0

    // Calculate receivables as of this date
    invoices.forEach(invoice => {
      // Invoice must be DUE by this date (not future invoices)
      // Invoice created <= date AND due_date <= date
      if (invoice.txn_date <= date && invoice.due_date && invoice.due_date <= date) {
        // Start with current balance
        let balanceAtDate = parseFloat(invoice.balance || 0)

        // Add back payments made AFTER this snapshot date
        const invoicePayments = paymentsByInvoice.get(invoice.qb_id) || []
        invoicePayments.forEach(payment => {
          if (payment.date > date) {
            balanceAtDate += payment.amount
          }
        })

        // If there was a balance at this date, count it
        if (balanceAtDate > 0) {
          totalReceivables += balanceAtDate
          customersSet.add(invoice.customer_qb_id)
          outstandingCount++
        }
      }
    })

    // Count payments made ON this date
    const paymentsOnDate = payments.filter(p => p.txn_date === date)
    const paymentAmount = paymentsOnDate.reduce((sum, p) => sum + parseFloat(p.total_amt || 0), 0)

    // Count invoices created ON this date
    const invoicesOnDate = invoices.filter(i => i.txn_date === date)
    const invoiceAmount = invoicesOnDate.reduce((sum, i) => sum + parseFloat(i.total_amt || 0), 0)

    return {
      date,
      total_receivables: totalReceivables,
      outstanding_invoices: outstandingCount,
      customers_with_balance: customersSet.size,
      payments_made: paymentsOnDate.length,
      payment_amount: paymentAmount,
      invoices_created: invoicesOnDate.length,
      invoice_amount: invoiceAmount,
      daily_change: null,
      daily_change_pct: null
    }
  })

  // Group by period if needed
  if (period === 'weekly' || period === 'monthly') {
    return groupByPeriod(dailyData, period)
  }

  return dailyData.reverse() // Return in DESC order (newest first)
}

/**
 * Group daily data by week or month
 */
function groupByPeriod(
  dailyData: ReceivablesDataPoint[],
  period: 'weekly' | 'monthly'
): ReceivablesDataPoint[] {

  const grouped = new Map<string, ReceivablesDataPoint[]>()

  dailyData.forEach(day => {
    const date = new Date(day.date)
    let key: string

    if (period === 'weekly') {
      // Week starts on Monday
      const dayOfWeek = date.getDay()
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(date.setDate(diff))
      key = monday.toISOString().split('T')[0]
    } else {
      // Month
      key = day.date.substring(0, 7) + '-01' // First of month
    }

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(day)
  })

  // Aggregate each group
  const result: ReceivablesDataPoint[] = []

  grouped.forEach((days, key) => {
    const avgReceivables = days.reduce((sum, d) => sum + d.total_receivables, 0) / days.length
    const periodLabel = period === 'weekly'
      ? `Week of ${key}`
      : key.substring(0, 7)

    result.push({
      date: key,
      period_label: periodLabel,
      total_receivables: avgReceivables,
      outstanding_invoices: Math.round(days.reduce((sum, d) => sum + d.outstanding_invoices, 0) / days.length),
      customers_with_balance: Math.round(days.reduce((sum, d) => sum + d.customers_with_balance, 0) / days.length),
      payments_made: days.reduce((sum, d) => sum + d.payments_made, 0),
      payment_amount: days.reduce((sum, d) => sum + d.payment_amount, 0),
      invoices_created: days.reduce((sum, d) => sum + d.invoices_created, 0),
      invoice_amount: days.reduce((sum, d) => sum + d.invoice_amount, 0),
      daily_change: null,
      daily_change_pct: null
    })
  })

  return result.sort((a, b) => b.date.localeCompare(a.date)) // DESC order
}

/**
 * Calculate summary statistics from the data
 */
function calculateSummary(data: ReceivablesDataPoint[]) {
  if (data.length === 0) {
    return {
      current_receivables: 0,
      current_outstanding_invoices: 0,
      current_customers_with_balance: 0,
      period_change: 0,
      period_change_pct: 0,
      total_payments: 0,
      total_new_invoices: 0
    }
  }

  // Most recent data point (first in DESC order)
  const current = data[0]
  const oldest = data[data.length - 1]

  const periodChange = current.total_receivables - oldest.total_receivables
  const periodChangePct = oldest.total_receivables > 0
    ? (periodChange / oldest.total_receivables) * 100
    : 0

  const totalPayments = data.reduce((sum, d) => sum + d.payment_amount, 0)
  const totalNewInvoices = data.reduce((sum, d) => sum + d.invoice_amount, 0)

  // Calculate daily changes in the data array
  for (let i = 0; i < data.length - 1; i++) {
    const change = data[i].total_receivables - data[i + 1].total_receivables
    data[i].daily_change = change
    data[i].daily_change_pct = data[i + 1].total_receivables > 0
      ? (change / data[i + 1].total_receivables) * 100
      : 0
  }

  return {
    current_receivables: current.total_receivables,
    current_outstanding_invoices: current.outstanding_invoices,
    current_customers_with_balance: current.customers_with_balance,
    period_change: periodChange,
    period_change_pct: periodChangePct,
    total_payments: totalPayments,
    total_new_invoices: totalNewInvoices
  }
}
