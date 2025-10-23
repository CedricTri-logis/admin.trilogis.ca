import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReceivablesDataPoint } from "@/types/receivables"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

interface ProgressionDataTableProps {
  data: ReceivablesDataPoint[]
  period: 'daily' | 'weekly' | 'monthly'
  isLoading: boolean
}

export function ProgressionDataTable({ data, period, isLoading }: ProgressionDataTableProps) {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: string, periodLabel?: string) => {
    if (periodLabel) return periodLabel

    const d = new Date(date)
    if (period === 'daily') {
      return d.toLocaleDateString('fr-CA', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } else if (period === 'weekly') {
      return `Semaine du ${d.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' })}`
    } else {
      return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'long' })
    }
  }

  const ChangeIndicator = ({ change, changePct }: { change: number | null, changePct: number | null }) => {
    if (change === null || change === 0) {
      return (
        <div className="flex items-center gap-1 text-gray-500">
          <Minus className="h-3 w-3" />
          <span>-</span>
        </div>
      )
    }

    const isNegative = change < 0
    const color = isNegative ? 'text-green-600' : 'text-red-600'
    const Icon = isNegative ? ArrowDown : ArrowUp

    return (
      <div className={`flex items-center gap-1 ${color}`}>
        <Icon className="h-3 w-3" />
        <span className="font-medium">{formatCurrency(Math.abs(change))}</span>
        {changePct !== null && (
          <span className="text-xs">({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)</span>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Détails de la Progression</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Détails de la Progression</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Comptes à Recevoir</TableHead>
                <TableHead className="text-right">Changement</TableHead>
                <TableHead className="text-right">Factures</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead className="text-right">Paiements</TableHead>
                <TableHead className="text-right">Nouvelles Factures</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucune donnée disponible
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {formatDate(row.date, row.period_label)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(row.total_receivables)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChangeIndicator change={row.daily_change} changePct={row.daily_change_pct} />
                    </TableCell>
                    <TableCell className="text-right">
                      {row.outstanding_invoices.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.customers_with_balance.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.payments_made > 0 ? (
                        <div className="text-green-600">
                          {row.payments_made} ({formatCurrency(row.payment_amount)})
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.invoices_created > 0 ? (
                        <div>
                          {row.invoices_created} ({formatCurrency(row.invoice_amount)})
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
