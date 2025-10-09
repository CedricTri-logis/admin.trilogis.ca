"use client"

import { useState, useEffect, useMemo } from "react"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { RefreshCcw, FolderOpen, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation"

const PAGE_SIZE = 50

const MATCH_STATUS_OPTIONS = [
  { value: "all", label: "Tous les statuts" },
  { value: "matched", label: "Matched" },
  { value: "matched_multiple", label: "Matched Multiple" },
  { value: "amount_mismatch", label: "Amount Mismatch" },
  { value: "service_mismatched", label: "Service Mismatched" },
  { value: "no_qb_invoice", label: "No QB Invoice" },
  { value: "lt_voided", label: "LT Voided" },
]

const QB_ID_FILTER_OPTIONS = [
  { value: "all", label: "All Customers" },
  { value: "with_qb_id", label: "With QB ID" },
  { value: "without_qb_id", label: "Without QB ID" },
]

const DATE_RANGE_PRESETS = [
  { value: "all", label: "All Time" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
]

// Helper function to calculate date ranges
function getDateRangeFromPreset(preset: string): { start: string | null; end: string | null } {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  switch (preset) {
    case "last_month": {
      const lastMonth = new Date(year, month - 1, 1)
      const lastMonthEnd = new Date(year, month, 0)
      return {
        start: lastMonth.toISOString().split('T')[0],
        end: lastMonthEnd.toISOString().split('T')[0]
      }
    }
    case "last_3_months": {
      const threeMonthsAgo = new Date(year, month - 3, 1)
      return {
        start: threeMonthsAgo.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      }
    }
    case "last_6_months": {
      const sixMonthsAgo = new Date(year, month - 6, 1)
      return {
        start: sixMonthsAgo.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      }
    }
    case "this_year": {
      const yearStart = new Date(year, 0, 1)
      return {
        start: yearStart.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      }
    }
    default:
      return { start: null, end: null }
  }
}

type CustomerGroup = {
  qb_customer_id: string | null
  qb_customer_name: string | null
  qb_customer_qb_id: string | null
  total_invoices: number
  total_amount: number
  match_statuses: string[]
  lease_start_date: string | null
  apartment_names: string[]
}

export default function QuickBooksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL params
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<CustomerGroup[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [matchStatusFilter, setMatchStatusFilter] = useState<string>(searchParams.get("status") || "all")
  const [qbIdFilter, setQbIdFilter] = useState<string>(searchParams.get("qb_id") || "all")
  const [dateRangePreset, setDateRangePreset] = useState<string>(searchParams.get("date_preset") || "all")
  const [startDate, setStartDate] = useState<string | null>(searchParams.get("start_date"))
  const [endDate, setEndDate] = useState<string | null>(searchParams.get("end_date"))
  const [excludeTrilogis, setExcludeTrilogis] = useState<boolean>(searchParams.get("exclude_trilogis") === "true")
  const [sortColumn, setSortColumn] = useState<keyof CustomerGroup | null>("qb_customer_name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const fetchData = async () => {
    setIsFetching(true)
    try {
      // Use RPC to call the database function for server-side aggregation
      const { data, error } = await supabase
        .schema("integration")
        .rpc("get_qb_customers_grouped", {
          p_match_status: matchStatusFilter === "all" ? null : matchStatusFilter,
          p_qb_id_filter: qbIdFilter === "all" ? null : qbIdFilter,
          p_start_date: startDate,
          p_end_date: endDate,
          p_exclude_trilogis: excludeTrilogis,
          p_limit: PAGE_SIZE,
          p_offset: (page - 1) * PAGE_SIZE,
          p_sort_column: sortColumn || "qb_customer_name",
          p_sort_direction: sortDirection,
        })

      // Get total count for pagination
      const { data: countData, error: countError } = await supabase
        .schema("integration")
        .rpc("get_qb_customers_count", {
          p_match_status: matchStatusFilter === "all" ? null : matchStatusFilter,
          p_qb_id_filter: qbIdFilter === "all" ? null : qbIdFilter,
          p_start_date: startDate,
          p_end_date: endDate,
          p_exclude_trilogis: excludeTrilogis,
        })

      if (error || countError) {
        console.error("Error fetching data:", error || countError)
        setRows([])
        setTotal(0)
      } else {
        setRows((data || []) as CustomerGroup[])
        setTotal((countData as number) || 0)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setRows([])
      setTotal(0)
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, matchStatusFilter, qbIdFilter, startDate, endDate, excludeTrilogis, sortColumn, sortDirection])

  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1
  const canPrevious = page > 1
  const canNext = total > page * PAGE_SIZE

  const handleRowClick = (customerId: string | null) => {
    if (customerId) {
      const params = new URLSearchParams()
      if (matchStatusFilter !== "all") {
        params.set("status", matchStatusFilter)
      }
      const queryString = params.toString()
      router.push(`/integration/quickbooks/${customerId}${queryString ? `?${queryString}` : ''}`)
    }
  }

  const handleSort = (column: keyof CustomerGroup) => {
    if (sortColumn === column) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // New column, default to ascending
      setSortColumn(column)
      setSortDirection("asc")
    }
    setPage(1) // Reset to first page when sorting
  }

  const updateUrlWithFilters = (datePreset?: string, start?: string | null, end?: string | null) => {
    const params = new URLSearchParams()
    if (matchStatusFilter !== "all") params.set("status", matchStatusFilter)
    if (qbIdFilter !== "all") params.set("qb_id", qbIdFilter)
    if (datePreset && datePreset !== "all") params.set("date_preset", datePreset)
    if (start) params.set("start_date", start)
    if (end) params.set("end_date", end)
    if (excludeTrilogis) params.set("exclude_trilogis", "true")
    router.push(`/integration/quickbooks${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const handleDatePresetChange = (preset: string) => {
    setDateRangePreset(preset)
    setPage(1)

    if (preset === "all" || preset === "custom") {
      if (preset === "all") {
        setStartDate(null)
        setEndDate(null)
        updateUrlWithFilters("all", null, null)
      }
      // For custom, don't update dates here - wait for user to select dates
    } else {
      const { start, end } = getDateRangeFromPreset(preset)
      setStartDate(start)
      setEndDate(end)
      updateUrlWithFilters(preset, start, end)
    }
  }

  const handleCustomDateChange = (start: string | null, end: string | null) => {
    // Validate: start_date <= end_date
    if (start && end && start > end) {
      console.error("Start date must be before or equal to end date")
      return
    }
    setStartDate(start)
    setEndDate(end)
    setPage(1)
    updateUrlWithFilters("custom", start, end)
  }

  const clearDates = () => {
    setDateRangePreset("all")
    setStartDate(null)
    setEndDate(null)
    setPage(1)
    updateUrlWithFilters("all", null, null)
  }

  const SortIcon = ({ column }: { column: keyof CustomerGroup }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">QuickBooks Reconciliation</CardTitle>
            <CardDescription>
              View and manage QuickBooks invoice reconciliation grouped by customer.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={fetchData}
              disabled={isFetching}
            >
              <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")}
                aria-label="Refresh"
              />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={matchStatusFilter} onValueChange={(value) => {
              setMatchStatusFilter(value)
              setPage(1)
              const params = new URLSearchParams()
              if (value !== "all") {
                params.set("status", value)
              }
              if (qbIdFilter !== "all") {
                params.set("qb_id", qbIdFilter)
              }
              router.push(`/integration/quickbooks${params.toString() ? `?${params.toString()}` : ''}`)
            }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                {MATCH_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={qbIdFilter} onValueChange={(value) => {
              setQbIdFilter(value)
              setPage(1)
              const params = new URLSearchParams()
              if (matchStatusFilter !== "all") {
                params.set("status", matchStatusFilter)
              }
              if (value !== "all") {
                params.set("qb_id", value)
              }
              router.push(`/integration/quickbooks${params.toString() ? `?${params.toString()}` : ''}`)
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by QB ID" />
              </SelectTrigger>
              <SelectContent>
                {QB_ID_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRangePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGE_PRESETS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dateRangePreset === "custom" && (
              <>
                <input
                  type="date"
                  value={startDate || ""}
                  onChange={(e) => handleCustomDateChange(e.target.value || null, endDate)}
                  className="px-3 py-2 border rounded-md text-sm"
                  placeholder="Start Date"
                />
                <input
                  type="date"
                  value={endDate || ""}
                  onChange={(e) => handleCustomDateChange(startDate, e.target.value || null)}
                  className="px-3 py-2 border rounded-md text-sm"
                  placeholder="End Date"
                />
              </>
            )}
            {(startDate || endDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearDates}
              >
                Clear Dates
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="exclude-trilogis"
                checked={excludeTrilogis}
                onCheckedChange={(checked) => {
                  setExcludeTrilogis(checked === true)
                  setPage(1)
                  updateUrlWithFilters()
                }}
              />
              <label
                htmlFor="exclude-trilogis"
                className="text-sm cursor-pointer select-none"
              >
                Exclude Tri-Logis Inc.
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              {total} clients • Page {page} of {pageCount}
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("qb_customer_name")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Customer Name
                      <SortIcon column="qb_customer_name" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[250px]">Apartments</TableHead>
                  <TableHead className="w-[100px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("qb_customer_qb_id")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      QB ID
                      <SortIcon column="qb_customer_qb_id" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[250px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("qb_customer_id")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Customer ID (UUID)
                      <SortIcon column="qb_customer_id" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("lease_start_date")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Start Date
                      <SortIcon column="lease_start_date" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("total_invoices")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Invoices
                      <SortIcon column="total_invoices" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[150px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("total_amount")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Total Amount
                      <SortIcon column="total_amount" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[200px]">Match Statuses</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(10)].map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow
                      key={row.qb_customer_id || "no_customer"}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(row.qb_customer_id)}
                    >
                      <TableCell className="font-medium">
                        {row.qb_customer_name || "No Customer Name"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.apartment_names.length > 0 ? row.apartment_names.join(", ") : "N/A"}
                      </TableCell>
                      <TableCell>{row.qb_customer_qb_id || "N/A"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {row.qb_customer_id || "N/A"}
                      </TableCell>
                      <TableCell>{row.lease_start_date || "N/A"}</TableCell>
                      <TableCell className="text-center">{row.total_invoices}</TableCell>
                      <TableCell className="text-right">
                        ${row.total_amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.match_statuses.map((status) => (
                            <span
                              key={status}
                              className={cn(
                                "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                status === "matched" && "bg-green-100 text-green-800",
                                status === "matched_multiple" && "bg-blue-100 text-blue-800",
                                status === "amount_mismatch" && "bg-yellow-100 text-yellow-800",
                                status === "service_mismatched" && "bg-purple-100 text-purple-800",
                                status === "no_qb_invoice" && "bg-orange-100 text-orange-800",
                                status === "lt_voided" && "bg-gray-100 text-gray-800"
                              )}
                            >
                              {status}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRowClick(row.qb_customer_id)
                          }}
                        >
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      Aucun client trouvé.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {rows.length > 0
                ? `Affichage de ${(page - 1) * PAGE_SIZE + 1} à ${(page - 1) * PAGE_SIZE + rows.length} sur ${total} clients`
                : "Affichage de 0 sur 0 clients"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={!canPrevious || isFetching}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => canNext && setPage((prev) => prev + 1)}
                disabled={!canNext || isFetching}
              >
                Suivant
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
