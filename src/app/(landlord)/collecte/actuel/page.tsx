"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { cn, formatDateOnly } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { EditableStatusCell } from "@/components/collecte/EditableStatusCell"
import { CommentsCell } from "@/components/collecte/CommentsCell"

const PAGE_SIZE_OPTIONS = [
  { value: "25", label: "25 lignes" },
  { value: "50", label: "50 lignes" },
  { value: "100", label: "100 lignes" },
  { value: "500", label: "500 lignes" },
]

const BALANCE_FILTER_OPTIONS = [
  { value: "all", label: "Tous les soldes" },
  { value: "with_balance", label: "Avec solde" },
  { value: "without_balance", label: "Sans solde" },
]

// Status filter options will be loaded dynamically from the database

type CollecteRow = {
  id: string
  apartment_folder: string
  tenant_names: string[]
  qb_balance: number | null
  lease_start_date: string
  has_tal_dossier: boolean
  monthly_rent: number | null
  status: string | null
  qb_customer_qb_id: string | null
  qb_customer_name: string | null
  qb_parent_customer_name: string | null
  qb_customer_display_name: string | null
}

type SortColumn = "apartment_folder" | "qb_balance" | "lease_start_date" | "monthly_rent"
type SortDirection = "asc" | "desc" | null

