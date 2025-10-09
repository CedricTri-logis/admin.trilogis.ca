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
import { RefreshCcw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn, formatDateOnly } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PAGE_SIZE = 25

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "Ouverte", label: "Ouverte" },
  { value: "Fermée", label: "Fermée" },
  { value: "Suspendue", label: "Suspendue" },
  { value: "Annulée", label: "Annulée" },
]

const APARTMENT_FILTER_OPTIONS = [
  { value: "all", label: "All Apartments" },
  { value: "assigned", label: "With Apartment" },
  { value: "unassigned", label: "Without Apartment" },
]

const TYPE_DEMANDEUR_FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "Locataire", label: "Locataire" },
  { value: "Locateur", label: "Locateur" },
]

type DossierRow = {
  id: string
  dossier: string
  apartment_id: string | null
  manual_apartment_id: string | null
  tenant_folder_id: string | null
  apartment_name?: string | null
  lease_folder?: string | null
  demandeur: Array<{ type: string; nom: string; adresse?: string }> | null
  defendeur: Array<{ type: string; nom: string; adresse?: string }> | null
  statut: string | null
  [key: string]: unknown
}

function formatParties(parties: Array<{ type: string; nom: string }> | null): string {
  if (!parties || parties.length === 0) return "—"
  // Filter out "Représentant" types and get only names
  return parties
    .filter(p => p.type !== "Représentant" && p.type !== "Avocat")
    .map(p => p.nom)
    .join(", ") || "—"
}

function formatRecours(recoursArray: Array<{ recours: string; category: string }> | null): string {
  if (!recoursArray || recoursArray.length === 0) return "—"
  // Get unique categories
  const uniqueCategories = [...new Set(recoursArray.map(r => r.category))]
  return uniqueCategories.join(", ")
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2)
    } catch (error) {
      return String(value)
    }
  }
  return String(value)
}

type SortColumn = "dossier" | "apartment_name" | "statut" | "first_action_date"
type SortDirection = "asc" | "desc" | null

