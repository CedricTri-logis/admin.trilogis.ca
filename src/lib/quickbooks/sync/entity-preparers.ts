/**
 * QuickBooks Entity Data Preparation Functions
 *
 * These functions transform QuickBooks API responses into database-ready objects
 */

export interface PreparedEntity {
  realm_id: string
  qb_id: string
  [key: string]: any
}

/**
 * Prepare Customer data for database insertion
 */
export function prepareCustomerData(entity: any, realmId: string): PreparedEntity {
  return {
    realm_id: realmId,
    qb_id: entity.Id,
    display_name: entity.DisplayName || 'Unknown',
    given_name: entity.GivenName || null,
    family_name: entity.FamilyName || null,
    company_name: entity.CompanyName || null,
    primary_email_addr: entity.PrimaryEmailAddr?.Address || null,
    primary_phone: entity.PrimaryPhone?.FreeFormNumber || null,
    mobile_phone: entity.MobilePhone?.FreeFormNumber || null,
    billing_addr: entity.BillAddr || null,
    shipping_addr: entity.ShipAddr || null,
    notes: entity.Notes || null,
    taxable: entity.Taxable ?? true,
    balance: parseFloat(entity.Balance || '0'),
    currency_ref: entity.CurrencyRef || null,
    preferred_delivery_method: entity.PreferredDeliveryMethod || null,
    is_active: entity.Active !== false,
    metadata: entity.CustomField || null,
    parent_ref: entity.ParentRef || null,
    parent_qb_id: entity.ParentRef?.value || null,
    parent_name: entity.ParentRef?.name || null,
    is_job: entity.Job || false,
    balance_with_jobs: parseFloat(entity.BalanceWithJobs || '0'),
    fully_qualified_name: entity.FullyQualifiedName || entity.DisplayName,
    level: entity.Level || 0,
    sync_token: entity.SyncToken,
    created_at: entity.MetaData?.CreateTime || new Date().toISOString(),
    updated_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString(),
    is_deleted: false
  }
}

/**
 * Prepare Vendor data for database insertion
 */
export function prepareVendorData(entity: any, realmId: string): PreparedEntity {
  return {
    realm_id: realmId,
    qb_id: entity.Id,
    display_name: entity.DisplayName || 'Unknown',
    given_name: entity.GivenName || null,
    middle_name: entity.MiddleName || null,
    family_name: entity.FamilyName || null,
    company_name: entity.CompanyName || null,
    primary_email_addr: entity.PrimaryEmailAddr?.Address || null,
    web_addr: entity.WebAddr?.URI || null,
    primary_phone: entity.PrimaryPhone?.FreeFormNumber || null,
    mobile_phone: entity.MobilePhone?.FreeFormNumber || null,
    fax_phone: entity.FaxPhone?.FreeFormNumber || null,
    billing_addr: entity.BillAddr || null,
    other_addr: entity.OtherAddr || null,
    tax_identifier: entity.TaxIdentifier || null,
    acct_num: entity.AcctNum || null,
    vendor_1099: entity.Vendor1099 || false,
    currency_ref: entity.CurrencyRef || null,
    billing_rate: entity.BillingRate || null,
    balance: parseFloat(entity.Balance || '0'),
    is_active: entity.Active !== false,
    metadata: entity.CustomField || null,
    sync_token: entity.SyncToken,
    created_at: entity.MetaData?.CreateTime || new Date().toISOString(),
    updated_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString(),
    is_deleted: false
  }
}

/**
 * Prepare Invoice data for database insertion
 */
export function prepareInvoiceData(entity: any, realmId: string): PreparedEntity {
  return {
    realm_id: realmId,
    qb_id: entity.Id,
    doc_number: entity.DocNumber || null,
    txn_date: entity.TxnDate,
    due_date: entity.DueDate || null,
    customer_ref: entity.CustomerRef || null,
    customer_qb_id: entity.CustomerRef?.value || '0',
    bill_addr: entity.BillAddr || null,
    ship_addr: entity.ShipAddr || null,
    class_ref: entity.ClassRef || null,
    sales_term_ref: entity.SalesTermRef || null,
    total_amt: parseFloat(entity.TotalAmt || '0'),
    home_total_amt: parseFloat(entity.HomeTotalAmt || entity.TotalAmt || '0'),
    apply_tax_after_discount: entity.ApplyTaxAfterDiscount || false,
    print_status: entity.PrintStatus || null,
    email_status: entity.EmailStatus || null,
    balance: parseFloat(entity.Balance || '0'),
    deposit: parseFloat(entity.Deposit || '0'),
    customer_memo: entity.CustomerMemo?.value || null,
    private_note: entity.PrivateNote || null,
    metadata: entity.CustomField || null,
    sync_token: entity.SyncToken,
    created_at: entity.MetaData?.CreateTime || new Date().toISOString(),
    updated_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString(),
    currency_ref: entity.CurrencyRef || null,
    exchange_rate: parseFloat(entity.ExchangeRate || '1'),
    home_balance: parseFloat(entity.HomeBalance || entity.Balance || '0'),
    line_items: entity.Line || null,
    linked_txn: entity.LinkedTxn || null,
    is_deleted: false,
    customer_name: entity.CustomerRef?.name || null,
    total_amount: parseFloat(entity.TotalAmt || '0'),
    raw_data: entity
  }
}

/**
 * Prepare Payment data for database insertion
 */
