"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
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
import { RefreshCcw, ArrowLeft } from "lucide-react"
import { cn, formatDateOnly } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { CommentsCell } from "@/components/collecte/CommentsCell"
import { EditableStatusCell } from "@/components/collecte/EditableStatusCell"
import { EditableDueDateCell } from "@/components/collecte/EditableDueDateCell"

const PAGE_SIZE = 50

type CollecteInfo = {
  id: string
  tenant_folder_id: string
  apartment_folder: string
  tenant_names: string[]
  lease_start_date: string
  qb_customer_id: string | null
  manual_qb_customer_id: string | null
  qb_balance: number | null
  status: string | null
}

type QBInvoice = {
  id: string
  qb_id: string
  doc_number: string | null
  txn_date: string
  due_date: string | null
  total_amt: string
  balance: string
  customer_name: string | null
  status: string | null
  line_items: any
}

export default function CollecteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const collecteId = params.id as string

  const [page, setPage] = useState(1)
  const [collecteInfo, setCollecteInfo] = useState<CollecteInfo | null>(null)
  const [invoices, setInvoices] = useState<QBInvoice[]>([])
  const [allInvoices, setAllInvoices] = useState<QBInvoice[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [hideFutureInvoices, setHideFutureInvoices] = useState(true)
  const [hidePaidInvoices, setHidePaidInvoices] = useState(true)

  const supabase = createSupabaseBrowserClient()

  const fetchData = async () => {
    setIsFetching(true)
    try {
      // First fetch the collecte record
      const { data: collecteData, error: collecteError } = await supabase
        .schema("integration")
        .from("collecte")
        .select("*")
        .eq("id", collecteId)
        .single()

      if (collecteError) {
        console.error("Error fetching collecte:", collecteError)
        setIsLoading(false)
        setIsFetching(false)
        return
      }

      setCollecteInfo(collecteData)

      // Get the effective QB customer ID
      const qbCustomerId = collecteData.manual_qb_customer_id || collecteData.qb_customer_id

      if (!qbCustomerId) {
        console.log("No QB customer ID found")
        setInvoices([])
        setTotal(0)
        setIsLoading(false)
        setIsFetching(false)
        return
      }

      // Get the QB customer to find the customer_qb_id
      const { data: qbCustomer, error: qbCustomerError } = await supabase
        .schema("quickbooks")
        .from("qb_customers")
        .select("qb_id")
        .eq("id", qbCustomerId)
        .single()

      if (qbCustomerError || !qbCustomer) {
        console.error("Error fetching QB customer:", qbCustomerError)
        setInvoices([])
        setTotal(0)
        setIsLoading(false)
        setIsFetching(false)
        return
      }

      // Fetch ALL QB invoices for this customer (no pagination in query)
      const { data: invoicesData, error: invoicesError } = await supabase
        .schema("quickbooks")
        .from("qb_invoices")
        .select("*")
        .eq("customer_qb_id", qbCustomer.qb_id)
        .order("txn_date", { ascending: false })

      if (invoicesError) {
        console.error("Error fetching invoices:", invoicesError)
        setAllInvoices([])
        setInvoices([])
        setTotal(0)
      } else {
        const allData = (invoicesData || []) as QBInvoice[]
        setAllInvoices(allData)

        // Filter based on hideFutureInvoices and hidePaidInvoices
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let filteredData = allData

        // Filter future invoices
        if (hideFutureInvoices) {
          filteredData = filteredData.filter(invoice => {
            if (!invoice.due_date) return true
            const dueDate = new Date(invoice.due_date)
            dueDate.setHours(0, 0, 0, 0)
            return dueDate <= today
          })
        }

        // Filter paid invoices
        if (hidePaidInvoices) {
          filteredData = filteredData.filter(invoice => {
            return parseFloat(invoice.balance) > 0
          })
        }

        // Apply pagination to filtered data
        const paginatedData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
        setInvoices(paginatedData)
        setTotal(filteredData.length)
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setInvoices([])
      setTotal(0)
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collecteId])

  // Re-filter when hideFutureInvoices, hidePaidInvoices, or page changes
  useEffect(() => {
    if (allInvoices.length === 0) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let filteredData = allInvoices

    // Filter future invoices
    if (hideFutureInvoices) {
      filteredData = filteredData.filter(invoice => {
        if (!invoice.due_date) return true
        const dueDate = new Date(invoice.due_date)
        dueDate.setHours(0, 0, 0, 0)
        return dueDate <= today
      })
    }

    // Filter paid invoices
    if (hidePaidInvoices) {
      filteredData = filteredData.filter(invoice => {
        return parseFloat(invoice.balance) > 0
      })
    }

    // Apply pagination to filtered data
    const paginatedData = filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    setInvoices(paginatedData)
    setTotal(filteredData.length)
  }, [hideFutureInvoices, hidePaidInvoices, page, allInvoices])

  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1
  const canPrevious = page > 1
  const canNext = total > page * PAGE_SIZE

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/collecte/actuel")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-2">
              {collecteInfo && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Statut:</span>
                    <div className="min-w-[150px]">
                      <EditableStatusCell
                        collecteId={collecteId}
                        currentStatus={collecteInfo.status}
                        onStatusUpdate={(newStatus) => {
                          setCollecteInfo({ ...collecteInfo, status: newStatus })
                        }}
                      />
                    </div>
                  </div>
                  <CommentsCell collecteId={collecteId} />
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">
                {collecteInfo ? `${collecteInfo.apartment_folder} - ${collecteInfo.tenant_names.join(", ")}` : "Loading..."}
              </CardTitle>
              <CardDescription>
                Factures QuickBooks pour ce locataire
              </CardDescription>
              {collecteInfo && (
                <div className="mt-2 space-y-1 text-sm">
                  <div>Début du bail : {formatDateOnly(collecteInfo.lease_start_date)}</div>
                  <div>Solde QB : {collecteInfo.qb_balance !== null ? `${Number(collecteInfo.qb_balance).toFixed(2)} $` : "—"}</div>
                </div>
              )}
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hide-future-invoices"
                checked={hideFutureInvoices}
                onCheckedChange={(checked) => {
                  setHideFutureInvoices(checked === true)
                  setPage(1)
                }}
              />
              <label
                htmlFor="hide-future-invoices"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Masquer les factures non échues
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hide-paid-invoices"
                checked={hidePaidInvoices}
                onCheckedChange={(checked) => {
                  setHidePaidInvoices(checked === true)
                  setPage(1)
                }}
              />
              <label
                htmlFor="hide-paid-invoices"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Masquer les factures payées
              </label>
            </div>
            <div className="text-sm text-muted-foreground">
              {total} facture{total !== 1 ? 's' : ''} • Page {page} de {pageCount}
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Numéro de doc.</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead className="w-[120px]">Date d'échéance</TableHead>
                  <TableHead className="w-[150px]">Montant total</TableHead>
                  <TableHead className="w-[150px]">Solde</TableHead>
                  <TableHead className="w-[120px]">Statut</TableHead>
                  <TableHead className="w-[200px]">Articles</TableHead>
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
                    </TableRow>
                  ))
                ) : invoices.length ? (
                  invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.doc_number || "—"}
                      </TableCell>
                      <TableCell>
                        {formatDateOnly(invoice.txn_date)}
                      </TableCell>
                      <TableCell>
                        <EditableDueDateCell
                          invoiceId={invoice.id}
                          qbId={invoice.qb_id}
                          currentDueDate={invoice.due_date}
                          onDueDateUpdate={(newDueDate) => {
                            // Update local state
                            const updatedInvoices = invoices.map(inv =>
                              inv.id === invoice.id ? { ...inv, due_date: newDueDate } : inv
                            )
                            setInvoices(updatedInvoices)
                            // Also update allInvoices
                            const updatedAllInvoices = allInvoices.map(inv =>
                              inv.id === invoice.id ? { ...inv, due_date: newDueDate } : inv
                            )
                            setAllInvoices(updatedAllInvoices)
                            // Refresh data to get updated QB balance
                            fetchData()
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        ${parseFloat(invoice.total_amt).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${parseFloat(invoice.balance).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          parseFloat(invoice.balance) > 0 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"
                        )}>
                          {parseFloat(invoice.balance) > 0 ? "Impayée" : "Payée"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {invoice.line_items && Array.isArray(invoice.line_items) ? (
                          <div className="text-xs space-y-1">
                            {invoice.line_items.slice(0, 3).map((item: any, idx: number) => (
                              <div key={idx}>
                                {item.Description || item.DetailType || "—"}
                              </div>
                            ))}
                            {invoice.line_items.length > 3 && (
                              <div className="text-muted-foreground">
                                +{invoice.line_items.length - 3} de plus
                              </div>
                            )}
                          </div>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Aucune facture trouvée.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {invoices.length > 0
                ? `Affichage de ${(page - 1) * PAGE_SIZE + 1} à ${(page - 1) * PAGE_SIZE + invoices.length} sur ${total} factures`
                : "Affichage de 0 sur 0 factures"}
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
