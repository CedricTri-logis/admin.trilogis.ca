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
import { RefreshCcw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn, formatDateOnly } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PAGE_SIZE_OPTIONS = [
  { value: "25", label: "25 rows" },
  { value: "50", label: "50 rows" },
  { value: "100", label: "100 rows" },
  { value: "500", label: "500 rows" },
]

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "voided", label: "Voided" },
]

type Invoice = {
  id: string
  apartment_id: string
  tenant_folder_id: string
  apartment_name: string
  tenant_name: string
  invoice_month: string
  amount: number
  status: string
  voided_at: string | null
  voided_reason: string | null
  source_type: string
  source_id: string
  created_at: string
  updated_at: string
}

type SortColumn = "apartment_name" | "tenant_name" | "invoice_month" | "amount" | "status"
type SortDirection = "asc" | "desc"

export default function InvoicesPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [rows, setRows] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortColumn, setSortColumn] = useState<SortColumn>("invoice_month")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [buildingFilter, setBuildingFilter] = useState<string>("all")
  const [apartmentFilter, setApartmentFilter] = useState<string>("all")
  const [tenantFilter, setTenantFilter] = useState<string>("all")
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([])
  const [apartments, setApartments] = useState<Array<{ id: string; name: string }>>([])
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([])

  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  // Fetch list of unique buildings that have invoices
  const fetchBuildings = async () => {
    try {
      const { data, error } = await supabase
        .schema("public")
        .from("buildings")
        .select("id, name")
        .order("name", { ascending: true })

      if (error) {
        console.error("Error fetching buildings:", error)
        setBuildings([])
      } else {
        setBuildings(data?.map(b => ({ id: b.id, name: b.name })) || [])
      }
    } catch (err) {
      console.error("Unexpected error fetching buildings:", err)
      setBuildings([])
    }
  }

  // Fetch apartments for selected building
  const fetchApartments = async (buildingId: string) => {
    try {
      const { data, error } = await supabase
        .schema("public")
        .from("apartments")
        .select("id, apartment_name")
        .eq("building_id", buildingId)
        .order("apartment_name", { ascending: true })

      if (error) {
        console.error("Error fetching apartments:", error)
        setApartments([])
      } else {
        setApartments(data?.map(a => ({ id: a.id, name: a.apartment_name })) || [])
      }
    } catch (err) {
      console.error("Unexpected error fetching apartments:", err)
      setApartments([])
    }
  }

  // Fetch tenants for selected apartment
  const fetchTenants = async (apartmentId: string) => {
    try {
      const { data, error } = await supabase
        .schema("long_term")
        .from("invoices")
        .select("tenant_folder_id, tenant_name")
        .eq("apartment_id", apartmentId)
        .order("tenant_name", { ascending: true })

      if (error) {
        console.error("Error fetching tenants:", error)
        setTenants([])
      } else {
        // Get unique tenants
        const uniqueTenants = Array.from(
          new Map(data?.map(item => [item.tenant_folder_id, item]) || []).values()
        ).map(item => ({
          id: item.tenant_folder_id,
          name: item.tenant_name
        }))
        setTenants(uniqueTenants)
      }
    } catch (err) {
      console.error("Unexpected error fetching tenants:", err)
      setTenants([])
    }
  }

  const fetchData = async () => {
    setIsFetching(true)
    try {
      // If building filter is active, first get apartment IDs for that building
      let apartmentIds: string[] | null = null
      if (buildingFilter !== "all") {
        const { data: apartmentsData, error: apartmentsError } = await supabase
          .schema("public")
          .from("apartments")
          .select("id")
          .eq("building_id", buildingFilter)

        if (apartmentsError) {
          console.error("Error fetching apartments for building:", apartmentsError)
          setRows([])
          setTotal(0)
          setIsLoading(false)
          setIsFetching(false)
          return
        }

        apartmentIds = apartmentsData?.map(a => a.id) || []

        // If no apartments in this building, return empty results
        if (apartmentIds.length === 0) {
          setRows([])
          setTotal(0)
          setIsLoading(false)
          setIsFetching(false)
          return
        }
      }

      // Build query
      let query = supabase
        .schema("long_term")
        .from("invoices")
        .select("*", { count: "exact" })

      // Apply status filter
      if (statusFilter === "active") {
        query = query.eq("status", "active")
      } else if (statusFilter === "voided") {
        query = query.eq("status", "voided")
      }

      // Apply building filter (using apartment IDs)
      if (apartmentIds && apartmentIds.length > 0) {
        query = query.in("apartment_id", apartmentIds)
      }

      // Apply apartment filter
      if (apartmentFilter !== "all") {
        query = query.eq("apartment_id", apartmentFilter)
      }

      // Apply tenant filter
      if (tenantFilter !== "all") {
        query = query.eq("tenant_folder_id", tenantFilter)
      }

      // Apply sorting
      query = query.order(sortColumn, { ascending: sortDirection === "asc" })

      // Apply pagination
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching invoices:", error)
        setRows([])
        setTotal(0)
      } else {
        setRows((data || []) as Invoice[])
        setTotal(count || 0)
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

  // Fetch buildings on mount
  useEffect(() => {
    fetchBuildings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch apartments when building changes
  useEffect(() => {
    if (buildingFilter !== "all") {
      fetchApartments(buildingFilter)
    } else {
      setApartments([])
      setApartmentFilter("all")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingFilter])

  // Fetch tenants when apartment changes
  useEffect(() => {
    if (apartmentFilter !== "all") {
      fetchTenants(apartmentFilter)
    } else {
      setTenants([])
      setTenantFilter("all")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apartmentFilter])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, buildingFilter, apartmentFilter, tenantFilter, sortColumn, sortDirection])

  const pageCount = total > 0 ? Math.ceil(total / pageSize) : 1
  const canPrevious = page > 1
  const canNext = total > page * pageSize

  const handleSort = (column: SortColumn) => {
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

  const SortIcon = ({ column }: { column: SortColumn }) => {
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
            <CardTitle className="text-xl">Long-Term Invoices</CardTitle>
            <CardDescription>
              View all invoices from the long_term.invoices table.
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
            <Select value={buildingFilter} onValueChange={(value) => {
              setBuildingFilter(value)
              setApartmentFilter("all")
              setTenantFilter("all")
              setPage(1)
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by building" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                {buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={apartmentFilter}
              onValueChange={(value) => {
                setApartmentFilter(value)
                setTenantFilter("all")
                setPage(1)
              }}
              disabled={buildingFilter === "all"}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={buildingFilter === "all" ? "Select building first" : "Filter by apartment"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Apartments</SelectItem>
                {apartments.map((apartment) => (
                  <SelectItem key={apartment.id} value={apartment.id}>
                    {apartment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={tenantFilter}
              onValueChange={(value) => {
                setTenantFilter(value)
                setPage(1)
              }}
              disabled={apartmentFilter === "all"}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={apartmentFilter === "all" ? "Select apartment first" : "Filter by tenant"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={pageSize.toString()} onValueChange={(value) => {
              setPageSize(Number(value))
              setPage(1)
            }}>
              <SelectTrigger className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              {total} total invoice{total !== 1 ? 's' : ''} • Page {page} of {pageCount}
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("apartment_name")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Apartment
                      <SortIcon column="apartment_name" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[200px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("tenant_name")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Tenant
                      <SortIcon column="tenant_name" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("invoice_month")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Invoice Month
                      <SortIcon column="invoice_month" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[120px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("amount")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Amount
                      <SortIcon column="amount" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px]">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("status")}
                      className="h-auto p-0 hover:bg-transparent"
                    >
                      Status
                      <SortIcon column="status" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[120px]">Voided At</TableHead>
                  <TableHead className="w-[200px]">Voided Reason</TableHead>
                  <TableHead className="w-[120px]">Source Type</TableHead>
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
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.apartment_name}
                      </TableCell>
                      <TableCell>{row.tenant_name}</TableCell>
                      <TableCell>{formatDateOnly(row.invoice_month)}</TableCell>
                      <TableCell className="text-right">
                        ${row.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                            row.status === "active" && "bg-green-100 text-green-800",
                            row.status === "voided" && "bg-red-100 text-red-800"
                          )}
                        >
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {row.voided_at ? formatDateOnly(row.voided_at) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.voided_reason || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.source_type}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No invoices found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {rows.length > 0
                ? `Showing ${(page - 1) * pageSize + 1} to ${(page - 1) * pageSize + rows.length} of ${total} invoices`
                : "Showing 0 of 0 invoices"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={!canPrevious || isFetching}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => canNext && setPage((prev) => prev + 1)}
                disabled={!canNext || isFetching}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
