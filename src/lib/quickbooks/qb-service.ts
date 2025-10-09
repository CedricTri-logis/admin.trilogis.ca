/**
 * QuickBooks Service Layer
 * Handles all QuickBooks API interactions including authentication, token refresh, and invoice operations
 */

import axios, { AxiosError } from 'axios'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
import type {
  QBAuthToken,
  QBInvoice,
  QBInvoicePayload,
  QBInvoiceUpdatePayload,
  QBInvoiceResponse,
  QBErrorResponse,
  QBTokenRefreshResponse,
  QBStoredInvoice,
  QBInvoiceImport,
  QBLineItem,
} from './types'

/**
 * Get base URL for QuickBooks API based on environment
 */
function getQBBaseUrl(): string {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com'
}

/**
 * Fetch active QuickBooks auth token for a realm
 */
export async function getAuthToken(realmId: string): Promise<QBAuthToken | null> {
  const supabase = createSupabaseServiceRoleClient()

  const { data, error } = await supabase
    .schema('quickbooks')
    .from('qb_auth_tokens')
    .select('*')
    .eq('realm_id', realmId)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    console.error(`[getAuthToken] Error fetching token for realm ${realmId}:`, error)
    return null
  }

  return data as QBAuthToken
}

/**
 * Refresh an expired QuickBooks OAuth token
 */
export async function refreshToken(token: QBAuthToken): Promise<boolean> {
  try {
    console.log(`[refreshToken] Refreshing token for realm ${token.realm_id}`)

    const response = await axios.post<QBTokenRefreshResponse>(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token,
      }),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
      }
    )

    const newTokenData = response.data

    // Update token in database
    const supabase = createSupabaseServiceRoleClient()
    const { error } = await supabase
      .schema('quickbooks')
      .from('qb_auth_tokens')
      .update({
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        access_token_expires_at: new Date(Date.now() + newTokenData.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('realm_id', token.realm_id)

    if (error) {
      console.error('[refreshToken] Error updating token in database:', error)
      return false
    }

    // Update the token object in place
    token.access_token = newTokenData.access_token
    token.refresh_token = newTokenData.refresh_token

    console.log('[refreshToken] Token refreshed successfully')
    return true
  } catch (error) {
    console.error('[refreshToken] Error refreshing token:', error)
    return false
  }
}

/**
 * Make an HTTP request to QuickBooks API with automatic token refresh and retry logic
 */
export async function makeQBRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  token: QBAuthToken,
  data?: any,
  retries = 3
): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const config: any = {
        method,
        url,
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }

      if (data && method !== 'GET') {
        config.data = data
      }

      const response = await axios(config)
      return response.data
    } catch (error) {
      const axiosError = error as AxiosError<QBErrorResponse>

      // If 401 Unauthorized and not last retry, refresh token and retry
      if (axiosError.response?.status === 401 && attempt < retries - 1) {
        console.log(`[makeQBRequest] 401 error, refreshing token (attempt ${attempt + 1}/${retries})`)
        const refreshed = await refreshToken(token)
        if (!refreshed) {
          throw new Error('Failed to refresh QuickBooks token')
        }
        continue
      }

      // If last retry, throw the error
      if (attempt === retries - 1) {
        // Format QB error message if available
        const qbError = axiosError.response?.data?.Fault?.Error?.[0]
        if (qbError) {
          throw new Error(`QuickBooks API Error: ${qbError.Message} (${qbError.code})`)
        }
        throw error
      }

      // Exponential backoff for other errors
      const backoffMs = Math.pow(2, attempt) * 1000
      console.log(`[makeQBRequest] Error on attempt ${attempt + 1}, retrying in ${backoffMs}ms`)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }

  throw new Error('Max retries exceeded')
}

/**
 * Create a new invoice in QuickBooks
 */
export async function createInvoice(
  realmId: string,
  invoiceData: QBInvoicePayload,
  token: QBAuthToken
): Promise<QBInvoice> {
  const baseUrl = getQBBaseUrl()
  const url = `${baseUrl}/v3/company/${realmId}/invoice?minorversion=65`

  console.log('[createInvoice] Creating invoice in QuickBooks')

  const response = await makeQBRequest<QBInvoiceResponse>('POST', url, token, invoiceData)

  console.log('[createInvoice] Invoice created successfully:', response.Invoice.Id)
  return response.Invoice
}

/**
 * Update an existing invoice in QuickBooks
 */
export async function updateInvoice(
  realmId: string,
  invoiceId: string,
  updateData: QBInvoiceUpdatePayload,
  token: QBAuthToken
): Promise<QBInvoice> {
  const baseUrl = getQBBaseUrl()
  const url = `${baseUrl}/v3/company/${realmId}/invoice?minorversion=65`

  console.log('[updateInvoice] Updating invoice in QuickBooks:', invoiceId)

  const response = await makeQBRequest<QBInvoiceResponse>('POST', url, token, updateData)

  console.log('[updateInvoice] Invoice updated successfully:', response.Invoice.Id)
  return response.Invoice
}

/**
 * Build QuickBooks invoice payload from reconciliation/import data
 */
