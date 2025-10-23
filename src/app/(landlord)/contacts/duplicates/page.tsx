'use client';

import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useState, useEffect } from 'react';
import { DuplicateGroupCard } from './_components/duplicate-group-card';
import { MergePreviewDialog } from './_components/merge-preview-dialog';
import { useToast } from '@/hooks/use-toast';
import { GitMerge, Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { DuplicateGroup, MergePreview, Contact } from '@/lib/contacts/types';

export default function DuplicatesPage() {
  const [activeTab, setActiveTab] = useState<'name' | 'email' | 'phone'>('name');
  const [data, setData] = useState<DuplicateGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedMerge, setSelectedMerge] = useState<{
    sourceId: string;
    targetId: string;
  } | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [sourceContact, setSourceContact] = useState<Contact | null>(null);
  const [targetContact, setTargetContact] = useState<Contact | null>(null);
  const [batchMergeDialogOpen, setBatchMergeDialogOpen] = useState(false);
  const [isBatchMerging, setIsBatchMerging] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, merged: 0, skipped: 0 });

  // Track selected target for each duplicate group (key = group identifier, value = target contact ID)
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});

  const { toast } = useToast();

  // Fetch duplicates whenever tab changes
  useEffect(() => {
    fetchDuplicates();
  }, [activeTab]);

  const fetchDuplicates = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/contacts/duplicates?type=${activeTab}&limit=50`
      );
      const result = await response.json();

      if (response.ok) {
        const groups = result.data || [];
        setData(groups);
        // No default targets - user must choose
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to fetch duplicates',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch duplicates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMergeClick = async (sourceId: string, targetId: string) => {
    try {
      // Find contacts in current data
      const group = data.find((g) =>
        g.contacts.some((c) => c.id === sourceId || c.id === targetId)
      );

      if (!group) {
        toast({
          title: 'Error',
          description: 'Could not find contact details',
          variant: 'destructive',
        });
        return;
      }

      const source = group.contacts.find((c) => c.id === sourceId);
      const target = group.contacts.find((c) => c.id === targetId);

      if (!source || !target) {
        toast({
          title: 'Error',
          description: 'Could not find contact details',
          variant: 'destructive',
        });
        return;
      }

      // Fetch merge preview
      const response = await fetch('/api/admin/contacts/merge/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId }),
      });

      const result = await response.json();

      if (response.ok) {
        const preview = result.data;
        const hasConflicts = Object.keys(preview.conflicts || {}).length > 0;

        if (hasConflicts) {
          // Show preview dialog for conflict resolution
          setPreview(preview);
          setSourceContact(source);
          setTargetContact(target);
          setSelectedMerge({ sourceId, targetId });
          setMergeDialogOpen(true);
        } else {
          // No conflicts - auto-merge immediately
          const mergeResponse = await fetch('/api/admin/contacts/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sourceId,
              targetId,
              conflictResolutions: {},
              reason: 'One-click merge - no conflicts detected',
            }),
          });

          const mergeResult = await mergeResponse.json();

          if (mergeResponse.ok) {
            toast({
              title: 'Success',
              description: 'Contacts merged successfully',
            });
            // Refresh data
            await fetchDuplicates();
          } else {
            toast({
              title: 'Merge failed',
              description: mergeResult.error || 'Failed to merge contacts',
              variant: 'destructive',
            });
          }
        }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to preview merge',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: 'Error',
        description: 'Failed to preview merge',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmMerge = async (
    resolutions: Record<string, any>,
    reason: string
  ) => {
    if (!selectedMerge) return;

    try {
      const response = await fetch('/api/admin/contacts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: selectedMerge.sourceId,
          targetId: selectedMerge.targetId,
          conflictResolutions: resolutions,
          reason,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Contacts have been merged successfully.',
        });

        // Refresh data
        await fetchDuplicates();

        // Close dialog
        setMergeDialogOpen(false);
        setSelectedMerge(null);
        setPreview(null);
        setSourceContact(null);
        setTargetContact(null);
      } else {
        toast({
          title: 'Merge failed',
          description: result.error || 'Failed to merge contacts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Merge error:', error);
      toast({
        title: 'Error',
        description: 'Failed to merge contacts',
        variant: 'destructive',
      });
    }
  };

  const handleNotDuplicate = async (contactId1: string, contactId2: string) => {
    try {
      const response = await fetch('/api/admin/contacts/not-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId1,
          contactId2,
          reason: 'Marked as not duplicate from duplicates page',
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Contacts marked as not duplicates',
        });

        // Refresh duplicates list
        await fetchDuplicates();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to mark as not duplicates',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Not duplicate error:', error);
      toast({
        title: 'Error',
        description: 'Failed to mark as not duplicates',
        variant: 'destructive',
      });
    }
  };

  const handleBatchMerge = async () => {
    setBatchMergeDialogOpen(false);
    setIsBatchMerging(true);
    setBatchProgress({ current: 0, total: data.length, merged: 0, skipped: 0 });

    let merged = 0;
    let skipped = 0;

    for (let i = 0; i < data.length; i++) {
      const group = data[i];

      // Skip if less than 2 contacts
      if (group.contacts.length < 2) {
        skipped++;
        setBatchProgress({ current: i + 1, total: data.length, merged, skipped });
        continue;
      }

      // Use the selected target for this group
      const targetId = selectedTargets[group.identifier];
      if (!targetId) {
        skipped++;
        setBatchProgress({ current: i + 1, total: data.length, merged, skipped });
        continue;
      }

      // Get all contacts that are not the target (sources to merge)
      const sourceContacts = group.contacts.filter(c => c.id !== targetId);

      // Merge each source into the target
      for (const sourceContact of sourceContacts) {
        try {
          // Check for conflicts via preview
          const previewResponse = await fetch('/api/admin/contacts/merge/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceId: sourceContact.id, targetId }),
          });

          const previewResult = await previewResponse.json();

          if (!previewResponse.ok || !previewResult.data) {
            skipped++;
            continue;
          }

          const preview = previewResult.data;
          const hasConflicts = Object.keys(preview.conflicts || {}).length > 0;

          if (hasConflicts) {
            // Skip if there are conflicts
            skipped++;
          } else {
            // No conflicts, proceed with merge
            const mergeResponse = await fetch('/api/admin/contacts/merge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceId: sourceContact.id,
                targetId,
                conflictResolutions: {},
                reason: 'Batch merge using selected target',
              }),
            });

            if (mergeResponse.ok) {
              merged++;
            } else {
              skipped++;
            }
          }
        } catch (error) {
          console.error('Batch merge error for contact:', sourceContact.id, error);
          skipped++;
        }

        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setBatchProgress({ current: i + 1, total: data.length, merged, skipped });
    }

    setIsBatchMerging(false);

    toast({
      title: 'Batch merge complete',
      description: `${merged} groups merged, ${skipped} skipped (conflicts or errors)`,
    });

    // Refresh data
    await fetchDuplicates();
  };

  const totalDuplicates = data.reduce((sum, group) => sum + group.count, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contact Duplicates</h1>
          <p className="text-muted-foreground">
            Detect and merge duplicate contacts across your system
          </p>
        </div>
        <Button
          onClick={() => setBatchMergeDialogOpen(true)}
          disabled={isLoading || data.length === 0 || isBatchMerging}
          size="lg"
          className="gap-2"
        >
          <GitMerge className="h-5 w-5" />
          Merge All Without Conflicts
        </Button>
      </div>

      {/* Batch Merge Progress */}
      {isBatchMerging && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Processing duplicates...</span>
                <span>{batchProgress.current} / {batchProgress.total}</span>
              </div>
              <Progress value={(batchProgress.current / batchProgress.total) * 100} />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Merged: {batchProgress.merged}
                </span>
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-orange-600" />
                  Skipped: {batchProgress.skipped}
                </span>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="name">By Name</TabsTrigger>
          <TabsTrigger value="email">By Email</TabsTrigger>
          <TabsTrigger value="phone">By Phone</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-6">
          {/* Stats */}
          {!isLoading && data.length > 0 && (
            <div className="flex gap-4">
              <Card className="p-4">
                <div className="text-2xl font-bold">{data.length}</div>
                <div className="text-sm text-muted-foreground">
                  Duplicate Group{data.length !== 1 ? 's' : ''}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold">{totalDuplicates}</div>
                <div className="text-sm text-muted-foreground">
                  Total Duplicate{totalDuplicates !== 1 ? 's' : ''}
                </div>
              </Card>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : data.length === 0 ? (
            /* Empty State */
            <Card className="p-12 text-center">
              <div className="flex flex-col items-center gap-2">
                <Badge variant="outline" className="mb-2">
                  No Duplicates Found
                </Badge>
                <p className="text-muted-foreground">
                  No duplicate contacts found by {activeTab}. Your contact database looks clean!
                </p>
              </div>
            </Card>
          ) : (
            /* Duplicate Groups */
            <div className="space-y-4">
              {data.map((group) => (
                <DuplicateGroupCard
                  key={group.identifier}
                  group={group}
                  selectedTarget={selectedTargets[group.identifier]}
                  onTargetChange={(targetId) =>
                    setSelectedTargets({ ...selectedTargets, [group.identifier]: targetId })
                  }
                  onMerge={handleMergeClick}
                  onNotDuplicate={handleNotDuplicate}
                  onContactUpdated={fetchDuplicates}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Merge Preview Dialog */}
      {selectedMerge && preview && sourceContact && targetContact && (
        <MergePreviewDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          preview={preview}
          sourceContact={sourceContact}
          targetContact={targetContact}
          onConfirm={handleConfirmMerge}
        />
      )}

      {/* Batch Merge Confirmation Dialog */}
      <Dialog open={batchMergeDialogOpen} onOpenChange={setBatchMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge All Without Conflicts</DialogTitle>
            <DialogDescription>
              This will automatically merge all duplicate groups using your selected targets.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">What will happen:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Only groups with a selected target will be processed</li>
                    <li>Groups without a target will be skipped</li>
                    <li>Each group will merge into the contact you selected as "Target (Keep)"</li>
                    <li>Groups without conflicts will be merged automatically</li>
                    <li>Groups with conflicts will be skipped (you can merge them manually later)</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground">
              <strong>{Object.keys(selectedTargets).length}</strong> of <strong>{data.length}</strong> groups have targets selected
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchMergeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBatchMerge}>
              Start Batch Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
