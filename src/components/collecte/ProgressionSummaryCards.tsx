import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DollarSign, TrendingDown, TrendingUp, Users, FileText } from "lucide-react"
import { ReceivablesResponse } from "@/types/receivables"

interface ProgressionSummaryCardsProps {
  data: ReceivablesResponse | null
  isLoading: boolean
}

export function ProgressionSummaryCards({ data, isLoading }: ProgressionSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chargement...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 animate-pulse rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!data) return null

  const { summary } = data

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercent = (pct: number) => {
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
  }

  const periodLabel = data.period === 'daily' ? 'jour' : data.period === 'weekly' ? 'semaine' : 'mois'

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Receivables */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Comptes à Recevoir
          </CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.current_receivables)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            {summary.current_outstanding_invoices.toLocaleString()} factures · {summary.current_customers_with_balance} clients
          </p>
        </CardContent>
      </Card>

      {/* Period Change */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Changement ({periodLabel})
          </CardTitle>
          {summary.period_change < 0 ? (
            <TrendingDown className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingUp className="h-4 w-4 text-red-600" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${summary.period_change < 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(Math.abs(summary.period_change))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatPercent(summary.period_change_pct)} {summary.period_change < 0 ? 'diminution' : 'augmentation'}
          </p>
        </CardContent>
      </Card>

      {/* Payments Received */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Paiements Reçus
          </CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(summary.total_payments)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Durant la période
          </p>
        </CardContent>
      </Card>

      {/* New Invoices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Nouvelles Factures
          </CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCurrency(summary.total_new_invoices)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Durant la période
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
