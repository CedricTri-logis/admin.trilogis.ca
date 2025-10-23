import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReceivablesPeriod } from "@/types/receivables"

interface ProgressionPeriodSelectorProps {
  period: ReceivablesPeriod
  range: number
  onPeriodChange: (period: ReceivablesPeriod) => void
  onRangeChange: (range: number) => void
}

export function ProgressionPeriodSelector({
  period,
  range,
  onPeriodChange,
  onRangeChange
}: ProgressionPeriodSelectorProps) {

  const rangeOptions = {
    daily: [
      { value: '7', label: '7 derniers jours' },
      { value: '14', label: '14 derniers jours' },
      { value: '30', label: '30 derniers jours' },
      { value: '60', label: '60 derniers jours' },
      { value: '90', label: '90 derniers jours' },
    ],
    weekly: [
      { value: '4', label: '4 dernières semaines' },
      { value: '8', label: '8 dernières semaines' },
      { value: '12', label: '12 dernières semaines' },
      { value: '26', label: '26 dernières semaines' },
    ],
    monthly: [
      { value: '3', label: '3 derniers mois' },
      { value: '6', label: '6 derniers mois' },
      { value: '12', label: '12 derniers mois' },
      { value: '24', label: '24 derniers mois' },
    ],
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <Tabs value={period} onValueChange={(v) => onPeriodChange(v as ReceivablesPeriod)}>
        <TabsList>
          <TabsTrigger value="daily">Par Jour</TabsTrigger>
          <TabsTrigger value="weekly">Par Semaine</TabsTrigger>
          <TabsTrigger value="monthly">Par Mois</TabsTrigger>
        </TabsList>
      </Tabs>

      <Select value={range.toString()} onValueChange={(v) => onRangeChange(parseInt(v))}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Sélectionner la période" />
        </SelectTrigger>
        <SelectContent>
          {rangeOptions[period].map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
