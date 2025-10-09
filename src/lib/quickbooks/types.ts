/**
 * QuickBooks API Types
 * Based on QuickBooks Online API v3
 */

export type QBAuthToken = {
  id: string
  realm_id: string
  company_name: string | null
  access_token: string
  refresh_token: string
  access_token_expires_at: string
  refresh_token_expires_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type QBCustomerRef = {
  value: string
  name?: string
}

export type QBItemRef = {
  value: string
  name?: string
}

export type QBClassRef = {
  value: string
  name?: string
}

export type QBAccountRef = {
  value: string
  name?: string
}

export type QBCurrencyRef = {
  value: string
  name?: string
}

export type QBSalesItemLineDetail = {
  ItemRef?: QBItemRef
  ClassRef?: QBClassRef
  ItemAccountRef?: QBAccountRef
  Qty?: number
  UnitPrice?: number
  TaxCodeRef?: {
    value: string
  }
}

export type QBLineItem = {
  Id: string
  LineNum?: number
  Amount: number
  Description?: string
  DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail' | 'DiscountLineDetail'
  SalesItemLineDetail?: QBSalesItemLineDetail
}

export type QBAddress = {
  Id?: string
  Line1?: string
  Line2?: string
  Line3?: string
  Line4?: string
  Line5?: string
  City?: string
  Country?: string
  CountrySubDivisionCode?: string
  PostalCode?: string
  Lat?: string
  Long?: string
}

export type QBTxnTaxDetail = {
  TxnTaxCodeRef?: {
    value: string
  }
  TotalTax?: number
  TaxLine?: Array<{
    Amount?: number
    DetailType?: string
    TaxLineDetail?: {
      TaxRateRef?: {
        value: string
      }
      PercentBased?: boolean
      TaxPercent?: number
      NetAmountTaxable?: number
    }
  }>
}

export type QBInvoicePayload = {
  CustomerRef: QBCustomerRef
  TxnDate: string
  DueDate?: string
  DocNumber?: string
  Line: QBLineItem[]
  CustomerMemo?: {
    value: string
  }
  PrivateNote?: string
  BillAddr?: QBAddress
  ShipAddr?: QBAddress
  ClassRef?: QBClassRef
  SalesTermRef?: {
    value: string
  }
  CurrencyRef?: QBCurrencyRef
  GlobalTaxCalculation?: 'TaxExcluded' | 'TaxInclusive' | 'NotApplicable'
  TxnTaxDetail?: QBTxnTaxDetail
  ApplyTaxAfterDiscount?: boolean
}

export type QBInvoiceUpdatePayload = {
  Id: string
  SyncToken: string
  sparse?: true
  Line?: QBLineItem[]
  TxnDate?: string
  DueDate?: string
  CustomerMemo?: {
    value: string
  }
  PrivateNote?: string
}

export type QBInvoiceResponse = {
  Invoice: QBInvoice
  time: string
}

export type QBInvoice = {
  Id: string
  SyncToken: string
  MetaData?: {
    CreateTime?: string
    LastUpdatedTime?: string
  }
  DocNumber?: string
  TxnDate: string
  DueDate?: string
  CustomerRef: QBCustomerRef
  Line: QBLineItem[]
  TotalAmt: string
  HomeTotalAmt?: string
  Balance: string
  HomeBalance?: string
  Deposit?: string
  CustomerMemo?: {
    value: string
  }
  PrivateNote?: string
  BillAddr?: QBAddress
  ShipAddr?: QBAddress
  ClassRef?: QBClassRef
  SalesTermRef?: {
    value: string
  }
  CurrencyRef?: QBCurrencyRef
  ExchangeRate?: string
  GlobalTaxCalculation?: string
  TxnTaxDetail?: QBTxnTaxDetail
  ApplyTaxAfterDiscount?: boolean
  PrintStatus?: string
  EmailStatus?: string
  LinkedTxn?: Array<{
    TxnId: string
    TxnType: string
  }>
  TxnStatus?: string
  // Full raw response
  [key: string]: any
}

export type QBInvoiceImport = {
  id: string
  realm_id: string
  qb_reconciliation_id: string
  qb_customer_id: string | null
  qb_customer_qb_id: string | null
  customer_name: string | null
  qb_class_id: string | null
  qb_class_qb_id: string | null
  qb_class_name: string | null
  txn_date: string
  due_date: string | null
  total_amt: string
  line_items: QBLineItem[]
  customer_memo: string | null
  private_note: string | null
  bill_addr: QBAddress | null
  class_ref: QBClassRef | null
  currency_code: string | null
  global_tax_calculation: string | null
  txn_tax_detail: QBTxnTaxDetail | null
  apply_tax_after_discount: boolean | null
  import_status: 'pending' | 'imported' | 'error'
  qb_id: string | null
  qb_invoice_id: string | null
  imported_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type QBReconciliation = {
  id: string
  lt_invoice_id: string
  tenant_folder_id: string
  apartment_name: string | null
  apartment_category: string | null
  service_type: string | null
  invoice_month: string
  lt_amount: string
  lt_status: string | null
  qb_customer_id: string | null
  qb_customer_name: string | null
  qb_invoice_ids: string[]
  qb_invoices_count: number | null
  qb_total_amount: string | null
  qb_total_balance: string | null
  match_status: 'matched' | 'matched_multiple' | 'amount_mismatch' | 'service_mismatched' | 'no_qb_invoice' | 'lt_voided'
  amount_difference: string | null
  approved_for_qb_import: boolean | null
  last_reconciled_at: string | null
  created_at: string
  updated_at: string
}

export type QBStoredInvoice = {
  id: string
  realm_id: string
  qb_id: string
  doc_number: string | null
  txn_date: string
  due_date: string | null
  customer_ref: QBCustomerRef | null
  customer_qb_id: string | null
  customer_name: string | null
  bill_addr: QBAddress | null
  ship_addr: QBAddress | null
  class_ref: QBClassRef | null
  sales_term_ref: { value: string } | null
  total_amt: string
  home_total_amt: string | null
  apply_tax_after_discount: boolean
  print_status: string | null
  email_status: string | null
  balance: string
  deposit: string
  customer_memo: string | null
  private_note: string | null
  metadata: any | null
  sync_token: string | null
  currency_ref: QBCurrencyRef | null
  currency_code: string
  exchange_rate: string
  home_balance: string | null
  line_items: QBLineItem[] | null
  linked_txn: any[] | null
  status: string | null
  raw_data: any
  is_deleted: boolean
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export type QBErrorResponse = {
  Fault: {
    Error: Array<{
      Message: string
      Detail: string
      code: string
      element?: string
    }>
    type: string
  }
  time: string
}

export type QBTokenRefreshResponse = {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  x_refresh_token_expires_in: number
}
