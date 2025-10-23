// Types for Receivables Progression API

export type ReceivablesPeriod = 'daily' | 'weekly' | 'monthly'

export interface ReceivablesDataPoint {
  date: string
  period_label?: string
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
