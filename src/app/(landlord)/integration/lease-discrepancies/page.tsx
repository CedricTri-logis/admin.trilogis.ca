'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Info, XCircle, RefreshCw, FolderInput, Loader2, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface DiscrepancySummary {
  discrepancy_type: string;
  severity: string;
  count: number;
}

interface LeaseDiscrepancy {
  tenant_folder_id: string;
  apartment_id: string;
  apartment_name: string;
  apartment_folder: string;
  tenant_names: string[];
  discrepancy_type: string;
  severity: string;
  start_date1: string;
  end_date1: string;
  rent1: string;
  file1: string;
  start_date2: string;
  end_date2: string;
  rent2: string;
  file2: string;
  overlap_days: number;
  record1_id: string;
  record2_id: string;
  record1_type: string;
  record2_type: string;
}

interface ApiResponse {
  summary: DiscrepancySummary[];
  discrepancies: LeaseDiscrepancy[];
  total: number;
}

const getSeverityBadgeColor = (severity: string) => {
  if (severity.startsWith('CRITICAL')) {
    return 'bg-red-600 text-white';
  } else if (severity.startsWith('HIGH')) {
    return 'bg-orange-600 text-white';
  } else if (severity.startsWith('MEDIUM')) {
    return 'bg-yellow-600 text-white';
  }
  return 'bg-gray-200 text-gray-800';
};

const getDiscrepancyIcon = (severity: string) => {
  if (severity.startsWith('CRITICAL')) {
    return <XCircle className="h-4 w-4 text-red-600" />;
  } else if (severity.startsWith('HIGH')) {
    return <AlertTriangle className="h-4 w-4 text-orange-600" />;
  }
  return <Info className="h-4 w-4 text-blue-600" />;
};

export default function LeaseDiscrepanciesPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // Move dialog state
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedDiscrepancy, setSelectedDiscrepancy] = useState<LeaseDiscrepancy | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<1 | 2 | null>(null);
  const [moveNotes, setMoveNotes] = useState('');
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  // PDF viewer state
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [viewingPdfName, setViewingPdfName] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching lease discrepancies from API...');
      const response = await fetch('/api/lease-discrepancies');
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to fetch lease discrepancies: ${response.status} ${errorText}`);
      }
      const result = await response.json();
      console.log('Data received:', result);
      setData(result);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMoveClick = (disc: LeaseDiscrepancy, recordNumber: 1 | 2) => {
    setSelectedDiscrepancy(disc);
    setSelectedRecord(recordNumber);
    setShowMoveDialog(true);
    setMoveError(null);
  };

  const handleViewPdf = async (disc: LeaseDiscrepancy, recordNumber: 1 | 2) => {
    const recordId = recordNumber === 1 ? disc.record1_id : disc.record2_id;
    const recordType = recordNumber === 1 ? disc.record1_type : disc.record2_type;
    const fileName = recordNumber === 1 ? disc.file1 : disc.file2;

    try {
      // Call API to get the signed URL for the document
      const response = await fetch('/api/lease-discrepancies/get-document-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: recordId,
          record_type: recordType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get document URL');
      }

      setViewingPdfUrl(data.url);
      setViewingPdfName(fileName);
      setShowPdfViewer(true);
    } catch (err) {
      console.error('Error getting document URL:', err);
      alert('Impossible de charger le document');
    }
  };

  const handleConfirmMove = async () => {
    if (!selectedDiscrepancy || !selectedRecord) return;

    setMoveLoading(true);
    setMoveError(null);

    const recordId =
      selectedRecord === 1
        ? selectedDiscrepancy.record1_id
        : selectedDiscrepancy.record2_id;
    const recordType =
      selectedRecord === 1
        ? selectedDiscrepancy.record1_type
        : selectedDiscrepancy.record2_type;

    try {
      const response = await fetch('/api/lease-discrepancies/move-to-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record_id: recordId,
          record_type: recordType,
          discrepancy_record1_id: selectedDiscrepancy.record1_id,
          discrepancy_record2_id: selectedDiscrepancy.record2_id,
          discrepancy_type: selectedDiscrepancy.discrepancy_type,
          reason: `${selectedDiscrepancy.severity} - ${selectedDiscrepancy.discrepancy_type}`,
          notes: moveNotes || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to move document');
      }

      console.log('Document moved successfully:', result);
      setShowMoveDialog(false);
      setMoveNotes('');
      setSelectedDiscrepancy(null);
      setSelectedRecord(null);
      fetchData(); // Refresh the list
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred';
      console.error('Move error:', err);
      setMoveError(errorMessage);
    } finally {
      setMoveLoading(false);
    }
  };

  const getRecordInfo = (recordNumber: 1 | 2) => {
    if (!selectedDiscrepancy) return null;

    if (recordNumber === 1) {
      return {
        type: selectedDiscrepancy.record1_type,
        dates: `${selectedDiscrepancy.start_date1} → ${selectedDiscrepancy.end_date1}`,
        rent: selectedDiscrepancy.rent1,
        file: selectedDiscrepancy.file1,
      };
    }
    return {
      type: selectedDiscrepancy.record2_type,
      dates: `${selectedDiscrepancy.start_date2} → ${selectedDiscrepancy.end_date2}`,
      rent: selectedDiscrepancy.rent2,
      file: selectedDiscrepancy.file2,
    };
  };

  const filteredDiscrepancies = useMemo(() => {
    if (!data) return [];

    if (severityFilter === 'all') return data.discrepancies;
    if (severityFilter === 'critical') return data.discrepancies.filter(d => d.severity.startsWith('CRITICAL'));
    if (severityFilter === 'high') return data.discrepancies.filter(d => d.severity.startsWith('HIGH'));
    if (severityFilter === 'medium') return data.discrepancies.filter(d => d.severity.startsWith('MEDIUM'));

    return data.discrepancies;
  }, [data, severityFilter]);

  const criticalCount = data?.summary.filter(s => s.severity === 'CRITICAL').reduce((sum, s) => sum + s.count, 0) || 0;
  const highCount = data?.summary.filter(s => s.severity === 'HIGH').reduce((sum, s) => sum + s.count, 0) || 0;
  const mediumCount = data?.summary.filter(s => s.severity === 'MEDIUM').reduce((sum, s) => sum + s.count, 0) || 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Chargement des discordances...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Erreur</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Discordances de Baux et Renouvellements</h1>
          <p className="text-muted-foreground mt-1">
            Audit de qualité des données pour les chevauchements de baux et renouvellements
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Problèmes Critiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Dates exactement identiques</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Haute Priorité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{highCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Périodes qui se chevauchent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              Priorité Moyenne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{mediumCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Lacunes dans les transitions</p>
          </CardContent>
        </Card>
      </div>

      {/* Discrepancies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Détails des Discordances</CardTitle>
          <CardDescription>
            Examiner et résoudre les chevauchements de baux et renouvellements pour le même dossier locataire
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrer par sévérité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous ({data?.total || 0})</SelectItem>
                <SelectItem value="critical">Critique ({criticalCount})</SelectItem>
                <SelectItem value="high">Haute ({highCount})</SelectItem>
                <SelectItem value="medium">Moyenne ({mediumCount})</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground">
              {filteredDiscrepancies.length} discordance(s)
            </div>
          </div>

          {filteredDiscrepancies.length === 0 ? (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Aucune discordance trouvée</p>
                    <p className="text-sm text-blue-700">
                      {severityFilter === 'all'
                        ? 'Excellent! Aucune discordance de bail ou renouvellement détectée.'
                        : `Aucune discordance de priorité ${severityFilter} trouvée.`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredDiscrepancies.map((disc, idx) => (
                <Card key={idx} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Header with severity and basic info */}
                    <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getDiscrepancyIcon(disc.severity)}
                        <span className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          getSeverityBadgeColor(disc.severity)
                        )}>
                          {disc.severity.split(' - ')[0]}
                        </span>
                        <div className="text-sm text-muted-foreground">
                          {disc.discrepancy_type === 'Lease-to-Lease Overlap' && 'Bail à Bail'}
                          {disc.discrepancy_type === 'Renewal-to-Renewal Overlap' && 'Renouvellement à Renouvellement'}
                          {disc.discrepancy_type === 'Lease-to-Renewal Overlap' && 'Bail à Renouvellement'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{disc.apartment_name || disc.apartment_folder}</div>
                        <div className="text-xs text-muted-foreground">{disc.tenant_names?.join(', ') || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Two documents side by side */}
                    <div className="grid grid-cols-2 divide-x">
                      {/* Document 1 */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-muted-foreground uppercase">
                            Document #1 ({disc.record1_type === 'lease' ? 'Bail' : 'Renouvellement'})
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewPdf(disc, 1)}
                              className="text-xs h-7"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Voir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMoveClick(disc, 1)}
                              className="text-xs h-7"
                            >
                              <FolderInput className="h-3 w-3 mr-1" />
                              Déplacer
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Période:</span>
                            <span className="font-medium">{disc.start_date1} → {disc.end_date1}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Loyer:</span>
                            <span className="font-medium">{parseFloat(disc.rent1).toFixed(2)} $</span>
                          </div>
                          <div className="text-xs text-muted-foreground break-all mt-2">
                            {disc.file1}
                          </div>
                        </div>
                      </div>

                      {/* Document 2 */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-muted-foreground uppercase">
                            Document #2 ({disc.record2_type === 'lease' ? 'Bail' : 'Renouvellement'})
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewPdf(disc, 2)}
                              className="text-xs h-7"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Voir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMoveClick(disc, 2)}
                              className="text-xs h-7"
                            >
                              <FolderInput className="h-3 w-3 mr-1" />
                              Déplacer
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Période:</span>
                            <span className="font-medium">{disc.start_date2} → {disc.end_date2}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Loyer:</span>
                            <span className="font-medium">{parseFloat(disc.rent2).toFixed(2)} $</span>
                          </div>
                          <div className="text-xs text-muted-foreground break-all mt-2">
                            {disc.file2}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer with overlap info */}
                    <div className="bg-muted/20 px-4 py-2 border-t text-center">
                      <span className="text-xs text-muted-foreground">
                        Chevauchement:
                      </span>
                      <span className="ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-800">
                        {disc.overlap_days} jours
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Comment résoudre les discordances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-blue-900">
            <li><strong>CRITIQUE</strong>: Dates exactement identiques indiquent des entrées en double. Supprimer l'un des enregistrements.</li>
            <li><strong>HAUTE</strong>: Périodes qui se chevauchent peuvent indiquer des erreurs de saisie. Vérifier les dates et ajuster en conséquence.</li>
            <li><strong>MOYENNE</strong>: Lacunes dans les transitions entre baux et renouvellements. Vérifier si intentionnel ou nécessite une correction.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Move Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Déplacer vers BAUX/SCAN/TO_VERIFY</DialogTitle>
            <DialogDescription>
              Ce document sera déplacé dans le dossier TO_VERIFY avec le suffixe
              _ERREURS pour vérification manuelle.
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && selectedDiscrepancy && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-md space-y-2">
                <div className="font-medium">
                  Document à déplacer:{' '}
                  {getRecordInfo(selectedRecord)?.type === 'lease'
                    ? 'Bail'
                    : 'Renouvellement'}{' '}
                  #{selectedRecord}
                </div>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="text-muted-foreground">Période:</span>{' '}
                    {getRecordInfo(selectedRecord)?.dates}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Loyer:</span>{' '}
                    {parseFloat(getRecordInfo(selectedRecord)?.rent || '0').toFixed(2)} $
                  </div>
                  <div className="text-xs text-muted-foreground break-all">
                    {getRecordInfo(selectedRecord)?.file}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optionnel)</label>
                <Textarea
                  placeholder="Ajouter des notes sur cette décision..."
                  value={moveNotes}
                  onChange={(e) => setMoveNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {moveError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-md text-sm">
                  <strong>Erreur:</strong> {moveError}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-md text-sm">
                <strong>Action:</strong> Le fichier sera déplacé vers{' '}
                <code className="bg-blue-100 px-1 rounded">
                  BAUX/SCAN/TO_VERIFY/[nom]_ERREURS.pdf
                </code>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMoveDialog(false);
                setMoveNotes('');
                setMoveError(null);
              }}
              disabled={moveLoading}
            >
              Annuler
            </Button>
            <Button onClick={handleConfirmMove} disabled={moveLoading}>
              {moveLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Déplacement...
                </>
              ) : (
                'Confirmer le déplacement'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <Dialog open={showPdfViewer} onOpenChange={setShowPdfViewer}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <DialogTitle className="text-lg font-semibold truncate pr-4">
                {viewingPdfName}
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPdfViewer(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 bg-gray-100">
              {viewingPdfUrl && (
                <iframe
                  src={viewingPdfUrl}
                  className="w-full h-full"
                  title="PDF Viewer"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
