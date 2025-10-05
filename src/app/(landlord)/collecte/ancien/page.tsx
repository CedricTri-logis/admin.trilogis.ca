"use client"

import { useState, useEffect } from "react"
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
import { RefreshCcw, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
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

type CollecteRow = {
  id: string
  apartment_folder: string
  tenant_names: string[]
  qb_balance: number | null
  lease_start_date: string
  has_tal_dossier: boolean
  monthly_rent: number | null
}

type SortColumn = "apartment_folder" | "qb_balance" | "lease_start_date" | "monthly_rent"
type SortDirection = "asc" | "desc" | null

export default function CollecteAncienPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [rows, setRows] = useState<CollecteRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>("apartment_folder")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const supabase = createSupabaseBrowserClient()

  const fetchData = async () => {
    setIsFetching(true)
    try {
      // Get all collecte records
      const { data: allCollecte, error: collecteError } = await supabase
        .schema("integration")
        .from("collecte")
        .select("*")
        .not("apartment_folder", "is", null)
        .not("lease_start_date", "is", null)
        .order("apartment_folder", { ascending: true })
        .order("lease_start_date", { ascending: false })

      if (collecteError) {
        console.error("Error fetching collecte:", collecteError)
        setRows([])
        setTotal(0)
        return
      }

      if (!allCollecte || allCollecte.length === 0) {
        setRows([])
        setTotal(0)
        return
      }

      // Group by apartment_folder and get all except the most recent
      const folderMap = new Map<string, typeof allCollecte[0][]>()
      allCollecte.forEach(folder => {
        if (!folderMap.has(folder.apartment_folder)) {
          folderMap.set(folder.apartment_folder, [])
        }
        folderMap.get(folder.apartment_folder)!.push(folder)
      })

      const previousLeases: typeof allCollecte = []
      folderMap.forEach(folders => {
        // Skip the first one (most recent) and add the rest
        if (folders.length > 1) {
          previousLeases.push(...folders.slice(1))
        }
      })

      // Get TAL dossiers for these tenant folders
      const tenantFolderIds = previousLeases.map(f => f.tenant_folder_id)
      const { data: talDossiers } = await supabase
        .schema("integration")
        .from("apartments_tal_dossiers")
        .select("tenant_folder_id")
        .in("tenant_folder_id", tenantFolderIds)

      const talDossierSet = new Set(talDossiers?.map(d => d.tenant_folder_id) || [])

      // Get monthly rent from leases and renewals
      const tenantFolderIdsForRent = previousLeases.map(f => f.tenant_folder_id)
      const { data: leasesData } = await supabase
        .schema("long_term")
        .from("leases")
        .select("tenant_folder_id, lease_start_date, monthly_rent")
        .in("tenant_folder_id", tenantFolderIdsForRent)

      const { data: renewalsData } = await supabase
        .schema("long_term")
        .from("renewals")
        .select("tenant_folder_id, renewal_start_date, monthly_rent")
        .in("tenant_folder_id", tenantFolderIdsForRent)

      // Build a map of most recent monthly rent for each tenant folder
      const monthlyRentMap = new Map<string, number | null>()
      tenantFolderIdsForRent.forEach(folderId => {
        const leases = leasesData?.filter(l => l.tenant_folder_id === folderId) || []
        const renewals = renewalsData?.filter(r => r.tenant_folder_id === folderId) || []

        // Combine and sort by date
        const allRents: Array<{ date: string; rent: number | null }> = [
          ...leases.map(l => ({ date: l.lease_start_date, rent: l.monthly_rent })),
          ...renewals.map(r => ({ date: r.renewal_start_date, rent: r.monthly_rent }))
        ].sort((a, b) => b.date.localeCompare(a.date)) // Most recent first

        monthlyRentMap.set(folderId, allRents.length > 0 ? allRents[0].rent : null)
      })

      // Map the data
      let mappedData: CollecteRow[] = previousLeases.map(folder => ({
        id: folder.id,
        apartment_folder: folder.apartment_folder,
        tenant_names: folder.tenant_names || [],
        qb_balance: folder.qb_balance,
        lease_start_date: folder.lease_start_date,
        has_tal_dossier: talDossierSet.has(folder.tenant_folder_id),
        monthly_rent: monthlyRentMap.get(folder.tenant_folder_id) || null
      }))

      // Apply sorting
      if (sortColumn && sortDirection) {
        mappedData.sort((a, b) => {
          let aVal = a[sortColumn]
          let bVal = b[sortColumn]

          if (aVal === null) aVal = ""
          if (bVal === null) bVal = ""

          if (sortDirection === "asc") {
            return aVal > bVal ? 1 : -1
          } else {
            return aVal < bVal ? 1 : -1
          }
        })
      }

      // Pagination
      const paginatedData = mappedData.slice((page - 1) * pageSize, page * pageSize)

      setRows(paginatedData)
      setTotal(mappedData.length)
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
  }, [page, pageSize, sortColumn, sortDirection])

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortDirection("asc")
      }
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
    setPage(1)
  }

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="ml-2 h-4 w-4" />
    }
    return <ArrowDown className="ml-2 h-4 w-4" />
  }

  const pageCount = total > 0 ? Math.ceil(total / pageSize) : 1
  const canPrevious = page > 1
  const canNext = total > page * pageSize

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Collecte - Ancien</CardTitle>
            <CardDescription>
              Previous leases (older leases for each apartment)
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
            <Select value={pageSize.toString()} onValueChange={(value) => {
              setPageSize(Number(value))
              setPage(1)
            }}>
              <SelectTrigger className="w-[130px]">
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
              {total} total lease{total !== 1 ? 's' : ''} • Page {page} of {pageCount}
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("apartment_folder")}
                    >
                      Apartment Folder
                      {getSortIcon("apartment_folder")}
                    </button>
                  </TableHead>
                  <TableHead className="w-[300px]">Tenant Names</TableHead>
                  <TableHead className="w-[150px]">
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("monthly_rent")}
                    >
                      Monthly Rent
                      {getSortIcon("monthly_rent")}
                    </button>
                  </TableHead>
                  <TableHead className="w-[150px]">
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("qb_balance")}
                    >
                      QB Balance
                      {getSortIcon("qb_balance")}
                    </button>
                  </TableHead>
                  <TableHead className="w-[150px]">
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("lease_start_date")}
                    >
                      Lease Start
                      {getSortIcon("lease_start_date")}
                    </button>
                  </TableHead>
                  <TableHead className="w-[130px]">TAL Dossier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(6)].map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.apartment_folder}</TableCell>
                      <TableCell>{row.tenant_names.join(", ") || "—"}</TableCell>
                      <TableCell className="text-right">
                        {row.monthly_rent != null ? `${Number(row.monthly_rent).toFixed(2)} $` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.qb_balance !== null && row.qb_balance !== undefined ? `${Number(row.qb_balance).toFixed(2)} $` : "—"}
                      </TableCell>
                      <TableCell>{row.lease_start_date ? new Date(row.lease_start_date).toLocaleDateString('fr-CA') : "—"}</TableCell>
                      <TableCell>
                        {row.has_tal_dossier ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">Yes</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs">No</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No previous leases available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {rows.length > 0
                ? `Showing ${(page - 1) * pageSize + 1} to ${(page - 1) * pageSize + rows.length} of ${total} rows`
                : "Showing 0 of 0 rows"}
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
