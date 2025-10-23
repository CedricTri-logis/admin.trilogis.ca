"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReceivablesDataPoint } from "@/types/receivables"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts'

interface ProgressionChartProps {
  data: ReceivablesDataPoint[]
  period: 'daily' | 'weekly' | 'monthly'
  isLoading: boolean
}

export function ProgressionChart({ data, period, isLoading }: ProgressionChartProps) {

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    if (period === 'daily') {
      return d.toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' })
    } else if (period === 'weekly') {
      return `S${Math.ceil(d.getDate() / 7)}`
    } else {
      return d.toLocaleDateString('fr-CA', { month: 'short' })
    }
  }

  // Reverse data for chronological order in chart (oldest to newest)
  const chartData = [...data].reverse().map(point => ({
    date: formatDate(point.date),
    fullDate: point.period_label || point.date,
    receivables: point.total_receivables,
    payments: point.payment_amount,
    newInvoices: point.invoice_amount,
  }))

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Évolution des Comptes à Recevoir</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Évolution des Comptes à Recevoir</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value)}
              label={{ value: 'Comptes à Recevoir', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value)}
              label={{ value: 'Paiements / Factures', angle: 90, position: 'insideRight', style: { fontSize: 12 } }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null

                return (
                  <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                    <p className="font-semibold text-sm mb-2">{payload[0].payload.fullDate}</p>
                    {payload.map((entry, index) => (
                      <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {formatCurrency(Number(entry.value))}
                      </p>
                    ))}
                  </div>
                )
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="receivables"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Comptes à Recevoir"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Bar
              yAxisId="right"
              dataKey="payments"
              fill="#10b981"
              name="Paiements Reçus"
              opacity={0.8}
            />
            <Bar
              yAxisId="right"
              dataKey="newInvoices"
              fill="#f59e0b"
              name="Nouvelles Factures"
              opacity={0.8}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
