"use client"

import { useState, useEffect } from "react"
import { ReceivablesPeriod, ReceivablesResponse } from "@/types/receivables"
import { ProgressionSummaryCards } from "@/components/collecte/ProgressionSummaryCards"
import { ProgressionPeriodSelector } from "@/components/collecte/ProgressionPeriodSelector"
import { ProgressionDataTable } from "@/components/collecte/ProgressionDataTable"
import { ProgressionChart } from "@/components/collecte/ProgressionChart"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import toast from "react-hot-toast"

export default function ProgressionPage() {
  const [period, setPeriod] = useState<ReceivablesPeriod>('daily')
  const [range, setRange] = useState(7)
  const [data, setData] = useState<ReceivablesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/collecte/progression?period=${period}&range=${range}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors du chargement des données')
      }

      const result: ReceivablesResponse = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching progression data:', error)
      toast.error('Erreur lors du chargement des données')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [period, range])

  const handlePeriodChange = (newPeriod: ReceivablesPeriod) => {
    setPeriod(newPeriod)
    // Set default range based on period
    if (newPeriod === 'daily') setRange(7)
    else if (newPeriod === 'weekly') setRange(4)
    else setRange(3)
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Progression des Comptes à Recevoir</h2>
          <p className="text-muted-foreground">
            Suivez l'évolution de vos comptes à recevoir par jour, semaine ou mois
          </p>
        </div>
        <Button
          onClick={fetchData}
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <ProgressionPeriodSelector
        period={period}
        range={range}
        onPeriodChange={handlePeriodChange}
        onRangeChange={setRange}
      />

      <ProgressionSummaryCards data={data} isLoading={isLoading} />

      <ProgressionChart
        data={data?.data || []}
        period={period}
        isLoading={isLoading}
      />

      <ProgressionDataTable
        data={data?.data || []}
        period={period}
        isLoading={isLoading}
      />
    </div>
  )
}