export function preparePaymentData(entity: any, realmId: string): PreparedEntity {
  return {
    realm_id: realmId,
    qb_id: entity.Id,
    txn_date: entity.TxnDate,
    customer_ref: entity.CustomerRef || null,
    customer_qb_id: entity.CustomerRef?.value || null,
    customer_name: entity.CustomerRef?.name || null,
    ar_account_ref: entity.ARAccountRef || null,
    deposit_to_account_ref: entity.DepositToAccountRef || null,
    deposit_to_account_id: entity.DepositToAccountRef?.value || null,
    payment_method_ref: entity.PaymentMethodRef || null,
    payment_method_id: entity.PaymentMethodRef?.value || null,
    payment_ref_num: entity.PaymentRefNum || null,
    total_amt: parseFloat(entity.TotalAmt || '0'),
    total_amount: parseFloat(entity.TotalAmt || '0'),
    unapplied_amt: parseFloat(entity.UnappliedAmt || '0'),
    unapplied_amount: parseFloat(entity.UnappliedAmt || '0'),
    process_payment: entity.ProcessPayment || false,
    currency_ref: entity.CurrencyRef || null,
    currency_code: entity.CurrencyRef?.value || 'CAD',
    exchange_rate: parseFloat(entity.ExchangeRate || '1'),
    private_note: entity.PrivateNote || null,
    metadata: entity.CustomField || null,
    sync_token: entity.SyncToken,
    created_at: entity.MetaData?.CreateTime || new Date().toISOString(),
    updated_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString(),
    is_deleted: false,
    line_items: entity.Line || null,
    linked_txn: entity.LinkedTxn || null,
    txn_source: entity.TxnSource || null,
    raw_data: entity
  }
}

/**
 * Prepare Company data for database insertion
 */
export function prepareCompanyData(entity: any, realmId: string): PreparedEntity {
  const monthMap: Record<string, number> = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
  }

  let fiscalMonth = null
  if (entity.FiscalYearStartMonth) {
    if (typeof entity.FiscalYearStartMonth === 'string') {
      fiscalMonth = monthMap[entity.FiscalYearStartMonth] || null
    } else {
      fiscalMonth = parseInt(entity.FiscalYearStartMonth) || null
    }
  }

  return {
    realm_id: realmId,
    qb_id: entity.Id,
    company_name: entity.CompanyName || 'Unknown',
    legal_name: entity.LegalName || null,
    company_addr: entity.CompanyAddr || null,
    customer_communication_addr: entity.CustomerCommunicationAddr || null,
    legal_addr: entity.LegalAddr || null,
    primary_phone: entity.PrimaryPhone?.FreeFormNumber || null,
    company_email: entity.Email?.Address || null,
    web_addr: entity.WebAddr?.URI || null,
    fiscal_year_start_month: fiscalMonth,
    country: entity.Country || null,
    supported_languages: entity.SupportedLanguages || null,
    metadata: entity.CustomField || null,
    sync_token: entity.SyncToken,
    created_at: entity.MetaData?.CreateTime || new Date().toISOString(),
    updated_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString(),
    is_deleted: false
  }
}

/**
 * Prepare Account data for database insertion
 */
export function prepareAccountData(entity: any, realmId: string): PreparedEntity {
  return {
    realm_id: realmId,
    qb_id: entity.Id,
    name: entity.Name || 'Unknown',
    account_type: entity.AccountType,
    account_sub_type: entity.AccountSubType || null,
    classification: entity.Classification || null,
    acct_num: entity.AcctNum || null,
    description: entity.Description || null,
    fully_qualified_name: entity.FullyQualifiedName || null,
    active: entity.Active !== false,
    parent_ref: entity.ParentRef || null,
    current_balance: parseFloat(entity.CurrentBalance || '0'),
    current_balance_with_sub_accounts: parseFloat(entity.CurrentBalanceWithSubAccounts || '0'),
    currency_ref: entity.CurrencyRef || null,
    tax_code_ref: entity.TaxCodeRef || null,
    metadata: entity.CustomField || null,
    sync_token: entity.SyncToken,
    created_at: entity.MetaData?.CreateTime || new Date().toISOString(),
    updated_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString(),
    is_deleted: false
  }
}

// Add more entity preparers as needed...
// (Bill, CreditMemo, Deposit, JournalEntry, Purchase, SalesReceipt, etc.)

export const ENTITY_PREPARERS: Record<string, (entity: any, realmId: string) => PreparedEntity> = {
  Customer: prepareCustomerData,
  Vendor: prepareVendorData,
  Invoice: prepareInvoiceData,
  Payment: preparePaymentData,
  CompanyInfo: prepareCompanyData,
  Account: prepareAccountData,
}

export const ENTITY_CONFIG: Record<string, {
  table: string
  isTransactional: boolean
  minorVersion?: string
}> = {
  CompanyInfo: { table: 'qb_companies', isTransactional: false },
  Customer: { table: 'qb_customers', isTransactional: false },
  Vendor: { table: 'qb_vendors', isTransactional: false },
  Account: { table: 'qb_accounts', isTransactional: false },
  Invoice: { table: 'qb_invoices', isTransactional: true },
  Payment: { table: 'qb_payments', isTransactional: true },
  Bill: { table: 'qb_bills', isTransactional: true },
  // Add more as needed...
}

/**
 * Generic entity data preparer - routes to the correct preparer function
 */
export function prepareEntityData(entity: any, entityType: string, realmId: string): PreparedEntity {
  const preparer = ENTITY_PREPARERS[entityType]

  if (!preparer) {
    throw new Error(`No preparer function found for entity type: ${entityType}`)
  }

  return preparer(entity, realmId)
}
