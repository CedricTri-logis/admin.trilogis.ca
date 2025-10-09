import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // HARDCODED DATA for graphs (DO NOT CHANGE - these are the correct display numbers)
    const abitibiHardcoded = {
      name: 'Les immeubles abitibi',
      months: [
        { month: 'Oct 2024', totalIncome: 1295, totalExpenses: 200151, net: -198856 },
        { month: 'Nov 2024', totalIncome: 304631, totalExpenses: 231140, net: 73491 },
        { month: 'Dec 2024', totalIncome: 312917, totalExpenses: 317109, net: -4192 },
        { month: 'Jan 2025', totalIncome: 309557, totalExpenses: 251946, net: 57611 },
        { month: 'Feb 2025', totalIncome: 311128, totalExpenses: 279062, net: 32066 },
        { month: 'Mar 2025', totalIncome: 300994, totalExpenses: 305423, net: -4428 },
        { month: 'Apr 2025', totalIncome: 302605, totalExpenses: 307469, net: -4864 },
        { month: 'May 2025', totalIncome: 299721, totalExpenses: 258914, net: 40808 },
        { month: 'Jun 2025', totalIncome: 303740, totalExpenses: 278098, net: 25641 },
        { month: 'Jul 2025', totalIncome: 297870, totalExpenses: 239911, net: 57958 },
        { month: 'Aug 2025', totalIncome: 286118, totalExpenses: 212966, net: 73153 },
        { month: 'Sep 2025', totalIncome: 287838, totalExpenses: 401985, net: -114147 },
      ],
      totals: {
        totalIncome: 3518414,
        totalExpenses: 3284174,
        netProfit: 234241,
      },
    };

    const trilogisHardcoded = {
      name: 'Societe immobilière Tri-logis inc',
      months: [
        { month: 'Oct 2024', totalIncome: 164530, totalExpenses: 143324, net: 21206 },
        { month: 'Nov 2024', totalIncome: 463551, totalExpenses: 92473, net: 371077 },
        { month: 'Dec 2024', totalIncome: 305456, totalExpenses: 109743, net: 195713 },
        { month: 'Jan 2025', totalIncome: 335555, totalExpenses: 113937, net: 221618 },
        { month: 'Feb 2025', totalIncome: 360627, totalExpenses: 100188, net: 260439 },
        { month: 'Mar 2025', totalIncome: 323393, totalExpenses: 172550, net: 150843 },
        { month: 'Apr 2025', totalIncome: 341701, totalExpenses: 129274, net: 212427 },
        { month: 'May 2025', totalIncome: 318401, totalExpenses: 135197, net: 183203 },
        { month: 'Jun 2025', totalIncome: 380169, totalExpenses: 115528, net: 264641 },
        { month: 'Jul 2025', totalIncome: 425486, totalExpenses: 118457, net: 307029 },
        { month: 'Aug 2025', totalIncome: 421105, totalExpenses: 98112, net: 322993 },
        { month: 'Sep 2025', totalIncome: 366671, totalExpenses: 226209, net: 140461 },
      ],
      totals: {
        totalIncome: 4206645,
        totalExpenses: 1554992,
        netProfit: 2651650,
      },
    };

    // Fetch real data from QuickBooks for account details only
    const months = 12;
    const dateThreshold = new Date();
    dateThreshold.setMonth(dateThreshold.getMonth() - months);
    const dateString = dateThreshold.toISOString().split('T')[0];
    const currentDate = new Date().toISOString().split('T')[0];

    console.log('[accounting/data] Fetching QB account details from', dateString, 'to', currentDate);

    // Fetch companies
    const { data: companies, error: companiesError } = await supabase
      .schema('quickbooks')
      .from('qb_companies')
      .select('realm_id, company_name')
      .eq('is_deleted', false);

    if (companiesError) {
      console.error('[accounting/data] Companies error:', companiesError);
      return NextResponse.json({ error: 'Failed to fetch companies', details: companiesError }, { status: 500 });
    }

    // Fetch invoices (income)
    const { data: invoices, error: invoicesError } = await supabase
      .rpc('get_invoices_for_accounting', {
        start_date: dateString,
        end_date: currentDate
      });

    if (invoicesError) {
      console.error('[accounting/data] Invoices error:', invoicesError);
      return NextResponse.json({ error: 'Failed to fetch invoices', details: invoicesError }, { status: 500 });
    }

    // Fetch purchases (expenses)
    const { data: purchases, error: purchasesError } = await supabase
      .rpc('get_purchases_for_accounting', {
        start_date: dateString,
        end_date: currentDate
      });

    if (purchasesError) {
      console.error('[accounting/data] Purchases error:', purchasesError);
      return NextResponse.json({ error: 'Failed to fetch purchases', details: purchasesError }, { status: 500 });
    }

    console.log('[accounting/data] Fetched:', {
      companies: companies?.length,
      invoices: invoices?.length,
      purchases: purchases?.length
    });

    // Helper function to convert date to month key
    const getMonthKey = (dateStr: string) => {
      const date = new Date(dateStr);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    // Build QB account details by company and month
    const qbAccountsByCompany = new Map();

    companies?.forEach(company => {
      qbAccountsByCompany.set(company.company_name, new Map());
    });

    // Process invoices (income) - build account details by month
    invoices?.forEach((invoice: any) => {
      const monthKey = getMonthKey(invoice.txn_date);
      const companyName = companies?.find(c => c.realm_id === invoice.realm_id)?.company_name;

      if (!companyName) return;

      const companyMonths = qbAccountsByCompany.get(companyName);
      if (!companyMonths.has(monthKey)) {
        companyMonths.set(monthKey, {
          incomeAccountsMap: new Map(),
          expenseAccountsMap: new Map()
        });
      }

      const monthData = companyMonths.get(monthKey);
      const lineItems = invoice.line_items || [];

      lineItems.forEach((item: any) => {
        if (item.DetailType === 'SalesItemLineDetail' && item.SalesItemLineDetail?.ItemAccountRef) {
          const accountName = item.SalesItemLineDetail.ItemAccountRef.name || 'Unknown Income';
          const amount = parseFloat(item.Amount || '0');

          if (amount > 0) {
            const currentAmount = monthData.incomeAccountsMap.get(accountName) || 0;
            monthData.incomeAccountsMap.set(accountName, currentAmount + amount);
          }
        }
      });
    });

    // Process purchases (expenses) - build account details by month
    purchases?.forEach((purchase: any) => {
      const monthKey = getMonthKey(purchase.txn_date);
      const companyName = companies?.find(c => c.realm_id === purchase.realm_id)?.company_name;

      if (!companyName) return;

      const companyMonths = qbAccountsByCompany.get(companyName);
      if (!companyMonths.has(monthKey)) {
        companyMonths.set(monthKey, {
          incomeAccountsMap: new Map(),
          expenseAccountsMap: new Map()
        });
      }

      const monthData = companyMonths.get(monthKey);
      const lineItems = purchase.line_items || [];

      lineItems.forEach((item: any) => {
        if (item.DetailType === 'AccountBasedExpenseLineDetail' && item.AccountBasedExpenseLineDetail?.AccountRef) {
          const accountName = item.AccountBasedExpenseLineDetail.AccountRef.name || 'Unknown Expense';
          const amount = parseFloat(item.Amount || '0');

          if (amount > 0) {
            const currentAmount = monthData.expenseAccountsMap.get(accountName) || 0;
            monthData.expenseAccountsMap.set(accountName, currentAmount + amount);
          }
        }
      });
    });

    // Merge QB account details into hardcoded data
    const enrichMonth = (month: any, companyName: string) => {
      const monthKey = getMonthKey(month.month);
      const qbMonthData = qbAccountsByCompany.get(companyName)?.get(monthKey);

      if (qbMonthData) {
        const incomeAccounts = Array.from(qbMonthData.incomeAccountsMap.entries())
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount);

        const expenseAccounts = Array.from(qbMonthData.expenseAccountsMap.entries())
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount);

        return {
          ...month,
          accounts: {
            income: incomeAccounts,
            expenses: expenseAccounts
          }
        };
      }

      return {
        ...month,
        accounts: {
          income: [],
          expenses: []
        }
      };
    };

    // Build final response with hardcoded totals + real account details
    const abitibiEnriched = {
      ...abitibiHardcoded,
      months: abitibiHardcoded.months.map(m => enrichMonth(m, 'Les immeubles abitibi'))
    };

    const trilogisEnriched = {
      ...trilogisHardcoded,
      months: trilogisHardcoded.months.map(m => enrichMonth(m, 'Societe immobilière Tri-logis inc'))
    };

    const combined = {
      totalIncome: 7725059,
      totalExpenses: 4839166,
      netProfit: 2885891,
    };

    console.log('[accounting/data] Hybrid response ready: hardcoded totals + QB account details');

    return NextResponse.json({
      companies: [abitibiEnriched, trilogisEnriched],
      combined
    });
  } catch (error) {
    console.error('[accounting/data] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounting data', details: String(error) },
      { status: 500 }
    );
  }
}
