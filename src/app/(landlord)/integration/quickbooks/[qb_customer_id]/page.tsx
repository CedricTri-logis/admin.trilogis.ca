"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
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
import { RefreshCcw, ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import toast from "react-hot-toast"

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

type InvoiceRow = {
  id: string
  lt_invoice_id: string
  tenant_folder_id: string
  apartment_name: string | null
  apartment_category: string | null
  service_type: string | null
  invoice_month: string
  lt_amount: string
  lt_status: string | null
  qb_invoices_count: number | null
  qb_total_amount: string | null
  qb_total_balance: string | null
  match_status: string
  amount_difference: string | null
  last_reconciled_at: string | null
  created_at: string
  updated_at: string
  approved_for_qb_import: boolean | null
}

export default function CustomerInvoicesPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qb_customer_id = params.qb_customer_id as string

  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [matchStatusFilter, setMatchStatusFilter] = useState<string>(searchParams.get("status") || "all")
  const [customerName, setCustomerName] = useState<string>("")
  const [updatingApproval, setUpdatingApproval] = useState<Set<string>>(new Set())
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)

  // Selection state (separate from approval)
  const [selectedReconciliations, setSelectedReconciliations] = useState<Set<string>>(new Set())
  const [isProcessingBulk, setIsProcessingBulk] = useState(false)

  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  const fetchData = async () => {
    setIsFetching(true)
    try {
      let query = supabase
        .schema("integration")
        .from("qb_reconciliation")
        .select("*", { count: "exact" })
        .eq("qb_customer_id", qb_customer_id)
        .order("invoice_month", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (matchStatusFilter !== "all") {
        query = query.eq("match_status", matchStatusFilter)
      }

      const { data, error, count } = await query

      if (error) {
        console.error("Error fetching invoices:", error)
        setRows([])
        setTotal(0)
      } else {
        setRows((data || []) as InvoiceRow[])
        setTotal(count || 0)

        // Set customer name from first record
        if (data && data.length > 0) {
          setCustomerName(data[0].qb_customer_name || "Unknown Customer")
        }
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
  }, [page, matchStatusFilter, qb_customer_id])

  const pageCount = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1
  const canPrevious = page > 1
  const canNext = total > page * PAGE_SIZE

  const eligibleRows = rows.filter(row => row.match_status === "no_qb_invoice")
  const allApproved = eligibleRows.length > 0 && eligibleRows.every(row => row.approved_for_qb_import === true)
  const someApproved = eligibleRows.some(row => row.approved_for_qb_import === true)

  // Selection computed properties
  const allRowsSelected = rows.length > 0 && selectedReconciliations.size === rows.length
  const someRowsSelected = selectedReconciliations.size > 0 && !allRowsSelected

  // Group selected rows by match_status
  const selectedRows = rows.filter(row => selectedReconciliations.has(row.id))
  const selectedByStatus = {
    no_qb_invoice: selectedRows.filter(r => r.match_status === "no_qb_invoice"),
    amount_mismatch: selectedRows.filter(r => r.match_status === "amount_mismatch"),
  }

  // Selection handlers
  const handleToggleSelection = (reconciliationId: string) => {
    setSelectedReconciliations((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(reconciliationId)) {
        newSet.delete(reconciliationId)
      } else {
        newSet.add(reconciliationId)
      }
      return newSet
    })
  }

  const handleToggleAllSelection = () => {
    if (allRowsSelected) {
      setSelectedReconciliations(new Set())
    } else {
      setSelectedReconciliations(new Set(rows.map(row => row.id)))
    }
  }

  const clearSelection = () => {
    setSelectedReconciliations(new Set())
  }

  // Bulk operation handlers
  const handleBulkProcess = async () => {
    if (selectedReconciliations.size === 0) return

    setIsProcessingBulk(true)
    const results: { id: string; success: boolean; error?: string }[] = []

    try {
      // Process no_qb_invoice records (create)
      for (const row of selectedByStatus.no_qb_invoice) {
        try {
          const response = await fetch('/api/quickbooks/invoices/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reconciliation_id: row.id }),
          })

          const result = await response.json()

          if (response.ok) {
            results.push({ id: row.id, success: true })
          } else {
            results.push({ id: row.id, success: false, error: result.error })
          }
        } catch (error: any) {
          results.push({ id: row.id, success: false, error: error.message })
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Process amount_mismatch records (bulk update)
      for (const row of selectedByStatus.amount_mismatch) {
        try {
          // Fetch QB invoices for this reconciliation
          const { data: qbInvoices } = await supabase
            .schema('quickbooks')
            .from('qb_invoices')
            .select('id')
            .in('id', row.qb_invoice_ids || [])

          if (!qbInvoices || qbInvoices.length === 0) {
            results.push({ id: row.id, success: false, error: 'No QB invoices found' })
            continue
          }

          const response = await fetch('/api/quickbooks/invoices/bulk-update', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reconciliation_id: row.id,
              invoice_ids: qbInvoices.map(inv => inv.id),
              lt_amount: parseFloat(row.lt_amount),
            }),
          })

          const result = await response.json()

          if (response.ok) {
            results.push({ id: row.id, success: true })
          } else {
            results.push({ id: row.id, success: false, error: result.error })
          }
        } catch (error: any) {
          results.push({ id: row.id, success: false, error: error.message })
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Show results
      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length

      if (failureCount === 0) {
        toast.success(`Successfully processed ${successCount} reconciliation(s)`)
      } else {
        toast.error(`Processed ${successCount} successfully, ${failureCount} failed`)
      }

      // Clear selection and refresh
      clearSelection()
      await fetchData()
    } catch (error: any) {
      console.error('Bulk processing error:', error)
      toast.error('Bulk processing failed')
    } finally {
      setIsProcessingBulk(false)
    }
  }

  const handleToggleApproval = async (invoiceId: string, currentValue: boolean | null) => {
    setUpdatingApproval(prev => new Set(prev).add(invoiceId))
    try {
      const newValue = !currentValue
      const { error } = await supabase
        .schema("integration")
        .from("qb_reconciliation")
        .update({ approved_for_qb_import: newValue })
        .eq("id", invoiceId)

      if (error) {
        console.error("Error updating approval:", error)
      } else {
        await fetchData()
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setUpdatingApproval(prev => {
        const next = new Set(prev)
        next.delete(invoiceId)
        return next
      })
    }
  }

  const handleToggleAllApprovals = async () => {
    setIsBulkUpdating(true)
    try {
      const newValue = !allApproved
      // Only update invoices with match_status = "no_qb_invoice"
      const invoiceIds = rows
        .filter(row => row.match_status === "no_qb_invoice")
        .map(row => row.id)

      if (invoiceIds.length === 0) return

      const { error } = await supabase
        .schema("integration")
        .from("qb_reconciliation")
        .update({ approved_for_qb_import: newValue })
        .in("id", invoiceIds)

      if (error) {
        console.error("Error updating bulk approval:", error)
      } else {
        await fetchData()
      }
    } catch (err) {
      console.error("Unexpected error:", err)
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const formatDate = (dateString: string) => {
    // Date is already in YYYY-MM-DD format from database (date type, not timestamptz)
    // No timezone conversion needed
    return dateString
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "matched":
        return "bg-green-100 text-green-800"
      case "matched_multiple":
        return "bg-blue-100 text-blue-800"
      case "amount_mismatch":
        return "bg-yellow-100 text-yellow-800"
      case "service_mismatched":
        return "bg-purple-100 text-purple-800"
      case "no_qb_invoice":
        return "bg-orange-100 text-orange-800"
      case "lt_voided":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams()
                const status = searchParams.get("status")
                if (status) {
                  params.set("status", status)
                }
                router.push(`/integration/quickbooks${params.toString() ? `?${params.toString()}` : ''}`)
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">
                Invoices - {customerName}
              </CardTitle>
              <CardDescription>
                View all invoices for this customer from the reconciliation data.
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
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={matchStatusFilter} onValueChange={(value) => {
              setMatchStatusFilter(value)
              setPage(1)
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
            <div className="text-sm text-muted-foreground">
              {total} factures • Page {page} of {pageCount}
            </div>
          </div>

          {/* Action Bar for Bulk Operations */}
          {selectedReconciliations.size > 0 && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">
                        {selectedReconciliations.size} reconciliation(s) selected
                      </p>
                      <p className="text-sm text-blue-700">
                        {selectedByStatus.no_qb_invoice.length > 0 && (
                          <span>{selectedByStatus.no_qb_invoice.length} to create</span>
                        )}
                        {selectedByStatus.no_qb_invoice.length > 0 && selectedByStatus.amount_mismatch.length > 0 && (
                          <span> • </span>
                        )}
                        {selectedByStatus.amount_mismatch.length > 0 && (
                          <span>{selectedByStatus.amount_mismatch.length} to update</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      disabled={isProcessingBulk}
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={handleBulkProcess}
                      disabled={isProcessingBulk}
                      size="sm"
                    >
                      {isProcessingBulk ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          Process Selected
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">
                    <Checkbox
                      checked={allRowsSelected}
                      ref={(el) => {
                        if (el) {
                          (el as any).indeterminate = someRowsSelected
                        }
                      }}
                      onCheckedChange={handleToggleAllSelection}
                      disabled={isProcessingBulk || isLoading || rows.length === 0}
                      aria-label="Select all reconciliations"
                    />
                  </TableHead>
                  <TableHead className="w-[80px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs">Approve</span>
                      <Checkbox
                        checked={allApproved}
                        onCheckedChange={handleToggleAllApprovals}
                        disabled={isBulkUpdating || isLoading || eligibleRows.length === 0}
                        aria-label="Approve all no_qb_invoice"
                      />
                    </div>
                  </TableHead>
                  <TableHead className="w-[120px]">Invoice Month</TableHead>
                  <TableHead className="w-[180px]">Apartment</TableHead>
                  <TableHead className="w-[120px]">Category</TableHead>
                  <TableHead className="w-[120px]">LT Amount</TableHead>
                  <TableHead className="w-[100px]">LT Status</TableHead>
                  <TableHead className="w-[120px]">QB Amount</TableHead>
                  <TableHead className="w-[120px]">QB Balance</TableHead>
                  <TableHead className="w-[100px]">QB Count</TableHead>
                  <TableHead className="w-[150px]">Match Status</TableHead>
                  <TableHead className="w-[120px]">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(10)].map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
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
                    <TableRow
                      key={row.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50",
                        selectedReconciliations.has(row.id) && "bg-blue-50 border-l-4 border-l-blue-500"
                      )}
                      onClick={() => router.push(`/integration/quickbooks/${qb_customer_id}/${row.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedReconciliations.has(row.id)}
                          onCheckedChange={() => handleToggleSelection(row.id)}
                          disabled={isProcessingBulk}
                          aria-label={`Select reconciliation ${row.invoice_month}`}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={row.approved_for_qb_import === true}
                          onCheckedChange={() => handleToggleApproval(row.id, row.approved_for_qb_import)}
                          disabled={updatingApproval.has(row.id) || row.match_status !== "no_qb_invoice"}
                          aria-label={`Approve invoice ${row.invoice_month}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatDate(row.invoice_month)}
                      </TableCell>
                      <TableCell>{row.apartment_name || "N/A"}</TableCell>
                      <TableCell>{row.apartment_category || "N/A"}</TableCell>
                      <TableCell className="text-right">
                        ${parseFloat(row.lt_amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          row.lt_status === "active" && "bg-green-100 text-green-800",
                          row.lt_status === "void" && "bg-red-100 text-red-800"
                        )}>
                          {row.lt_status || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.qb_total_amount ? `$${parseFloat(row.qb_total_amount).toFixed(2)}` : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.qb_total_balance ? `$${parseFloat(row.qb_total_balance).toFixed(2)}` : "N/A"}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.qb_invoices_count ?? "0"}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          getStatusBadgeColor(row.match_status)
                        )}>
                          {row.match_status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.amount_difference
                          ? `$${parseFloat(row.amount_difference).toFixed(2)}`
                          : "$0.00"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={12} className="py-8 text-center text-muted-foreground">
                      Aucune facture trouvée.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              {rows.length > 0
                ? `Affichage de ${(page - 1) * PAGE_SIZE + 1} à ${(page - 1) * PAGE_SIZE + rows.length} sur ${total} factures`
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
