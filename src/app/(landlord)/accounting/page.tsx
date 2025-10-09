'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

interface AccountDetail {
  name: string;
  amount: number;
}

interface MonthlyData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  accounts?: {
    income: AccountDetail[];
    expenses: AccountDetail[];
  };
}

interface AccountSummaryItem {
  name: string;
  total: number;
  percentage: number;
}

interface CompanyData {
  name: string;
  months: MonthlyData[];
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  accountSummary?: {
    topIncomeAccounts: AccountSummaryItem[];
    topExpenseAccounts: AccountSummaryItem[];
  };
}

interface AccountingData {
  companies: CompanyData[];
  combined: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
}

export default function AccountingPage() {
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAccountingData();
  }, []);

  const fetchAccountingData = async () => {
    try {
      const response = await fetch('/api/accounting/data');
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching accounting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const toggleMonthExpansion = (month: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(month)) {
      newExpanded.delete(month);
    } else {
      newExpanded.add(month);
    }
    setExpandedMonths(newExpanded);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-gray-600">No accounting data available</p>
      </div>
    );
  }

  // Get the selected company data or combined data
  const displayData = selectedCompany === 'all'
    ? data.companies.reduce((acc, company) => {
        const months = company.months.map((m, idx) => {
          const existing = acc[idx] || { month: m.month, totalIncome: 0, totalExpenses: 0, net: 0 };
          return {
            month: m.month,
            totalIncome: existing.totalIncome + m.totalIncome,
            totalExpenses: existing.totalExpenses + m.totalExpenses,
            net: existing.net + m.net
          };
        });
        return months;
      }, [] as MonthlyData[])
    : data.companies.find(c => c.name === selectedCompany)?.months || [];

  const displayTotals = selectedCompany === 'all'
    ? data.combined
    : data.companies.find(c => c.name === selectedCompany)?.totals || data.combined;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Accounting Dashboard</h1>
          <p className="text-gray-600 mt-1">Last 12 Months Financial Overview</p>
        </div>
      </div>

      {/* Company Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedCompany('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCompany === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Combined Totals
        </button>
        {data.companies.map(company => (
          <button
            key={company.name}
            onClick={() => setSelectedCompany(company.name)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCompany === company.name
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {company.name}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-green-600">
                  {formatCurrency(displayTotals.totalIncome)}
                </span>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-2xl font-bold text-red-600">
                  {formatCurrency(displayTotals.totalExpenses)}
                </span>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Net Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-2xl font-bold ${
                  displayTotals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(displayTotals.netProfit)}
                </span>
              </div>
              <DollarSign className={`h-8 w-8 ${
                displayTotals.netProfit >= 0 ? 'text-green-500' : 'text-red-500'
              }`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Income vs Expenses - Monthly Trend</CardTitle>
          <p className="text-sm text-gray-600">
            {selectedCompany === 'all' ? 'Combined' : selectedCompany} - Last 12 Months
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              <Bar dataKey="totalIncome" fill="#10b981" name="Total Income" />
              <Bar dataKey="totalExpenses" fill="#ef4444" name="Total Expenses" />
              <Line
                type="monotone"
                dataKey="net"
                stroke="#3b82f6"
                strokeWidth={3}
                name="Net Profit/Loss"
                dot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Net Profit/Loss Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Net Profit/Loss by Month</CardTitle>
          <p className="text-sm text-gray-600">
            Positive values indicate profit, negative values indicate loss
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Legend />
              <Bar
                dataKey="net"
                fill="#3b82f6"
                name="Net Profit/Loss"
                // Color bars based on positive/negative
                shape={(props: any) => {
                  const { x, y, width, height, payload } = props;
                  const fill = payload.net >= 0 ? '#10b981' : '#ef4444';
                  return (
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={fill}
                    />
                  );
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Details Table with Account Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
          <p className="text-sm text-gray-600">Click on a month to see account details</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium">Month</th>
                  <th className="text-right py-3 px-4 font-medium">Total Income</th>
                  <th className="text-right py-3 px-4 font-medium">Total Expenses</th>
                  <th className="text-right py-3 px-4 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((row, index) => {
                  const isExpanded = expandedMonths.has(row.month);
                  const hasAccounts = row.accounts && (row.accounts.income.length > 0 || row.accounts.expenses.length > 0);

                  return (
                    <React.Fragment key={index}>
                      <tr
                        className={`border-b hover:bg-gray-50 ${hasAccounts ? 'cursor-pointer' : ''}`}
                        onClick={() => hasAccounts && toggleMonthExpansion(row.month)}
                      >
                        <td className="py-3 px-4 font-medium">
                          {hasAccounts && (
                            <span className="mr-2">{isExpanded ? '▼' : '▶'}</span>
                          )}
                          {row.month}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600">
                          {formatCurrency(row.totalIncome)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600">
                          {formatCurrency(row.totalExpenses)}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${
                          row.net >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(row.net)}
                        </td>
                      </tr>

                      {/* Expanded Account Details */}
                      {isExpanded && hasAccounts && (
                        <tr className="bg-gray-50">
                          <td colSpan={4} className="py-4 px-4">
                            <div className="grid grid-cols-2 gap-6">
                              {/* Income Accounts */}
                              {row.accounts!.income.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-green-700 mb-2">Income Accounts</h4>
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {row.accounts!.income.map((account, idx) => (
                                        <tr key={idx} className="border-b border-gray-200">
                                          <td className="py-2 px-2">{account.name}</td>
                                          <td className="py-2 px-2 text-right text-green-600 font-medium">
                                            {formatCurrency(account.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Expense Accounts */}
                              {row.accounts!.expenses.length > 0 && (
                                <div>
                                  <h4 className="font-semibold text-red-700 mb-2">Expense Accounts</h4>
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {row.accounts!.expenses.map((account, idx) => (
                                        <tr key={idx} className="border-b border-gray-200">
                                          <td className="py-2 px-2">{account.name}</td>
                                          <td className="py-2 px-2 text-right text-red-600 font-medium">
                                            {formatCurrency(account.amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                  <td className="py-3 px-4">TOTAL</td>
                  <td className="py-3 px-4 text-right text-green-600">
                    {formatCurrency(displayTotals.totalIncome)}
                  </td>
                  <td className="py-3 px-4 text-right text-red-600">
                    {formatCurrency(displayTotals.totalExpenses)}
                  </td>
                  <td className={`py-3 px-4 text-right ${
                    displayTotals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(displayTotals.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Account Summary Section - Only show for individual companies */}
      {selectedCompany !== 'all' && data.companies.find(c => c.name === selectedCompany)?.accountSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Income Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-green-700">Top Income Accounts</CardTitle>
              <p className="text-sm text-gray-600">Breakdown by account type</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.companies.find(c => c.name === selectedCompany)?.accountSummary?.topIncomeAccounts.map((account, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{account.name}</p>
                      <p className="text-xs text-gray-600">{account.percentage}% of total income</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700">{formatCurrency(account.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Expense Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-700">Top Expense Accounts</CardTitle>
              <p className="text-sm text-gray-600">Breakdown by account type</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.companies.find(c => c.name === selectedCompany)?.accountSummary?.topExpenseAccounts.map((account, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{account.name}</p>
                      <p className="text-xs text-gray-600">{account.percentage}% of total expenses</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-700">{formatCurrency(account.total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Company Comparison (only show when "all" is selected) */}
      {selectedCompany === 'all' && (
        <Card>
          <CardHeader>
            <CardTitle>Company Comparison</CardTitle>
            <p className="text-sm text-gray-600">Total performance by company</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-right py-3 px-4 font-medium">Total Income</th>
                    <th className="text-right py-3 px-4 font-medium">Total Expenses</th>
                    <th className="text-right py-3 px-4 font-medium">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.companies.map((company, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{company.name}</td>
                      <td className="py-3 px-4 text-right text-green-600">
                        {formatCurrency(company.totals.totalIncome)}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600">
                        {formatCurrency(company.totals.totalExpenses)}
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        company.totals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(company.totals.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
