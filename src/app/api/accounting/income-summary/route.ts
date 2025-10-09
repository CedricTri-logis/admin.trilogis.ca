import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '12')

    // Calculate date threshold (12 months ago)
    const dateThreshold = new Date()
    dateThreshold.setMonth(dateThreshold.getMonth() - months)
    const dateString = dateThreshold.toISOString().split('T')[0]

    // Get current date to filter out future invoices
    const currentDate = new Date().toISOString().split('T')[0]

    // Fetch companies
    const { data: companies, error: companiesError } = await supabase
      .schema('quickbooks')
      .from('qb_companies')
      .select('realm_id, company_name')
      .eq('is_deleted', false)

    if (companiesError) {
      console.error('[accounting/income-summary] Companies error:', companiesError)
      return NextResponse.json({ error: 'Failed to fetch companies', details: companiesError }, { status: 500 })
    }

    // Use database function to bypass 1000 row limit
    const { data: invoices, error: invoicesError } = await supabase
      .rpc('get_invoices_for_accounting', {
        start_date: dateString,
        end_date: currentDate
      })

    if (invoicesError) {
      console.error('[accounting/income-summary] Invoices error:', invoicesError)
      return NextResponse.json({ error: 'Failed to fetch invoices', details: invoicesError }, { status: 500 })
    }

    console.log('[accounting/income-summary] Found companies:', companies?.length, 'invoices:', invoices?.length, 'date threshold:', dateString)

    // Create company map
    const companyLookup = new Map(companies?.map(c => [c.realm_id, c.company_name]) || [])
    const companyMap = new Map()
    const accountMap = new Map()

    // Initialize company map
    companies?.forEach(company => {
      companyMap.set(company.realm_id, {
        company_name: company.company_name,
        realm_id: company.realm_id,
        accounts: [],
        total: 0
      })
    })

    // Process invoice line items to extract account revenues
    invoices?.forEach((invoice: any) => {
      const companyName = companyLookup.get(invoice.realm_id) || 'Unknown'
      const realmId = invoice.realm_id

      const lineItems = invoice.line_items || []
      lineItems.forEach((item: any) => {
        if (item.DetailType === 'SalesItemLineDetail' && item.SalesItemLineDetail?.ItemAccountRef) {
          const accountRef = item.SalesItemLineDetail.ItemAccountRef
          const accountQbId = accountRef.value
          const accountName = accountRef.name
          const amount = parseFloat(item.Amount || '0')

          if (accountQbId && amount > 0) {
            const key = `${realmId}-${accountQbId}`

            if (!accountMap.has(key)) {
              accountMap.set(key, {
                company_name: companyName,
                realm_id: realmId,
                account_qb_id: accountQbId,
                account_name: accountName,
                total_revenue: 0,
                transaction_count: 0
              })
            }

            const existing = accountMap.get(key)
            existing.total_revenue += amount
            existing.transaction_count++
          }
        }
      })
    })

    // Group by company
    accountMap.forEach((accountData) => {
      const company = companyMap.get(accountData.realm_id)
      if (company) {
        company.accounts.push({
          account_name: accountData.account_name,
          account_type: 'Income',
          classification: 'Revenue',
          fully_qualified_name: accountData.account_name,
          total_revenue: accountData.total_revenue.toString(),
          transaction_count: accountData.transaction_count
        })
        company.total += accountData.total_revenue
      }
    })

    // Sort accounts within each company
    companyMap.forEach((company) => {
      company.accounts.sort((a: any, b: any) => parseFloat(b.total_revenue) - parseFloat(a.total_revenue))
    })

    const result = Array.from(companyMap.values())

    console.log('[accounting/income-summary] Returning data:', {
      companies: result.length,
      totalAccounts: result.reduce((sum, c) => sum + c.accounts.length, 0),
      totalRevenue: result.reduce((sum, c) => sum + c.total, 0)
    })

    return NextResponse.json({
      success: true,
      data: result,
      period_months: months,
      debug: {
        invoices_found: invoices?.length || 0,
        unique_accounts_found: accountMap.size,
        companies_found: companies?.length || 0,
        date_threshold: dateString
      }
    })
  } catch (error) {
    console.error('[accounting/income-summary] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
