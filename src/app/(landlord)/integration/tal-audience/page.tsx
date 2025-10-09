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
import { RefreshCcw } from "lucide-react"
import { cn, formatDateOnly } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PAGE_SIZE = 50

const TIME_FILTER_OPTIONS = [
  { value: "all", label: "Toutes les audiences" },
  { value: "future", label: "Audiences futures" },
  { value: "past", label: "Audiences passées" },
]

type AudienceRow = {
  id: string
  dossier: string
  audience_date: string | null
  audience_time: string | null
  audience_type: string | null
  lease_folder?: string | null
  [key: string]: unknown
}

export default function TalAudiencePage() {
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AudienceRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeFilter, setTimeFilter] = useState<string>("future")

  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const fetchData = async () => {
    setIsFetching(true)
    setError(null)
    try {
      const today = new Date().toISOString().split('T')[0]

      let query = supabase
        .schema("tal")
        .from("audience")
        .select("*", { count: "exact" })

      // Apply time filter
      if (timeFilter === "future") {
        query = query.gte("audience_date", today)
        query = query.order("audience_date", { ascending: true, nullsFirst: false })
      } else if (timeFilter === "past") {
        query = query.lt("audience_date", today)
        query = query.order("audience_date", { ascending: false, nullsFirst: false })
      } else {
        query = query.order("audience_date", { ascending: false, nullsFirst: false })
      }

      query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching audience:", error)
        setError(error.message)
        setRows([])
        setTotal(0)
      } else if (data) {
        // Get dossiers to find lease folder
        const dossiers = data.map(item => item.dossier).filter(Boolean)

        // Get apartments_tal_dossiers data
        const { data: dossiersData } = await supabase
          .schema("integration")
          .from("apartments_tal_dossiers")
          .select("dossier, tenant_folder_id, manual_tenant_folder_id")
          .in("dossier", dossiers)

        let leaseFolders: Record<string, string> = {}

        if (dossiersData && dossiersData.length > 0) {
          // Get effective tenant folder IDs
          const tenantFolderIds = dossiersData
            .map(d => d.manual_tenant_folder_id || d.tenant_folder_id)
            .filter(id => id !== null) as string[]

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
        }

        // Map lease folders to audience data
        const mappedData = data.map(item => {
          const dossierData = dossiersData?.find(d => d.dossier === item.dossier)
          const effectiveTenantFolderId = dossierData?.manual_tenant_folder_id || dossierData?.tenant_folder_id

          return {
            ...item,
            lease_folder: effectiveTenantFolderId ? leaseFolders[effectiveTenantFolderId] || null : null
          }
        })

        setRows(mappedData as AudienceRow[])
        setTotal(count || 0)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
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
  }, [page, timeFilter])

  const formatTime = (time: string | null): string => {
    if (!time) return "—"
    // time is in format "HH:MM:SS", extract just HH:MM
    return time.substring(0, 5)
  }

  const formatDate = (date: string | null): string => {
    return formatDateOnly(date)
  }

  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1
  const canPrevious = page > 1
  const canNext = total > page * PAGE_SIZE

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">TAL Audience</CardTitle>
            <CardDescription>
              Liste des audiences du Tribunal administratif du logement.
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
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              Error: {error}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={timeFilter} onValueChange={(value) => {
              setTimeFilter(value)
              setPage(1)
            }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrer par période" />
              </SelectTrigger>
              <SelectContent>
                {TIME_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              {total} audience{total !== 1 ? 's' : ''} • Page {page} of {pageCount}
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Dossier #</TableHead>
                  <TableHead className="w-[200px]">Lease Folder</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="w-[100px]">Heure</TableHead>
                  <TableHead className="w-[200px]">Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(10)].map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    </TableRow>
                  ))
                ) : rows.length ? (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.dossier}</TableCell>
                      <TableCell>{row.lease_folder ?? "—"}</TableCell>
                      <TableCell>{formatDate(row.audience_date)}</TableCell>
                      <TableCell>{formatTime(row.audience_time)}</TableCell>
                      <TableCell className="truncate">{row.audience_type ?? "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Aucune audience trouvée.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {rows.length > 0
                ? `Affichage de ${(page - 1) * PAGE_SIZE + 1} à ${(page - 1) * PAGE_SIZE + rows.length} sur ${total} audiences`
                : "Affichage de 0 sur 0 audiences"}
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