export default function ApartmentsTalDossiersPage() {
  const [page, setPage] = useState(1)
  const [selectedDossier, setSelectedDossier] = useState<DossierRow | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [apartmentFilter, setApartmentFilter] = useState<string>("all")
  const [typeDemandeurFilter, setTypeDemandeurFilter] = useState<string>("all")
  const [recoursFilter, setRecoursFilter] = useState<string>("all")
  const [rows, setRows] = useState<DossierRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [apartments, setApartments] = useState<Array<{ id: string; apartment_name: string }>>([])
  const [selectedApartmentId, setSelectedApartmentId] = useState<string | null>(null)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null)
  const [selectedTenantFolderId, setSelectedTenantFolderId] = useState<string | null>(null)
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([])
  const [apartmentsByBuilding, setApartmentsByBuilding] = useState<Array<{ id: string; apartment_name: string }>>([])
  const [tenantFolders, setTenantFolders] = useState<Array<{ id: string; lease_folder: string; tenant_names: string[] }>>([])
  const [isSaving, setIsSaving] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>("dossier")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [recoursCategories, setRecoursCategories] = useState<string[]>([])

  const supabase = createSupabaseBrowserClient()

  const fetchData = async () => {
    setIsFetching(true)
    try {
      // Get the dossiers
      let query = supabase
        .schema("integration")
        .from("apartments_tal_dossiers")
        .select("*", { count: "exact" })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (statusFilter !== "all") {
        query = query.eq("statut", statusFilter)
      }

      if (apartmentFilter === "assigned") {
        query = query.not("apartment_id", "is", null)
      } else if (apartmentFilter === "unassigned") {
        query = query.is("apartment_id", null)
      }

      if (typeDemandeurFilter !== "all") {
        query = query.eq("type_demandeur", typeDemandeurFilter)
      }

      // Apply sorting (only for database columns)
      if (sortColumn && sortDirection && sortColumn !== "apartment_name") {
        query = query.order(sortColumn, { ascending: sortDirection === "asc" })
      } else if (!sortColumn || sortColumn === "apartment_name") {
        // Default sort by dossier if sorting by apartment_name (we'll sort client-side)
        query = query.order("dossier", { ascending: false })
      }

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching dossiers:", error)
        setRows([])
        setTotal(0)
      } else if (data) {
        // Get apartment names for dossiers - use effective apartment (manual_apartment_id || apartment_id)
        const apartmentIds = data
          .map(item => item.manual_apartment_id || item.apartment_id)
          .filter(id => id !== null) as string[]

        let apartmentNames: Record<string, string> = {}

        if (apartmentIds.length > 0) {
          const { data: apartments } = await supabase
            .schema("public")
            .from("apartments")
            .select("id, apartment_name")
            .in("id", apartmentIds)

          if (apartments) {
            apartmentNames = apartments.reduce((acc, apt) => {
              acc[apt.id] = apt.apartment_name
              return acc
            }, {} as Record<string, string>)
          }
        }

        // Get lease_folder for dossiers - use effective tenant folder ID (manual takes priority)
        const tenantFolderIds = data
          .map(item => item.manual_tenant_folder_id || item.tenant_folder_id)
          .filter(id => id !== null) as string[]

        let leaseFolders: Record<string, string> = {}

        if (tenantFolderIds.length > 0) {
          const { data: tenantFolders } = await supabase
            .schema("long_term")
            .from("tenants_folder")
            .select("id, lease_folder")
            .in("id", tenantFolderIds)

          if (tenantFolders) {
            leaseFolders = tenantFolders.reduce((acc, tf) => {
              acc[tf.id] = tf.lease_folder
              return acc
            }, {} as Record<string, string>)
          }
        }

        let mappedData = data.map(item => {
          // Use effective IDs: manual takes priority over automated
          const effectiveApartmentId = item.manual_apartment_id || item.apartment_id
          const effectiveTenantFolderId = item.manual_tenant_folder_id || item.tenant_folder_id

          return {
            ...item,
            apartment_name: effectiveApartmentId ? apartmentNames[effectiveApartmentId] || null : null,
            lease_folder: effectiveTenantFolderId ? leaseFolders[effectiveTenantFolderId] || null : null
          }
        })

        // Client-side filter for recours category
        if (recoursFilter !== "all") {
          mappedData = mappedData.filter(item => {
            const recoursArray = item.recours_array as Array<{ recours: string; category: string }> | null
            if (!recoursArray || recoursArray.length === 0) return false
            return recoursArray.some(r => r.category === recoursFilter)
          })
        }

        // Client-side sort for apartment_name
        if (sortColumn === "apartment_name" && sortDirection) {
          mappedData = mappedData.sort((a, b) => {
            const aName = a.apartment_name || ""
            const bName = b.apartment_name || ""
            if (sortDirection === "asc") {
              return aName.localeCompare(bName)
            } else {
              return bName.localeCompare(aName)
            }
          })
        }

        setRows(mappedData as DossierRow[])
        // Update total to reflect filtered results
        setTotal(recoursFilter !== "all" ? mappedData.length : (count || 0))
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
  }, [page, statusFilter, apartmentFilter, typeDemandeurFilter, recoursFilter, sortColumn, sortDirection])

  useEffect(() => {
    // Load all apartments for the dropdown (still needed for table data)
    const loadApartments = async () => {
      const { data } = await supabase
        .schema("public")
        .from("apartments")
        .select("id, apartment_name")
        .order("apartment_name", { ascending: true })

      if (data) {
        setApartments(data)
      }
    }
    loadApartments()

    // Load all buildings for the first dropdown
    const loadBuildings = async () => {
      const { data } = await supabase
        .schema("public")
        .from("buildings")
        .select("id, name")
        .order("name", { ascending: true })

      if (data) {
        setBuildings(data)
      }
    }
    loadBuildings()

    // Load unique recours categories
    const loadRecoursCategories = async () => {
      const { data } = await supabase
        .schema("integration")
        .from("tal_recours")
        .select("category")
        .not("category", "is", null)
        .order("category", { ascending: true })

      if (data) {
        const uniqueCategories = [...new Set(data.map(r => r.category).filter(Boolean))] as string[]
        setRecoursCategories(uniqueCategories.sort())
      }
    }
    loadRecoursCategories()
  }, [])

  // Load apartments when building is selected
  useEffect(() => {
    const loadApartmentsByBuilding = async () => {
      if (!selectedBuildingId) {
        setApartmentsByBuilding([])
        return
      }

      const { data } = await supabase
        .schema("public")
        .from("apartments")
        .select("id, apartment_name")
        .eq("building_id", selectedBuildingId)
        .order("apartment_name", { ascending: true })

      if (data) {
        setApartmentsByBuilding(data)
      }
    }
    loadApartmentsByBuilding()
  }, [selectedBuildingId, supabase])

  // Load tenant folders when apartment is selected
  useEffect(() => {
    const loadTenantFolders = async () => {
      if (!selectedApartmentId || selectedApartmentId === "none") {
        setTenantFolders([])
        return
      }

      const { data } = await supabase
        .schema("long_term")
        .from("tenants_folder")
        .select("id, lease_folder, tenant_names")
        .eq("apartment_id", selectedApartmentId)
        .order("lease_folder", { ascending: true })

      if (data) {
        setTenantFolders(data as Array<{ id: string; lease_folder: string; tenant_names: string[] }>)
      }
    }
    loadTenantFolders()
  }, [selectedApartmentId, supabase])

  // Initialize dropdowns when a dossier is selected
  useEffect(() => {
    const initializeDropdowns = async () => {
      if (!selectedDossier) {
        // Reset all selections when dialog is closed
        setSelectedBuildingId(null)
        setSelectedApartmentId(null)
        setSelectedTenantFolderId(null)
        setApartmentsByBuilding([])
        setTenantFolders([])
        return
      }

      // Get effective apartment ID (manual takes priority)
      const effectiveApartmentId = selectedDossier.manual_apartment_id || selectedDossier.apartment_id

      if (effectiveApartmentId) {
        // Load apartment details to get building_id
        const { data: apartmentData } = await supabase
          .schema("public")
          .from("apartments")
          .select("id, building_id, apartment_name")
          .eq("id", effectiveApartmentId)
          .single()

        if (apartmentData && apartmentData.building_id) {
          // Set building
          setSelectedBuildingId(apartmentData.building_id)

          // Load apartments for this building
          const { data: apartmentsData } = await supabase
            .schema("public")
            .from("apartments")
            .select("id, apartment_name")
            .eq("building_id", apartmentData.building_id)
            .order("apartment_name", { ascending: true })

          if (apartmentsData) {
            setApartmentsByBuilding(apartmentsData)
          }

          // Set apartment
          setSelectedApartmentId(effectiveApartmentId)

          // Load tenant folders for this apartment
          const { data: foldersData } = await supabase
            .schema("long_term")
            .from("tenants_folder")
            .select("id, lease_folder, tenant_names")
            .eq("apartment_id", effectiveApartmentId)
            .order("lease_folder", { ascending: true })

          if (foldersData) {
            setTenantFolders(foldersData as Array<{ id: string; lease_folder: string; tenant_names: string[] }>)
          }

          // Set tenant folder (manual takes priority)
          const effectiveTenantFolderId = selectedDossier.manual_tenant_folder_id || selectedDossier.tenant_folder_id
          if (effectiveTenantFolderId) {
            setSelectedTenantFolderId(effectiveTenantFolderId)
          }
        }
      }
    }

    initializeDropdowns()
  }, [selectedDossier, supabase])

  const handleSaveAssignment = async () => {
    if (!selectedDossier || !selectedApartmentId) return

    setIsSaving(true)
    try {
      const apartmentIdToSet = selectedApartmentId === "none" ? null : selectedApartmentId
      const tenantFolderIdToSet = selectedTenantFolderId === "none" ? null : selectedTenantFolderId

      // Update manual_apartment_id and manual_tenant_folder_id
      const { error } = await supabase
        .schema("integration")
        .from("apartments_tal_dossiers")
        .update({
          manual_apartment_id: apartmentIdToSet,
          manual_tenant_folder_id: tenantFolderIdToSet,
          match_status: apartmentIdToSet === null ? 'manual_no_match' : 'manual_match'
        })
        .eq("id", selectedDossier.id)

      if (error) {
        console.error("Error setting manual assignment:", error)
      } else {
        // Refresh data
        await fetchData()
        // Reset state
        setSelectedDossier(null)
        setSelectedApartmentId(null)
        setSelectedBuildingId(null)
        setSelectedTenantFolderId(null)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle building selection
  const handleBuildingChange = (buildingId: string) => {
    setSelectedBuildingId(buildingId === "none" ? null : buildingId)
    // Reset apartment and tenant folder when building changes
    setSelectedApartmentId(null)
    setSelectedTenantFolderId(null)
    setApartmentsByBuilding([])
    setTenantFolders([])
  }

  // Handle apartment selection
  const handleApartmentChange = (apartmentId: string) => {
    setSelectedApartmentId(apartmentId === "none" ? null : apartmentId)
    // Reset tenant folder when apartment changes
    setSelectedTenantFolderId(null)
    setTenantFolders([])
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction or clear sort
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortDirection("asc")
      }
    } else {
      // New column, start with ascending
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

  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1
  const canPrevious = page > 1
  const canNext = total > page * PAGE_SIZE

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">TAL Dossiers</CardTitle>
              <CardDescription>
                Click on a row to view complete dossier details.
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
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={apartmentFilter} onValueChange={(value) => {
                setApartmentFilter(value)
                setPage(1)
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by apartment" />
                </SelectTrigger>
                <SelectContent>
                  {APARTMENT_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeDemandeurFilter} onValueChange={(value) => {
                setTypeDemandeurFilter(value)
                setPage(1)
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_DEMANDEUR_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={recoursFilter} onValueChange={(value) => {
                setRecoursFilter(value)
                setPage(1)
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by recours" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Recours</SelectItem>
                  {recoursCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">
                {total} total dossier{total !== 1 ? 's' : ''} • Page {page} of {pageCount}
              </div>
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">
                      <button
                        className="flex items-center hover:text-foreground"
                        onClick={() => handleSort("dossier")}
                      >
                        Dossier #
                        {getSortIcon("dossier")}
                      </button>
                    </TableHead>
                    <TableHead className="w-[180px]">
                      <button
                        className="flex items-center hover:text-foreground"
                        onClick={() => handleSort("apartment_name")}
                      >
                        Apartment
                        {getSortIcon("apartment_name")}
                      </button>
                    </TableHead>
                    <TableHead className="w-[200px]">Lease Folder</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[250px]">Demandeur</TableHead>
                    <TableHead className="w-[250px]">Défendeur</TableHead>
                    <TableHead className="w-[150px]">Recours</TableHead>
                    <TableHead className="w-[110px]">
                      <button
                        className="flex items-center hover:text-foreground"
                        onClick={() => handleSort("first_action_date")}
                      >
                        Depuis
                        {getSortIcon("first_action_date")}
                      </button>
                    </TableHead>
                    <TableHead className="w-[100px]">
                      <button
                        className="flex items-center hover:text-foreground"
                        onClick={() => handleSort("statut")}
                      >
                        Statut
                        {getSortIcon("statut")}
                      </button>
                    </TableHead>
                    <TableHead className="w-[120px]">QB Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(6)].map((_, rowIndex) => (
                      <TableRow key={`skeleton-${rowIndex}`}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : rows.length ? (
                    rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedDossier(row)}
                      >
                        <TableCell className="font-medium">{row.dossier}</TableCell>
                        <TableCell>{row.apartment_name ?? "—"}</TableCell>
                        <TableCell>{row.lease_folder ?? "—"}</TableCell>
                        <TableCell>{row.type_demandeur ?? "—"}</TableCell>
                        <TableCell className="max-w-xs truncate">{formatParties(row.demandeur)}</TableCell>
                        <TableCell className="max-w-xs truncate">{formatParties(row.defendeur)}</TableCell>
                        <TableCell className="truncate">{formatRecours(row.recours_array as Array<{ recours: string; category: string }> | null)}</TableCell>
                        <TableCell>{formatDateOnly(row.first_action_date)}</TableCell>
                        <TableCell>{row.statut ?? "—"}</TableCell>
                        <TableCell className="text-right">{row.qb_balance != null ? `${Number(row.qb_balance).toFixed(2)} $` : "—"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                        No dossiers available yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground">
                {rows.length > 0
                  ? `Showing ${(page - 1) * PAGE_SIZE + 1} to ${(page - 1) * PAGE_SIZE + rows.length} of ${total} rows`
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

      <Dialog open={!!selectedDossier} onOpenChange={() => {
        setSelectedDossier(null)
        setSelectedApartmentId(null)
        setSelectedBuildingId(null)
        setSelectedTenantFolderId(null)
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dossier {selectedDossier?.dossier}</DialogTitle>
            <DialogDescription>Complete dossier information</DialogDescription>
          </DialogHeader>
          {selectedDossier && (
            <div className="space-y-6">
              <div className="space-y-3 border-b pb-4">
                <div className="text-sm font-semibold">Assign Apartment & Tenant Folder</div>

                {/* Building Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">1. Select Building</label>
                  <Select
                    value={selectedBuildingId || "none"}
                    onValueChange={handleBuildingChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a building..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No building</SelectItem>
                      {buildings.map((building) => (
                        <SelectItem key={building.id} value={building.id}>
                          {building.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Apartment Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">2. Select Apartment</label>
                  <Select
                    value={selectedApartmentId || "none"}
                    onValueChange={handleApartmentChange}
                    disabled={!selectedBuildingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedBuildingId ? "Select an apartment..." : "Select a building first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No apartment</SelectItem>
                      {apartmentsByBuilding.map((apt) => (
                        <SelectItem key={apt.id} value={apt.id}>
                          {apt.apartment_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tenant Folder Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">3. Select Tenant Folder</label>
                  <Select
                    value={selectedTenantFolderId || "none"}
                    onValueChange={setSelectedTenantFolderId}
                    disabled={!selectedApartmentId || selectedApartmentId === "none"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedApartmentId && selectedApartmentId !== "none" ? "Select a tenant folder..." : "Select an apartment first"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No tenant folder</SelectItem>
                      {tenantFolders.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.lease_folder}{folder.tenant_names && folder.tenant_names.length > 0 ? ` - ${folder.tenant_names.join(', ')}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveAssignment}
                    disabled={isSaving || !selectedApartmentId || selectedApartmentId === "none"}
                    size="sm"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>

                {selectedDossier.apartment_name && (
                  <div className="text-xs text-muted-foreground">
                    Current Apartment: {selectedDossier.apartment_name}
                  </div>
                )}
                {selectedDossier.lease_folder && (
                  <div className="text-xs text-muted-foreground">
                    Current Lease Folder: {selectedDossier.lease_folder}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {Object.entries(selectedDossier).map(([key, value]) => {
                  return (
                    <div key={key} className="space-y-1">
                      <div className="text-sm font-semibold">{key}</div>
                      <div className="rounded border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                        {formatValue(value)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