export default function CollecteActuelPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [rows, setRows] = useState<CollecteRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [balanceFilter, setBalanceFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([])
  const [hideTrilogis, setHideTrilogis] = useState(true)
  const [hideZeroBalance, setHideZeroBalance] = useState(true)
  const [sortColumn, setSortColumn] = useState<SortColumn>("qb_balance")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const supabase = createSupabaseBrowserClient()

  const fetchAvailableStatuses = async () => {
    try {
      const { data, error } = await supabase
        .schema("integration")
        .from("collecte")
        .select("status")
        .not("status", "is", null)
        .not("status", "eq", "")

      if (error) {
        console.error("Error fetching statuses:", error)
        return
      }

      // Get unique statuses
      const uniqueStatuses = Array.from(
        new Set(data.map(item => item.status).filter(Boolean))
      ).sort()

      setAvailableStatuses(uniqueStatuses)
    } catch (err) {
      console.error("Error fetching statuses:", err)
    }
  }

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

      // Group by apartment_folder and get the most recent (first in each group due to sort)
      const folderMap = new Map<string, typeof allCollecte[0]>()
      allCollecte.forEach(folder => {
        if (!folderMap.has(folder.apartment_folder)) {
          folderMap.set(folder.apartment_folder, folder)
        }
      })

      const currentLeases = Array.from(folderMap.values())

      // Get TAL dossiers for these tenant folders
      const tenantFolderIds = currentLeases.map(f => f.tenant_folder_id)
      const { data: talDossiers } = await supabase
        .schema("integration")
        .from("apartments_tal_dossiers")
        .select("tenant_folder_id")
        .in("tenant_folder_id", tenantFolderIds)

      const talDossierSet = new Set(talDossiers?.map(d => d.tenant_folder_id) || [])

      // Get QB customer info for these collecte records
      const qbCustomerIds = currentLeases
        .map(f => f.manual_qb_customer_id || f.qb_customer_id)
        .filter(Boolean) as string[]

      const qbCustomerMap = new Map<string, { qb_id: string; display_name: string; parent_name: string | null }>()
      if (qbCustomerIds.length > 0) {
        const { data: qbCustomers, error: qbError } = await supabase
          .schema("quickbooks")
          .from("qb_customers")
          .select("id, qb_id, display_name, parent_qb_id, realm_id")
          .in("id", qbCustomerIds)

        if (qbError) {
          console.error("Error fetching QB customers:", qbError)
        }

        // Get all unique parent qb_ids
        const uniqueParentQbIds = Array.from(
          new Set(
            qbCustomers?.filter(c => c.parent_qb_id).map(c => c.parent_qb_id) || []
          )
        )

        // Fetch all parent customers in a single query
        const parentMap = new Map<string, string>()
        if (uniqueParentQbIds.length > 0) {
          const { data: parentCustomers, error: parentError } = await supabase
            .schema("quickbooks")
            .from("qb_customers")
            .select("qb_id, display_name")
            .in("qb_id", uniqueParentQbIds)

          if (parentError) {
            console.error("Error fetching parent customers:", parentError)
          } else {
            parentCustomers?.forEach(parent => {
              parentMap.set(parent.qb_id, parent.display_name)
            })
          }
        }

        qbCustomers?.forEach(customer => {
          const parentName = customer.parent_qb_id
            ? parentMap.get(customer.parent_qb_id) || null
            : null

          qbCustomerMap.set(customer.id, {
            qb_id: customer.qb_id,
            display_name: customer.display_name,
            parent_name: parentName
          })
        })
      }

      // Get monthly rent from leases and renewals
      const tenantFolderIdsForRent = currentLeases.map(f => f.tenant_folder_id)
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
      let mappedData: CollecteRow[] = currentLeases.map(folder => {
        const effectiveQbCustomerId = folder.manual_qb_customer_id || folder.qb_customer_id
        const qbCustomerInfo = effectiveQbCustomerId ? qbCustomerMap.get(effectiveQbCustomerId) : null

        return {
          id: folder.id,
          apartment_folder: folder.apartment_folder,
          tenant_names: folder.tenant_names || [],
          qb_balance: folder.qb_balance,
          lease_start_date: folder.lease_start_date,
          has_tal_dossier: talDossierSet.has(folder.tenant_folder_id),
          monthly_rent: monthlyRentMap.get(folder.tenant_folder_id) || null,
          status: folder.status || null,
          qb_customer_qb_id: qbCustomerInfo?.qb_id || null,
          qb_customer_name: qbCustomerInfo?.display_name || null,
          qb_parent_customer_name: qbCustomerInfo?.parent_name || null,
          qb_customer_display_name: qbCustomerInfo?.display_name || null
        }
      })

      // Apply balance filter
      if (balanceFilter === "with_balance") {
        mappedData = mappedData.filter(item => item.qb_balance !== null)
      } else if (balanceFilter === "without_balance") {
        mappedData = mappedData.filter(item => item.qb_balance === null)
      }

      // Apply status filter
      if (statusFilter !== "all") {
        if (statusFilter === "no_status") {
          mappedData = mappedData.filter(item => item.status === null || item.status === "")
        } else {
          // Filter by specific status
          mappedData = mappedData.filter(item => item.status === statusFilter)
        }
      }

      // Apply Tri-logis Inc. filter (case-insensitive, handles variations)
      // Check both the customer name itself AND the parent customer name
      if (hideTrilogis) {
        mappedData = mappedData.filter(item => {
          const customerName = item.qb_customer_display_name?.toLowerCase().replace(/[.\s-]/g, '') || ''
          const parentName = item.qb_parent_customer_name?.toLowerCase().replace(/[.\s-]/g, '') || ''

          // Filter out if either the customer or parent contains "trilogis"
          return !customerName.includes('trilogis') && !parentName.includes('trilogis')
        })
      }

      // Apply zero balance filter
      if (hideZeroBalance) {
        mappedData = mappedData.filter(item =>
          item.qb_balance !== 0 && item.qb_balance !== null
        )
      }

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
    fetchAvailableStatuses()
  }, [])

  useEffect(() => {
    fetchData()
  }, [page, pageSize, balanceFilter, statusFilter, hideTrilogis, hideZeroBalance, sortColumn, sortDirection])

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
            <CardTitle className="text-xl">Collecte - Actuel</CardTitle>
            <CardDescription>
              Baux actuels (les plus récents pour chaque appartement)
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
            <Select value={balanceFilter} onValueChange={(value) => {
              setBalanceFilter(value)
              setPage(1)
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by balance" />
              </SelectTrigger>
              <SelectContent>
                {BALANCE_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="no_status">Sans statut</SelectItem>
                {availableStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hide-trilogis"
                checked={hideTrilogis}
                onCheckedChange={(checked) => {
                  setHideTrilogis(checked === true)
                  setPage(1)
                }}
              />
              <label
                htmlFor="hide-trilogis"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Masquer Tri-logis Inc.
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hide-zero-balance"
                checked={hideZeroBalance}
                onCheckedChange={(checked) => {
                  setHideZeroBalance(checked === true)
                  setPage(1)
                }}
              />
              <label
                htmlFor="hide-zero-balance"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Masquer Solde = 0
              </label>
            </div>
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
              {total} bail{total !== 1 ? 'aux' : ''} au total • Page {page} de {pageCount}
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
                      Dossier Appartement
                      {getSortIcon("apartment_folder")}
                    </button>
                  </TableHead>
                  <TableHead className="w-[300px]">Noms des Locataires</TableHead>
                  <TableHead className="w-[150px]">
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("monthly_rent")}
                    >
                      Loyer Mensuel
                      {getSortIcon("monthly_rent")}
                    </button>
                  </TableHead>
                  <TableHead className="w-[150px]">
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("qb_balance")}
                    >
                      Solde QB
                      {getSortIcon("qb_balance")}
                    </button>
                  </TableHead>
                  <TableHead className="w-[150px]">
                    <button
                      className="flex items-center hover:text-foreground"
                      onClick={() => handleSort("lease_start_date")}
                    >
                      Début du Bail
                      {getSortIcon("lease_start_date")}
                    </button>
                  </TableHead>
                  <TableHead className="w-[130px]">Dossier TAL</TableHead>
                  <TableHead className="w-[150px]">ID Client QB</TableHead>
                  <TableHead className="w-[150px]">Statut</TableHead>
                  <TableHead className="w-[80px]">Commentaires</TableHead>
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
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/collecte/actuel/${row.id}`)}
                    >
                      <TableCell className="font-medium">{row.apartment_folder}</TableCell>
                      <TableCell>{row.tenant_names.join(", ") || "—"}</TableCell>
                      <TableCell className="text-right">
                        {row.monthly_rent != null ? `${Number(row.monthly_rent).toFixed(2)} $` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.qb_balance !== null && row.qb_balance !== undefined ? `${Number(row.qb_balance).toFixed(2)} $` : "—"}
                      </TableCell>
                      <TableCell>{formatDateOnly(row.lease_start_date)}</TableCell>
                      <TableCell>
                        {row.has_tal_dossier ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">Oui</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs">Non</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.qb_customer_qb_id || "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <EditableStatusCell
                          collecteId={row.id}
                          currentStatus={row.status}
                          onStatusUpdate={() => {
                            fetchData()
                            fetchAvailableStatuses()
                          }}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <CommentsCell collecteId={row.id} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      Aucun bail actuel disponible.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {rows.length > 0
                ? `Affichage de ${(page - 1) * pageSize + 1} à ${(page - 1) * pageSize + rows.length} sur ${total} lignes`
                : "Affichage de 0 sur 0 lignes"}
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
