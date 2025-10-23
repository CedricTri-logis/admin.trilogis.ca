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
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { RefreshCcw, Play, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "react-hot-toast"

interface SyncJob {
  id: string
  realm_id: string
  company_name: string
  status: string
  sync_type: string
  total_entities: number
  completed_entities: number
  failed_entities: number
  total_records: number
  processed_records: number
  error_records: number
  started_at: string
  completed_at: string | null
  created_at: string
}

interface AuthToken {
  realm_id: string
  company_name: string
}

export default function QuickBooksSyncPage() {
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [tokens, setTokens] = useState<AuthToken[]>([])
  const [selectedRealmId, setSelectedRealmId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [autoProcess, setAutoProcess] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [isCDCSync, setIsCDCSync] = useState(false)

  const supabase = createSupabaseBrowserClient()

  // Fetch auth tokens
  const fetchTokens = async () => {
    const { data, error } = await supabase
      .schema('quickbooks')
      .from('qb_auth_tokens')
      .select('realm_id, company_name')
      .eq('is_active', true)

    if (!error && data) {
      setTokens(data)
      if (data.length > 0 && !selectedRealmId) {
        setSelectedRealmId(data[0].realm_id)
      }
    }
  }

  // Fetch sync jobs
  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/quickbooks/sync/jobs?limit=50', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error fetching sync jobs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Start a new sync job
  const startSync = async (syncType: 'full' | 'incremental' = 'full') => {
    if (!selectedRealmId) {
      toast.error('Please select a company')
      return
    }

    setIsStarting(true)

    try {
      const response = await fetch('/api/quickbooks/sync/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId: selectedRealmId,
          syncType,
          startDate: syncType === 'incremental' ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
          endDate: new Date().toISOString().split('T')[0]
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(`Sync job started: ${result.jobId}`)
        fetchJobs()
        if (autoProcess) {
          processSync()
        }
      } else {
        toast.error(result.error || 'Failed to start sync')
      }
    } catch (error: any) {
      console.error('Error starting sync:', error)
      toast.error('Failed to start sync job')
    } finally {
      setIsStarting(false)
    }
  }

  // Process pending sync jobs
  const processSync = async () => {
    setIsProcessing(true)

    try {
      const response = await fetch('/api/quickbooks/sync/process', {
        method: 'POST'
      })

      const result = await response.json()

      if (response.ok) {
        if (result.processed > 0) {
          toast.success(`Processed ${result.processed} entities in ${result.elapsed?.toFixed(1)}s`)
          fetchJobs()

          // Continue processing if there are more pending jobs
          if (autoProcess) {
            setTimeout(() => processSync(), 2000)
          }
        } else {
          toast.success('No pending entities to process')
          setAutoProcess(false)
        }
      } else {
        toast.error(result.error || 'Failed to process sync')
        setAutoProcess(false)
      }
    } catch (error: any) {
      console.error('Error processing sync:', error)
      toast.error('Failed to process sync')
      setAutoProcess(false)
    } finally {
      setIsProcessing(false)
    }
  }

  // CDC (Change Data Capture) sync - FAST incremental sync
  const cdcSync = async () => {
    if (!selectedRealmId) {
      toast.error('Please select a company')
      return
    }

    setIsCDCSync(true)

    try {
      const response = await fetch('/api/quickbooks/sync/cdc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realmId: selectedRealmId })
      })

      const result = await response.json()

      if (response.ok) {
        if (result.stats.created + result.stats.updated + result.stats.deleted > 0) {
          toast.success(`Synced ${result.stats.created + result.stats.updated + result.stats.deleted} changes in ${result.duration}s`)
        } else {
          toast.success('No changes found - data is up to date')
        }
        fetchJobs()
      } else {
        toast.error(result.error || 'CDC sync failed')
      }
    } catch (error: any) {
      console.error('Error running CDC sync:', error)
      toast.error('Failed to run CDC sync')
    } finally {
      setIsCDCSync(false)
    }
  }

  // Verify sync counts
  const verifyCounts = async () => {
    if (!selectedRealmId) {
      toast.error('Please select a company')
      return
    }

    setIsVerifying(true)
    setVerificationResult(null)

    try {
      const response = await fetch(`/api/quickbooks/sync/verify?realmId=${selectedRealmId}`)
      const result = await response.json()

      if (response.ok) {
        setVerificationResult(result)
        if (result.summary.allMatch) {
          toast.success('All entity counts match!')
        } else {
          toast.error(`Found differences in ${result.entities.filter((e: any) => !e.matches).length} entities`)
        }
      } else {
        toast.error(result.error || 'Failed to verify counts')
      }
    } catch (error: any) {
      console.error('Error verifying counts:', error)
      toast.error('Failed to verify sync')
    } finally {
      setIsVerifying(false)
    }
  }

  useEffect(() => {
    fetchTokens()
    fetchJobs()
  }, [])

  useEffect(() => {
    // Auto-refresh jobs every 10 seconds
    const interval = setInterval(fetchJobs, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Auto-process if enabled
    if (autoProcess && !isProcessing) {
      const timeout = setTimeout(() => processSync(), 2000)
      return () => clearTimeout(timeout)
    }
  }, [autoProcess, isProcessing])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'running':
      case 'pending':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      running: "default",
      completed: "outline",
      failed: "destructive"
    }

    return (
      <Badge variant={variants[status] || "secondary"}>
        {status}
      </Badge>
    )
  }

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    const start = new Date(startedAt)
    const end = completedAt ? new Date(completedAt) : new Date()
    const seconds = Math.round((end.getTime() - start.getTime()) / 1000)

    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>QuickBooks Data Synchronization</CardTitle>
          <CardDescription>
            Import QuickBooks data (invoices, customers, payments, etc.) into your database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <select
              className="px-3 py-2 border rounded-md"
              value={selectedRealmId}
              onChange={(e) => setSelectedRealmId(e.target.value)}
              disabled={isStarting}
            >
              <option value="">Select Company</option>
              {tokens.map(token => (
                <option key={token.realm_id} value={token.realm_id}>
                  {token.company_name}
                </option>
              ))}
            </select>

            <Button
              onClick={() => startSync('full')}
              disabled={isStarting || !selectedRealmId}
            >
              {isStarting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start Full Sync
            </Button>

            <Button
              onClick={() => startSync('incremental')}
              variant="outline"
              disabled={isStarting || !selectedRealmId}
            >
              Start Incremental (Last 30 Days)
            </Button>

            <Button
              onClick={cdcSync}
              variant="default"
              disabled={isCDCSync || !selectedRealmId}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCDCSync ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Quick Sync (CDC)
            </Button>

            <Button
              onClick={processSync}
              variant="secondary"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Process Pending
            </Button>

            <Button
              onClick={verifyCounts}
              variant="outline"
              disabled={isVerifying || !selectedRealmId}
            >
              {isVerifying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Verify Counts
            </Button>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoProcess}
                onChange={(e) => setAutoProcess(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto-process</span>
            </label>
          </div>

          <div className="text-sm text-muted-foreground">
            <p><strong>Quick Sync (CDC):</strong> FASTEST! Only syncs changes since last sync (recommended for daily use)</p>
            <p><strong>Full Sync:</strong> Imports all data from QuickBooks</p>
            <p><strong>Incremental:</strong> Imports only recent transactions (last 30 days)</p>
            <p><strong>Auto-process:</strong> Automatically processes batches until complete</p>
            <p><strong>Verify:</strong> Compare QuickBooks vs Supabase counts after sync</p>
          </div>
        </CardContent>
      </Card>

      {verificationResult && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Results</CardTitle>
            <CardDescription>
              Compared at {new Date(verificationResult.verifiedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Total Records</div>
                  <div className="text-2xl font-bold">
                    QuickBooks: {verificationResult.summary.totalQuickBooks.toLocaleString()}
                  </div>
                  <div className="text-2xl font-bold">
                    Supabase: {verificationResult.summary.totalSupabase.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Difference</div>
                  <div className={cn("text-2xl font-bold", verificationResult.summary.allMatch ? "text-green-600" : "text-red-600")}>
                    {verificationResult.summary.totalDifference > 0 ? '+' : ''}{verificationResult.summary.totalDifference}
                  </div>
                  {verificationResult.summary.allMatch && (
                    <Badge variant="outline" className="mt-2">All Match ✓</Badge>
                  )}
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">QuickBooks</TableHead>
                    <TableHead className="text-right">Supabase</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verificationResult.entities.map((entity: any) => (
                    <TableRow key={entity.entity}>
                      <TableCell className="font-medium">{entity.entity}</TableCell>
                      <TableCell className="text-right">{entity.quickbooks.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{entity.supabase.toLocaleString()}</TableCell>
                      <TableCell className={cn("text-right", entity.matches ? "text-muted-foreground" : "text-red-600 font-bold")}>
                        {entity.difference > 0 ? '+' : ''}{entity.difference}
                      </TableCell>
                      <TableCell className="text-center">
                        {entity.matches ? (
                          <CheckCircle className="h-5 w-5 text-green-500 inline" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 inline" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sync Jobs</CardTitle>
            <CardDescription>Recent synchronization jobs</CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchJobs}
            disabled={isLoading}
          >
            <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No sync jobs yet. Start a sync to import QuickBooks data.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => {
                  const progress = job.total_entities > 0
                    ? Math.round((job.completed_entities / job.total_entities) * 100)
                    : 0

                  return (
                    <TableRow key={job.id}>
                      <TableCell>{getStatusIcon(job.status)}</TableCell>
                      <TableCell className="font-medium">{job.company_name}</TableCell>
                      <TableCell className="capitalize">{job.sync_type}</TableCell>
                      <TableCell>{getStatusBadge(job.status)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{job.completed_entities}/{job.total_entities} entities</span>
                            <span>({progress}%)</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{job.processed_records?.toLocaleString()} imported</div>
                          {job.error_records > 0 && (
                            <div className="text-red-500">{job.error_records} errors</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(job.started_at, job.completed_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(job.started_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
