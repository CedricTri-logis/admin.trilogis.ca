"use client"

import { useState, useEffect, useRef } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Activity,
  Calendar
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SyncState {
  status: 'idle' | 'connecting' | 'syncing' | 'completed' | 'error'
  jobId: string | null
  logs: LogEntry[]
  stats: {
    categories: number
    spaces: number
    reservations: number
    accountingItems: number
    errors: number
  } | null
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

export default function MewsImportPage() {
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    jobId: null,
    logs: [],
    stats: null,
    eventSource: null,
    startTime: null,
    endTime: null
  })

  const [isSyncing, setIsSyncing] = useState(false)
  const [fromDate, setFromDate] = useState('2024-01-01')
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [truncate, setTruncate] = useState(false)
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  const MEWS_SYNC_URL = process.env.NEXT_PUBLIC_CDC_SYNC_URL // Reuse same Railway endpoint

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [syncState.logs])

  // Add log entry
  const addLog = (type: LogEntry['type'], message: string, emoji?: string) => {
    setSyncState(prev => ({
      ...prev,
      logs: [
        ...prev.logs,
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          type,
          message,
          emoji
        }
      ]
    }))
  }

  // Update sync state
  const updateSyncState = (updates: Partial<SyncState>) => {
    setSyncState(prev => ({
      ...prev,
      ...updates
    }))
  }

  // Start Mews sync
  const startMewsSync = async () => {
    if (!MEWS_SYNC_URL) {
      alert('URL de synchronisation non configurée. Définissez la variable d\'environnement NEXT_PUBLIC_CDC_SYNC_URL.')
      return
    }

    updateSyncState({
      status: 'connecting',
      startTime: new Date(),
      logs: [],
      stats: null
    })
    addLog('info', `Démarrage de l'importation Mews...`, '🚀')
    setIsSyncing(true)

    try {
      // Start sync job
      const response = await fetch(`${MEWS_SYNC_URL}/api/mews/sync/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromDate,
          to: toDate,
          truncate
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const { jobId } = await response.json()
      updateSyncState({ jobId, status: 'syncing' })
      addLog('success', `ID de tâche : ${jobId}`, '✅')

      // Open SSE connection
      const es = new EventSource(`${MEWS_SYNC_URL}/api/mews/sync/stream/${jobId}`)
      updateSyncState({ eventSource: es })

      es.onmessage = (event) => {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'connected':
            addLog('info', 'Connecté au flux de synchronisation', '🔗')
            break

          case 'progress':
            if (data.message) {
              addLog('progress', data.message, data.emoji)
            }
            break

          case 'complete':
            if (data.stats) {
              updateSyncState({
                stats: data.stats,
                status: 'completed',
                endTime: new Date()
              })
              const total = Object.values(data.stats).reduce((sum: number, val: any) =>
                typeof val === 'number' ? sum + val : sum, 0
              )
              addLog('success', `Importation terminée ! Total : ${total} enregistrements`, '🎉')
            }
            setIsSyncing(false)
            break

          case 'error':
            updateSyncState({ status: 'error', endTime: new Date() })
            addLog('error', data.message || 'Une erreur est survenue', '❌')
            setIsSyncing(false)
            break

          case 'done':
            es.close()
            updateSyncState({ eventSource: null })
            break
        }
      }

      es.onerror = (error) => {
        console.error('SSE error:', error)
        addLog('error', 'Erreur de connexion - l\'importation peut encore s\'exécuter sur le serveur', '⚠️')
        es.close()
        updateSyncState({
          eventSource: null,
          status: 'error',
          endTime: new Date()
        })
        setIsSyncing(false)
      }

    } catch (error: any) {
      console.error('Error starting Mews sync:', error)
      addLog('error', error.message || 'Échec du démarrage de l\'importation', '❌')
      updateSyncState({
        status: 'error',
        endTime: new Date()
      })
      setIsSyncing(false)
    }
  }

  // Get status icon
  const getStatusIcon = () => {
    switch (syncState.status) {
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

  // Get status label in French
  const getStatusLabel = () => {
    switch (syncState.status) {
      case 'idle':
        return 'en attente'
      case 'connecting':
        return 'connexion'
      case 'syncing':
        return 'importation'
      case 'completed':
        return 'terminé'
      case 'error':
        return 'erreur'
      default:
        return syncState.status
    }
  }

  // Format duration
  const formatDuration = () => {
    if (!syncState.startTime) return '-'
    const end = syncState.endTime || new Date()
    const seconds = Math.round((end.getTime() - syncState.startTime.getTime()) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Importation Mews</h1>
        <p className="text-muted-foreground mt-1">
          Import complet des données depuis Mews (catégories, espaces, réservations, comptabilité)
        </p>
      </div>

      {/* Configuration Alert */}
      {!MEWS_SYNC_URL && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Configuration requise</AlertTitle>
          <AlertDescription>
            La variable d'environnement NEXT_PUBLIC_CDC_SYNC_URL n'est pas configurée.
            Veuillez la configurer pour pointer vers votre worker Railway.
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration de l'importation</CardTitle>
          <CardDescription>
            Définissez la période et les options d'importation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromDate">Date de début</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fromDate"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={isSyncing}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate">Date de fin</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="toDate"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={isSyncing}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="truncate"
              checked={truncate}
              onChange={(e) => setTruncate(e.target.checked)}
              disabled={isSyncing}
              className="h-4 w-4"
            />
            <Label htmlFor="truncate" className="text-sm font-normal">
              Supprimer toutes les données existantes avant l'importation (truncate)
            </Label>
          </div>

          <Button
            onClick={startMewsSync}
            disabled={isSyncing || !MEWS_SYNC_URL}
            size="lg"
            className="w-full"
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Importation en cours...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Démarrer l'importation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Sync Status Card */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <CardTitle>État de l'importation</CardTitle>
                <CardDescription>
                  Mews → Supabase (mews2 schema)
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {syncState.startTime && (
                <div className="text-sm text-muted-foreground">
                  Durée: {formatDuration()}
                </div>
              )}
              <Badge
                variant={
                  syncState.status === 'completed' ? 'default' :
                  syncState.status === 'error' ? 'destructive' :
                  syncState.status === 'syncing' || syncState.status === 'connecting' ? 'secondary' :
                  'outline'
                }
                className="capitalize"
              >
                {getStatusLabel()}
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
              <div className="bg-slate-950 text-green-400 font-mono text-xs p-4 rounded-lg h-[500px] overflow-y-auto">
                {syncState.logs.length === 0 ? (
                  <div className="text-slate-500">En attente du démarrage...</div>
                ) : (
                  <div className="space-y-1">
                    {syncState.logs.map((log) => (
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
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* Stats and Info */}
            <div className="p-6 space-y-6">
              {/* Statistics */}
              {syncState.stats && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    Statistiques
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-xl font-bold text-blue-600">
                        {syncState.stats.categories}
                      </div>
                      <div className="text-xs text-blue-700">Catégories</div>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="text-xl font-bold text-purple-600">
                        {syncState.stats.spaces}
                      </div>
                      <div className="text-xs text-purple-700">Espaces</div>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-xl font-bold text-green-600">
                        {syncState.stats.reservations}
                      </div>
                      <div className="text-xs text-green-700">Réservations</div>
                    </div>
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="text-xl font-bold text-orange-600">
                        {syncState.stats.accountingItems}
                      </div>
                      <div className="text-xs text-orange-700">Items comptables</div>
                    </div>
                    {syncState.stats.errors > 0 && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200 col-span-2">
                        <div className="text-xl font-bold text-red-600">
                          {syncState.stats.errors}
                        </div>
                        <div className="text-xs text-red-700">Erreurs</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Idle State */}
              {syncState.status === 'idle' && (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Prêt à importer</p>
                    <p className="text-sm mt-2">Configurez les paramètres et lancez l'importation</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
