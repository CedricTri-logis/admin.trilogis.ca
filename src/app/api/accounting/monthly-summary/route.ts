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
      console.error('[accounting/monthly-summary] Companies error:', companiesError)
      return NextResponse.json({ error: 'Failed to fetch companies', details: companiesError }, { status: 500 })
    }

    // Use database function to bypass 1000 row limit
    const { data: invoices, error: invoicesError } = await supabase
      .rpc('get_invoices_for_accounting', {
        start_date: dateString,
        end_date: currentDate
      })

    if (invoicesError) {
      console.error('[accounting/monthly-summary] Invoices error:', invoicesError)
      return NextResponse.json({ error: 'Failed to fetch invoices', details: invoicesError }, { status: 500 })
    }

    // Use database function to bypass 1000 row limit
    const { data: purchases, error: purchasesError } = await supabase
      .rpc('get_purchases_for_accounting', {
        start_date: dateString,
        end_date: currentDate
      })

    if (purchasesError) {
      console.error('[accounting/monthly-summary] Purchases error:', purchasesError)
      return NextResponse.json({ error: 'Failed to fetch purchases', details: purchasesError }, { status: 500 })
    }

    console.log('[accounting/monthly-summary] DATA FETCHED:', {
      companies: companies?.length,
      invoices: invoices?.length,
      purchases: purchases?.length,
      dateThreshold: dateString,
      currentDate: currentDate
    })

    // Create company lookup
    const companyLookup = new Map(companies?.map(c => [c.realm_id, c.company_name]) || [])

    // Map to hold monthly data: company_realm_id -> month -> {income, expenses}
    const monthlyDataMap = new Map()

    // Initialize structure for each company
    companies?.forEach(company => {
      monthlyDataMap.set(company.realm_id, new Map())
    })

    // Helper to get month key from date
    const getMonthKey = (dateStr: string) => {
      const date = new Date(dateStr)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }

    // Helper to get month label
    const getMonthLabel = (monthKey: string) => {
      const [year, month] = monthKey.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    }

    // Process invoices for income
    invoices?.forEach((invoice: any) => {
      const monthKey = getMonthKey(invoice.txn_date)
      const companyMonths = monthlyDataMap.get(invoice.realm_id)

      if (companyMonths) {
        if (!companyMonths.has(monthKey)) {
          companyMonths.set(monthKey, { income: 0, expenses: 0 })
        }

        const lineItems = invoice.line_items || []
        lineItems.forEach((item: any) => {
          if (item.DetailType === 'SalesItemLineDetail' && item.SalesItemLineDetail?.ItemAccountRef) {
            const amount = parseFloat(item.Amount || '0')
            if (amount > 0) {
              const monthData = companyMonths.get(monthKey)
              if (monthData) {
                monthData.income += amount
              }
            }
          }
        })
      }
    })

    // Process purchases for expenses
    purchases?.forEach((purchase: any) => {
      const monthKey = getMonthKey(purchase.txn_date)
      const companyMonths = monthlyDataMap.get(purchase.realm_id)

      if (companyMonths) {
        if (!companyMonths.has(monthKey)) {
          companyMonths.set(monthKey, { income: 0, expenses: 0 })
        }

        const lineItems = purchase.line_items || []
        lineItems.forEach((item: any) => {
          if (item.DetailType === 'AccountBasedExpenseLineDetail' && item.AccountBasedExpenseLineDetail?.AccountRef) {
            const amount = parseFloat(item.Amount || '0')
            if (amount > 0) {
              const monthData = companyMonths.get(monthKey)
              if (monthData) {
                monthData.expenses += amount
              }
            }
          }
        })
      }
    })


    // Build final result
    const companiesData = companies?.map(company => {
      const companyMonths = monthlyDataMap.get(company.realm_id)
      const monthlyData: any[] = []
      let totalIncome = 0
      let totalExpenses = 0

      if (companyMonths) {
        // Sort months chronologically
        const sortedMonths = Array.from(companyMonths.keys()).sort()

        sortedMonths.forEach(monthKey => {
          const data = companyMonths.get(monthKey)
          if (data) {
            totalIncome += data.income
            totalExpenses += data.expenses

            monthlyData.push({
              company_name: company.company_name,
              realm_id: company.realm_id,
              month: monthKey,
              month_label: getMonthLabel(monthKey),
              income: data.income,
              expenses: data.expenses,
              net: data.income - data.expenses
            })
          }
        })
      }

      return {
        company_name: company.company_name,
        realm_id: company.realm_id,
        monthly_data: monthlyData,
        totals: {
          income: totalIncome,
          expenses: totalExpenses,
          net: totalIncome - totalExpenses
        }
      }
    }) || []

    console.log('[accounting/monthly-summary] Returning data:', {
      companies: companiesData.length,
      totalIncome: companiesData.reduce((sum, c) => sum + c.totals.income, 0),
      totalExpenses: companiesData.reduce((sum, c) => sum + c.totals.expenses, 0)
    })

    return NextResponse.json({
      success: true,
      data: companiesData,
      period_months: months,
      debug: {
        invoices_found: invoices?.length || 0,
        purchases_found: purchases?.length || 0,
        companies_found: companies?.length || 0,
        date_threshold: dateString
      }
    })
  } catch (error) {
    console.error('[accounting/monthly-summary] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
