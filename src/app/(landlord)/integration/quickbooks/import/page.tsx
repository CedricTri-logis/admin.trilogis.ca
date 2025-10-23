"use client"

import { useState, useEffect, useRef } from "react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Company {
  realm_id: string
  company_name: string
}

interface CompanySyncState {
  realm_id: string
  company_name: string
  status: 'idle' | 'connecting' | 'syncing' | 'completed' | 'error'
  jobId: string | null
  logs: LogEntry[]
  stats: {
    created: number
    updated: number
    deleted: number
    errors: number
  } | null
  verification: VerificationResult[]
  eventSource: EventSource | null
  startTime: Date | null
  endTime: Date | null
}

interface LogEntry {
  id: string
  timestamp: Date
  type: 'info' | 'progress' | 'success' | 'error' | 'warning'
  message: string
  emoji?: string
}

interface VerificationResult {
  entity: string
  qbCount: number | string
  dbCount: number | string
  match: boolean
  emoji: string
  error?: string
}

export default function CDCSyncPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [syncStates, setSyncStates] = useState<Record<string, CompanySyncState>>({})
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const logsEndRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const supabase = createSupabaseBrowserClient()
  const CDC_SYNC_URL = process.env.NEXT_PUBLIC_CDC_SYNC_URL

  // Auto-scroll logs to bottom for each company
  useEffect(() => {
    Object.keys(logsEndRefs.current).forEach(realmId => {
      logsEndRefs.current[realmId]?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [syncStates])

  // Fetch all active companies
  const fetchCompanies = async () => {
    setIsLoadingCompanies(true)
    const { data, error } = await supabase
      .schema('quickbooks')
      .from('qb_auth_tokens')
      .select('realm_id, company_name')
      .eq('is_active', true)
      .order('company_name')

    if (!error && data) {
      setCompanies(data)

      // Initialize sync states for all companies
      const initialStates: Record<string, CompanySyncState> = {}
      data.forEach(company => {
        initialStates[company.realm_id] = {
          realm_id: company.realm_id,
          company_name: company.company_name,
          status: 'idle',
          jobId: null,
          logs: [],
          stats: null,
          verification: [],
          eventSource: null,
          startTime: null,
          endTime: null
        }
      })
      setSyncStates(initialStates)
    }
    setIsLoadingCompanies(false)
  }

  useEffect(() => {
    fetchCompanies()

    // Cleanup: close all SSE connections on unmount
    return () => {
      Object.values(syncStates).forEach(state => {
        if (state.eventSource) {
          state.eventSource.close()
        }
      })
    }
  }, [])

  // Add log entry for a specific company
  const addLog = (realmId: string, type: LogEntry['type'], message: string, emoji?: string) => {
    setSyncStates(prev => ({
      ...prev,
      [realmId]: {
        ...prev[realmId],
        logs: [
          ...prev[realmId].logs,
          {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            type,
            message,
            emoji
          }
        ]
      }
    }))
  }

  // Update company sync state
  const updateSyncState = (realmId: string, updates: Partial<CompanySyncState>) => {
    setSyncStates(prev => ({
      ...prev,
      [realmId]: {
        ...prev[realmId],
        ...updates
      }
    }))
  }

  // Start CDC sync for a specific company
  const startCompanySync = async (company: Company) => {
    const { realm_id, company_name } = company

    updateSyncState(realm_id, {
      status: 'connecting',
      startTime: new Date(),
      logs: [],
      stats: null,
      verification: []
    })
    addLog(realm_id, 'info', `Démarrage de la synchronisation CDC pour ${company_name}...`, '🚀')

    try {
      // Start sync job
      const response = await fetch(`${CDC_SYNC_URL}/api/sync/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realmId: realm_id,
          verify: true
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const { jobId } = await response.json()
      updateSyncState(realm_id, { jobId, status: 'syncing' })
      addLog(realm_id, 'success', `ID de tâche : ${jobId}`, '✅')

      // Open SSE connection
      const es = new EventSource(`${CDC_SYNC_URL}/api/sync/stream/${jobId}`)
      updateSyncState(realm_id, { eventSource: es })

      es.onmessage = (event) => {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'connected':
            addLog(realm_id, 'info', 'Connecté au flux de synchronisation', '🔗')
            break

          case 'progress':
            if (data.message) {
              addLog(realm_id, 'progress', data.message, data.emoji)
            }
            break

          case 'verification':
            if (data.results) {
              updateSyncState(realm_id, { verification: data.results })
              addLog(realm_id, 'info', 'Résultats de vérification reçus', '🔍')
            }
            break

          case 'complete':
            if (data.stats) {
              updateSyncState(realm_id, {
                stats: data.stats,
                status: 'completed',
                endTime: new Date()
              })
              const total = data.stats.created + data.stats.updated + data.stats.deleted
              addLog(realm_id, 'success', `Synchronisation terminée ! Total des changements : ${total}`, '🎉')
            }
            break

          case 'error':
            updateSyncState(realm_id, { status: 'error', endTime: new Date() })
            addLog(realm_id, 'error', data.message || 'Une erreur est survenue', '❌')
            break

          case 'done':
            es.close()
            updateSyncState(realm_id, { eventSource: null })
            break
        }
      }

      es.onerror = (error) => {
        console.error(`SSE error for ${company_name}:`, error)
        addLog(realm_id, 'error', 'Erreur de connexion - la synchronisation peut encore s\'exécuter sur le serveur', '⚠️')
        es.close()
        updateSyncState(realm_id, {
          eventSource: null,
          status: 'error',
          endTime: new Date()
        })
      }

    } catch (error: any) {
      console.error(`Error starting CDC sync for ${company_name}:`, error)
      addLog(realm_id, 'error', error.message || 'Échec du démarrage de la synchronisation', '❌')
      updateSyncState(realm_id, {
        status: 'error',
        endTime: new Date()
      })
    }
  }

  // Start sync for all companies
  const startAllSyncs = async () => {
    if (!CDC_SYNC_URL) {
      alert('URL de synchronisation CDC non configurée. Définissez la variable d\'environnement NEXT_PUBLIC_CDC_SYNC_URL.')
      return
    }

    if (companies.length === 0) {
      alert('Aucune compagnie QuickBooks active trouvée.')
      return
    }

    setIsSyncing(true)

    // Start sync for each company with a small delay between them
    for (let i = 0; i < companies.length; i++) {
      await startCompanySync(companies[i])
      // Small delay to avoid overwhelming the server
      if (i < companies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  // Check if any sync is still running
  useEffect(() => {
    const anySyncing = Object.values(syncStates).some(
      state => state.status === 'connecting' || state.status === 'syncing'
    )
    setIsSyncing(anySyncing)
  }, [syncStates])

  // Get status icon
  const getStatusIcon = (status: CompanySyncState['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'syncing':
      case 'connecting':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Activity className="h-5 w-5 text-gray-400" />
    }
  }

  // Translate status to French
  const getStatusLabel = (status: CompanySyncState['status']) => {
    switch (status) {
      case 'idle':
        return 'en attente'
      case 'connecting':
        return 'connexion'
      case 'syncing':
        return 'synchronisation'
      case 'completed':
        return 'terminé'
      case 'error':
        return 'erreur'
      default:
        return status
    }
  }

  // Format duration
  const formatDuration = (startTime: Date | null, endTime: Date | null) => {
    if (!startTime) return '-'
    const end = endTime || new Date()
    const seconds = Math.round((end.getTime() - startTime.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  // Calculate totals across all companies
  const calculateTotals = () => {
    let totalCreated = 0
    let totalUpdated = 0
    let totalDeleted = 0
    let totalErrors = 0

    Object.values(syncStates).forEach(state => {
      if (state.stats) {
        totalCreated += state.stats.created
        totalUpdated += state.stats.updated
        totalDeleted += state.stats.deleted
        totalErrors += state.stats.errors
      }
    })

    return { totalCreated, totalUpdated, totalDeleted, totalErrors }
  }

  const totals = calculateTotals()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Importation QuickBooks</h1>
          <p className="text-muted-foreground mt-1">
            Synchronisation incrémentielle rapide pour toutes les compagnies
          </p>
        </div>
        <Button
          onClick={startAllSyncs}
          disabled={isSyncing || isLoadingCompanies || companies.length === 0}
          size="lg"
          className="min-w-[200px]"
        >
          {isSyncing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Synchronisation...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Démarrer la synchronisation
            </>
          )}
        </Button>
      </div>

      {/* Configuration Alert */}
      {!CDC_SYNC_URL && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration requise</AlertTitle>
          <AlertDescription>
            La variable d'environnement NEXT_PUBLIC_CDC_SYNC_URL n'est pas configurée.
            Veuillez la configurer pour pointer vers votre worker Railway CDC.
          </AlertDescription>
        </Alert>
      )}

      {/* Overall Statistics */}
      {Object.values(syncStates).some(s => s.stats) && (
        <Card>
          <CardHeader>
            <CardTitle>Statistiques globales</CardTitle>
            <CardDescription>
              Totaux combinés pour toutes les compagnies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                  <div className="text-3xl font-bold text-green-600">
                    {totals.totalCreated}
                  </div>
                </div>
                <div className="text-sm font-medium text-green-700">Créés</div>
              </div>
              <div className="text-center p-6 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-center mb-2">
                  <RefreshCw className="h-5 w-5 text-blue-600 mr-2" />
                  <div className="text-3xl font-bold text-blue-600">
                    {totals.totalUpdated}
                  </div>
                </div>
                <div className="text-sm font-medium text-blue-700">Mis à jour</div>
              </div>
              <div className="text-center p-6 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-center mb-2">
                  <TrendingDown className="h-5 w-5 text-orange-600 mr-2" />
                  <div className="text-3xl font-bold text-orange-600">
                    {totals.totalDeleted}
                  </div>
                </div>
                <div className="text-sm font-medium text-orange-700">Supprimés</div>
              </div>
              <div className="text-center p-6 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-center mb-2">
                  <XCircle className="h-5 w-5 text-red-600 mr-2" />
                  <div className="text-3xl font-bold text-red-600">
                    {totals.totalErrors}
                  </div>
                </div>
                <div className="text-sm font-medium text-red-700">Erreurs</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Sync Cards */}
      {companies.map((company) => {
        const state = syncStates[company.realm_id]
        if (!state) return null

        return (
          <Card key={company.realm_id} className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(state.status)}
                  <div>
                    <CardTitle>{company.company_name}</CardTitle>
                    <CardDescription>
                      Realm ID: {company.realm_id}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {state.startTime && (
                    <div className="text-sm text-muted-foreground">
                      Durée: {formatDuration(state.startTime, state.endTime)}
                    </div>
                  )}
                  <Badge
                    variant={
                      state.status === 'completed' ? 'default' :
                      state.status === 'error' ? 'destructive' :
                      state.status === 'syncing' || state.status === 'connecting' ? 'secondary' :
                      'outline'
                    }
                    className="capitalize"
                  >
                    {getStatusLabel(state.status)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2 divide-x">
                {/* Progress Log */}
                <div className="p-6">
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    Journal de progression
                  </h3>
                  <div className="bg-slate-950 text-green-400 font-mono text-xs p-4 rounded-lg h-[400px] overflow-y-auto">
                    {state.logs.length === 0 ? (
                      <div className="text-slate-500">En attente du démarrage...</div>
                    ) : (
                      <div className="space-y-1">
                        {state.logs.map((log) => (
                          <div key={log.id} className="flex items-start gap-2">
                            <span className="text-slate-500 text-[10px] mt-0.5">
                              {log.timestamp.toLocaleTimeString()}
                            </span>
                            {log.emoji && <span className="text-xs">{log.emoji}</span>}
                            <span className={cn(
                              'flex-1',
                              log.type === 'error' && 'text-red-400',
                              log.type === 'success' && 'text-green-400',
                              log.type === 'warning' && 'text-yellow-400',
                              log.type === 'progress' && 'text-cyan-400',
                              log.type === 'info' && 'text-slate-300'
                            )}>
                              {log.message}
                            </span>
                          </div>
                        ))}
                        <div ref={el => logsEndRefs.current[company.realm_id] = el} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats and Verification */}
                <div className="p-6 space-y-6">
                  {/* Statistics */}
                  {state.stats && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                        Statistiques
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="text-xl font-bold text-green-600">
                            {state.stats.created}
                          </div>
                          <div className="text-xs text-green-700">Créés</div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="text-xl font-bold text-blue-600">
                            {state.stats.updated}
                          </div>
                          <div className="text-xs text-blue-700">Mis à jour</div>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="text-xl font-bold text-orange-600">
                            {state.stats.deleted}
                          </div>
                          <div className="text-xs text-orange-700">Supprimés</div>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                          <div className="text-xl font-bold text-red-600">
                            {state.stats.errors}
                          </div>
                          <div className="text-xs text-red-700">Erreurs</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Verification Results */}
                  {state.verification.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                        Résultats de vérification
                      </h3>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-[280px] overflow-y-auto">
                          <Table>
                            <TableHeader className="bg-muted/50 sticky top-0">
                              <TableRow>
                                <TableHead className="w-[120px]">Entité</TableHead>
                                <TableHead className="text-right w-[60px]">QB</TableHead>
                                <TableHead className="text-right w-[60px]">DB</TableHead>
                                <TableHead className="text-center w-[40px]">✓</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {state.verification.map((result) => (
                                <TableRow
                                  key={result.entity}
                                  className={cn(
                                    !result.match && 'bg-red-50'
                                  )}
                                >
                                  <TableCell className="font-medium text-xs">
                                    {result.entity}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    {result.qbCount}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    {result.dbCount}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-sm">{result.emoji}</span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Idle State */}
                  {state.status === 'idle' && (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      <div className="text-center">
                        <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Prêt à synchroniser</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Empty State */}
      {companies.length === 0 && !isLoadingCompanies && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune compagnie active</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Aucune compagnie QuickBooks active trouvée. Veuillez d'abord vous connecter à QuickBooks.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