export function buildInvoicePayload(importData: QBInvoiceImport): QBInvoicePayload {
  const payload: QBInvoicePayload = {
    CustomerRef: {
      value: importData.qb_customer_qb_id!,
    },
    TxnDate: importData.txn_date,
    DueDate: importData.due_date || importData.txn_date,
    Line: importData.line_items,
  }

  // Add optional fields if present
  if (importData.customer_memo) {
    payload.CustomerMemo = { value: importData.customer_memo }
  }

  if (importData.private_note) {
    payload.PrivateNote = importData.private_note
  }

  if (importData.bill_addr) {
    payload.BillAddr = importData.bill_addr
  }

  if (importData.class_ref) {
    payload.ClassRef = importData.class_ref
  }

  if (importData.currency_code) {
    payload.CurrencyRef = { value: importData.currency_code }
  }

  if (importData.global_tax_calculation) {
    payload.GlobalTaxCalculation = importData.global_tax_calculation as any
  }

  if (importData.txn_tax_detail) {
    payload.TxnTaxDetail = importData.txn_tax_detail
  }

  if (importData.apply_tax_after_discount !== null) {
    payload.ApplyTaxAfterDiscount = importData.apply_tax_after_discount
  }

  return payload
}

/**
 * Save QuickBooks invoice to database
 */
export async function saveInvoiceToDatabase(
  qbInvoice: QBInvoice,
  realmId: string,
  customerName: string | null
): Promise<QBStoredInvoice> {
  const supabase = createSupabaseServiceRoleClient()

  const invoiceData = {
    realm_id: realmId,
    qb_id: qbInvoice.Id,
    doc_number: qbInvoice.DocNumber || null,
    txn_date: qbInvoice.TxnDate,
    due_date: qbInvoice.DueDate || null,
    customer_ref: qbInvoice.CustomerRef || null,
    customer_qb_id: qbInvoice.CustomerRef?.value || null,
    customer_name: customerName,
    bill_addr: qbInvoice.BillAddr || null,
    ship_addr: qbInvoice.ShipAddr || null,
    class_ref: qbInvoice.ClassRef || null,
    sales_term_ref: qbInvoice.SalesTermRef || null,
    total_amt: parseFloat(qbInvoice.TotalAmt || '0'),
    home_total_amt: parseFloat(qbInvoice.HomeTotalAmt || qbInvoice.TotalAmt || '0'),
    apply_tax_after_discount: qbInvoice.ApplyTaxAfterDiscount || false,
    print_status: qbInvoice.PrintStatus || null,
    email_status: qbInvoice.EmailStatus || null,
    balance: parseFloat(qbInvoice.Balance || qbInvoice.TotalAmt || '0'),
    deposit: parseFloat(qbInvoice.Deposit || '0'),
    customer_memo: qbInvoice.CustomerMemo?.value || null,
    private_note: qbInvoice.PrivateNote || null,
    metadata: qbInvoice.MetaData || null,
    sync_token: qbInvoice.SyncToken || null,
    currency_ref: qbInvoice.CurrencyRef || null,
    currency_code: qbInvoice.CurrencyRef?.value || 'CAD',
    exchange_rate: parseFloat(qbInvoice.ExchangeRate || '1'),
    home_balance: parseFloat(qbInvoice.HomeBalance || qbInvoice.Balance || qbInvoice.TotalAmt || '0'),
    line_items: qbInvoice.Line || null,
    linked_txn: qbInvoice.LinkedTxn || null,
    status: qbInvoice.TxnStatus || 'Payable',
    raw_data: qbInvoice,
    is_deleted: false,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .schema('quickbooks')
    .from('qb_invoices')
    .upsert(invoiceData, {
      onConflict: 'realm_id,qb_id',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to save invoice to database: ${error.message}`)
  }

  return data as QBStoredInvoice
}

/**
 * Update line item amounts proportionally based on new total
 */
export function updateLineItemAmounts(lineItems: QBLineItem[], oldTotal: number, newTotal: number): QBLineItem[] {
  if (oldTotal === 0 || Math.abs(oldTotal - newTotal) < 0.01) {
    return lineItems
  }

  const multiplier = newTotal / oldTotal

  return lineItems.map((item) => {
    if (item.DetailType === 'SalesItemLineDetail') {
      return {
        ...item,
        Amount: item.Amount * multiplier,
      }
    }
    return item
  })
}

/**
 * Calculate how to distribute target amount across multiple invoice amounts
 */
export function calculateAmountDistribution(targetAmount: number, currentAmounts: number[]): number[] {
  if (currentAmounts.length === 0) {
    return []
  }

  if (currentAmounts.length === 1) {
    // Single invoice: set to full amount
    return [targetAmount]
  }

  // Multiple invoices: distribute proportionally
  const currentTotal = currentAmounts.reduce((sum, amt) => sum + amt, 0)

  if (currentTotal === 0) {
    // Equal distribution if all current amounts are 0
    const equalAmount = targetAmount / currentAmounts.length
    return currentAmounts.map(() => equalAmount)
  }

  // Proportional distribution
  return currentAmounts.map((amt) => {
    const proportion = amt / currentTotal
    return targetAmount * proportion
  })
}
