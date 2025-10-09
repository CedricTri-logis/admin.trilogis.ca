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
import { RefreshCcw, ArrowLeft, Plus, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import toast from "react-hot-toast"

type ReconciliationRecord = {
  id: string
  lt_invoice_id: string
  tenant_folder_id: string
  apartment_name: string | null
  apartment_category: string | null
  service_type: string | null
  invoice_month: string
  lt_amount: string
  lt_status: string | null
  qb_customer_id: string | null
  qb_customer_name: string | null
  qb_invoice_ids: string[]
  qb_invoices_count: number | null
  qb_total_amount: string | null
  qb_total_balance: string | null
  match_status: string
  amount_difference: string | null
}

type QBInvoice = {
  id: string
  qb_id: string
  doc_number: string | null
  txn_date: string
  customer_name: string | null
  total_amt: string
  balance: string
  line_items: any[]
}

type LineItem = {
  Id: string
  Amount: number
  Description?: string
  DetailType: string
  SalesItemLineDetail?: {
    ItemRef?: { name: string; value: string }
    ClassRef?: { name: string; value: string }
    ItemAccountRef?: { name: string; value: string }
  }
}

export default function ReconciliationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qb_customer_id = params.qb_customer_id as string
  const reconciliation_id = params.reconciliation_id as string

  const [reconciliation, setReconciliation] = useState<ReconciliationRecord | null>(null)
  const [qbInvoices, setQbInvoices] = useState<QBInvoice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)

  // Selection state for bulk updates
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const supabase = useMemo(() => createSupabaseBrowserClient(), [])

  // Computed selection values
  const allInvoicesSelected = qbInvoices.length > 0 && selectedInvoices.size === qbInvoices.length
  const someInvoicesSelected = selectedInvoices.size > 0 && !allInvoicesSelected

  const fetchData = async () => {
    setIsFetching(true)
    try {
      // Fetch reconciliation record
      const { data: reconData, error: reconError } = await supabase
        .schema("integration")
        .from("qb_reconciliation")
        .select("*")
        .eq("id", reconciliation_id)
        .single()

      if (reconError) {
        console.error("Error fetching reconciliation:", reconError)
        setReconciliation(null)
        setQbInvoices([])
      } else {
        setReconciliation(reconData as ReconciliationRecord)

        // Fetch QB invoices if they exist
        if (reconData.qb_invoice_ids && reconData.qb_invoice_ids.length > 0) {
          const { data: invoicesData, error: invoicesError } = await supabase
            .schema("quickbooks")
            .from("qb_invoices")
            .select("id, qb_id, doc_number, txn_date, customer_name, total_amt, balance, line_items")
            .in("id", reconData.qb_invoice_ids)
            .order("txn_date", { ascending: false })

          if (invoicesError) {
            console.error("Error fetching QB invoices:", invoicesError)
            setQbInvoices([])
          } else {
            setQbInvoices((invoicesData || []) as QBInvoice[])
          }
        } else {
          setQbInvoices([])
        }
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setReconciliation(null)
      setQbInvoices([])
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconciliation_id])

  const formatDate = (dateString: string) => {
    // Date is already in YYYY-MM-DD format
    return dateString
  }

  // Selection handlers
  const handleToggleInvoice = (invoiceId: string) => {
    setSelectedInvoices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId)
      } else {
        newSet.add(invoiceId)
      }
      return newSet
    })
  }

  const handleToggleAll = () => {
    if (allInvoicesSelected) {
      setSelectedInvoices(new Set())
    } else {
      setSelectedInvoices(new Set(qbInvoices.map((inv) => inv.id)))
    }
  }

  const clearSelection = () => setSelectedInvoices(new Set())

  // Create invoice handler (for no_qb_invoice status)
  const handleCreateInvoice = async () => {
    setIsCreating(true)
    try {
      const response = await fetch('/api/quickbooks/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reconciliation_id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create invoice')
      }

      const result = await response.json()
      toast.success(`Invoice created successfully! Doc #${result.invoice.doc_number || result.invoice.qb_id}`)

      // Refresh data
      await fetchData()
    } catch (error: any) {
      console.error('Error creating invoice:', error)
      toast.error(error.message || 'Failed to create invoice')
    } finally {
      setIsCreating(false)
    }
  }

  // Bulk update handler (for amount_mismatch status)
  const handleBulkUpdate = async () => {
    if (selectedInvoices.size === 0) return

    setIsUpdatingBulk(true)
    try {
      const response = await fetch('/api/quickbooks/invoices/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reconciliation_id,
          invoice_ids: Array.from(selectedInvoices),
          lt_amount: parseFloat(reconciliation!.lt_amount),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update invoices')
      }

      const result = await response.json()
      toast.success(result.message || `Successfully updated ${result.updated_count} invoice(s)`)

      // Clear selection and refresh
      clearSelection()
      await fetchData()
    } catch (error: any) {
      console.error('Error updating invoices:', error)
      toast.error(error.message || 'Failed to update invoices')
    } finally {
      setIsUpdatingBulk(false)
    }
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!reconciliation) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => {
              const params = new URLSearchParams()
              const status = searchParams.get("status")
              if (status) {
                params.set("status", status)
              }
              router.push(`/integration/quickbooks/${qb_customer_id}${params.toString() ? `?${params.toString()}` : ''}`)
            }}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Reconciliation Summary */}
      <Card>
        <CardHeader>
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
                router.push(`/integration/quickbooks/${qb_customer_id}${params.toString() ? `?${params.toString()}` : ''}`)
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">
                Reconciliation Details - {reconciliation.qb_customer_name}
              </CardTitle>
              <CardDescription>
                Invoice Month: {formatDate(reconciliation.invoice_month)}
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
        <CardContent className="space-y-6">
          {/* LT Invoice Summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Apartment</div>
              <div className="text-lg font-semibold">{reconciliation.apartment_name || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">LT Amount</div>
              <div className="text-lg font-semibold">${parseFloat(reconciliation.lt_amount).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">QB Total</div>
              <div className="text-lg font-semibold">
                {reconciliation.qb_total_amount ? `$${parseFloat(reconciliation.qb_total_amount).toFixed(2)}` : "N/A"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Match Status</div>
              <div>
                <span className={cn(
                  "inline-block rounded-full px-3 py-1 text-sm font-medium",
                  getStatusBadgeColor(reconciliation.match_status)
                )}>
                  {reconciliation.match_status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Category</div>
              <div className="text-base">{reconciliation.apartment_category || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">LT Status</div>
              <div>
                <span className={cn(
                  "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                  reconciliation.lt_status === "active" && "bg-green-100 text-green-800",
                  reconciliation.lt_status === "void" && "bg-red-100 text-red-800"
                )}>
                  {reconciliation.lt_status || "N/A"}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">QB Balance</div>
              <div className="text-base">
                {reconciliation.qb_total_balance ? `$${parseFloat(reconciliation.qb_total_balance).toFixed(2)}` : "N/A"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Difference</div>
              <div className="text-base">
                {reconciliation.amount_difference
                  ? `$${parseFloat(reconciliation.amount_difference).toFixed(2)}`
                  : "$0.00"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Bar - Amount Mismatch */}
      {reconciliation.match_status === 'amount_mismatch' && qbInvoices.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-900">
                    Amount Mismatch Detected
                  </p>
                  <p className="text-sm text-yellow-700">
                    LT Amount: ${parseFloat(reconciliation.lt_amount).toFixed(2)} •
                    QB Total: ${parseFloat(reconciliation.qb_total_amount || '0').toFixed(2)} •
                    Difference: ${Math.abs(parseFloat(reconciliation.amount_difference || '0')).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedInvoices.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {selectedInvoices.size} selected
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      disabled={isUpdatingBulk}
                    >
                      Clear
                    </Button>
                  </>
                )}
                <Button
                  onClick={handleBulkUpdate}
                  disabled={selectedInvoices.size === 0 || isUpdatingBulk}
                >
                  {isUpdatingBulk ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="h-4 w-4 mr-2" />
                      Update Selected in QB ({selectedInvoices.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Bar - No QB Invoice */}
      {reconciliation.match_status === 'no_qb_invoice' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-medium text-orange-900">
                    No QuickBooks Invoice Found
                  </p>
                  <p className="text-sm text-orange-700">
                    Create a new invoice in QuickBooks for ${parseFloat(reconciliation.lt_amount).toFixed(2)}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleCreateInvoice}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Invoice in QB
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QB Invoices */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                QuickBooks Invoices ({qbInvoices.length})
              </CardTitle>
              <CardDescription>
                {reconciliation.match_status === 'amount_mismatch'
                  ? 'Select invoices to update in QuickBooks'
                  : 'Matching invoices from QuickBooks for this reconciliation record.'
                }
              </CardDescription>
            </div>
            {/* Select All Checkbox - Only show for amount_mismatch */}
            {reconciliation.match_status === 'amount_mismatch' && qbInvoices.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allInvoicesSelected}
                  ref={(el) => {
                    if (el) {
                      (el as any).indeterminate = someInvoicesSelected
                    }
                  }}
                  onCheckedChange={handleToggleAll}
                  aria-label="Select all invoices"
                />
                <span className="text-sm text-muted-foreground">
                  Select All
                </span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {qbInvoices.length > 0 ? (
            qbInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className={cn(
                  "space-y-4 rounded-lg border p-4 transition-colors",
                  selectedInvoices.has(invoice.id) && "border-primary bg-primary/5"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Checkbox - Only for amount_mismatch */}
                  {reconciliation.match_status === 'amount_mismatch' && (
                    <div className="pt-1 flex items-center">
                      <Checkbox
                        checked={selectedInvoices.has(invoice.id)}
                        onCheckedChange={() => handleToggleInvoice(invoice.id)}
                        aria-label={`Select invoice ${invoice.doc_number}`}
                      />
                    </div>
                  )}

                  {/* Invoice Details */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-semibold">
                          Invoice {invoice.doc_number || "N/A"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          QB ID: {invoice.qb_id} • Date: {formatDate(invoice.txn_date)} • Customer: {invoice.customer_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">
                          ${parseFloat(invoice.total_amt).toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Balance: ${parseFloat(invoice.balance).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Line Items */}
                    {invoice.line_items && invoice.line_items.length > 0 && (
                      <div className="mt-4 overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Item</TableHead>
                              <TableHead>Class</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoice.line_items
                              .filter((item: LineItem) => item.DetailType === "SalesItemLineDetail")
                              .map((item: LineItem) => (
                                <TableRow key={item.Id}>
                                  <TableCell>{item.Description || "-"}</TableCell>
                                  <TableCell>
                                    {item.SalesItemLineDetail?.ItemRef?.name || "N/A"}
                                  </TableCell>
                                  <TableCell>
                                    {item.SalesItemLineDetail?.ClassRef?.name || "N/A"}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    ${item.Amount.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No QuickBooks invoices found for this reconciliation.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
