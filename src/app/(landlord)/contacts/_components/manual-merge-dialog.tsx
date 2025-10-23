'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import React, { useState } from 'react';
import { Search, User, Building2, Mail, Phone, ArrowRight, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MergePreviewDialog } from '../duplicates/_components/merge-preview-dialog';
import type { Contact, MergePreview } from '@/lib/contacts/types';

interface ManualMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialSourceContact?: {
    id: string;
    display_name: string;
    contact_type: 'person' | 'business';
    email?: string;
    phone?: string;
    tenant_count: number;
  } | null;
}

interface SearchResult {
  id: string;
  display_name: string;
  contact_type: 'person' | 'business';
  first_name?: string;
  last_name?: string;
  business_name?: string;
  email?: string;
  phone?: string;
  tenant_count: number;
}

export function ManualMergeDialog({
  open,
  onOpenChange,
  onSuccess,
  initialSourceContact,
}: ManualMergeDialogProps) {
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [sourceResults, setSourceResults] = useState<SearchResult[]>([]);
  const [targetResults, setTargetResults] = useState<SearchResult[]>([]);
  const [selectedSource, setSelectedSource] = useState<SearchResult | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState<'source' | 'target' | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [sourceContactFull, setSourceContactFull] = useState<Contact | null>(null);
  const [targetContactFull, setTargetContactFull] = useState<Contact | null>(null);

  const { toast } = useToast();

  // Set initial source contact when dialog opens
  React.useEffect(() => {
    if (open && initialSourceContact) {
      setSelectedSource(initialSourceContact as SearchResult);
    } else if (!open) {
      // Reset when dialog closes
      setSelectedSource(null);
      setSelectedTarget(null);
      setSourceSearch('');
      setTargetSearch('');
      setSourceResults([]);
      setTargetResults([]);
    }
  }, [open, initialSourceContact]);

  const handleSearch = async (query: string, type: 'source' | 'target') => {
    if (!query.trim() || query.length < 2) {
      if (type === 'source') setSourceResults([]);
      else setTargetResults([]);
      return;
    }

    setSearching(type);

    try {
      const params = new URLSearchParams({
        search: query,
        limit: '10',
      });

      const response = await fetch(`/api/admin/contacts?${params}`);
      const result = await response.json();

      if (response.ok) {
        if (type === 'source') {
          setSourceResults(result.data || []);
        } else {
          setTargetResults(result.data || []);
        }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to search contacts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Error',
        description: 'Failed to search contacts',
        variant: 'destructive',
      });
    } finally {
      setSearching(null);
    }
  };

  const handleSelectSource = (contact: SearchResult) => {
    setSelectedSource(contact);
    setSourceResults([]);
    setSourceSearch('');
  };

  const handleSelectTarget = (contact: SearchResult) => {
    setSelectedTarget(contact);
    setTargetResults([]);
    setTargetSearch('');
  };

  const handlePreviewMerge = async () => {
    if (!selectedSource || !selectedTarget) return;

    if (selectedSource.id === selectedTarget.id) {
      toast({
        title: 'Error',
        description: 'Cannot merge a contact with itself',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Fetch full contact details for both
      const [sourceResponse, targetResponse] = await Promise.all([
        fetch(`/api/admin/contacts/${selectedSource.id}`),
        fetch(`/api/admin/contacts/${selectedTarget.id}`),
      ]);

      const [sourceResult, targetResult] = await Promise.all([
        sourceResponse.json(),
        targetResponse.json(),
      ]);

      if (!sourceResponse.ok || !targetResponse.ok) {
        toast({
          title: 'Error',
          description: 'Failed to fetch contact details',
          variant: 'destructive',
        });
        return;
      }

      setSourceContactFull(sourceResult.data);
      setTargetContactFull(targetResult.data);

      // Fetch merge preview
      const previewResponse = await fetch('/api/admin/contacts/merge/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: selectedSource.id,
          targetId: selectedTarget.id,
        }),
      });

      const previewResult = await previewResponse.json();

      if (previewResponse.ok) {
        setPreview(previewResult.data);
        setPreviewDialogOpen(true);
      } else {
        toast({
          title: 'Error',
          description: previewResult.error || 'Failed to preview merge',
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
    if (!selectedSource || !selectedTarget) return;

    try {
      const response = await fetch('/api/admin/contacts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: selectedSource.id,
          targetId: selectedTarget.id,
          conflictResolutions: resolutions,
          reason,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Contacts merged successfully',
        });

        // Reset and close
        setSelectedSource(null);
        setSelectedTarget(null);
        setSourceSearch('');
        setTargetSearch('');
        setPreview(null);
        setSourceContactFull(null);
        setTargetContactFull(null);
        setPreviewDialogOpen(false);
        onOpenChange(false);
        onSuccess();
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

  const handleClose = () => {
    setSelectedSource(null);
    setSelectedTarget(null);
    setSourceSearch('');
    setTargetSearch('');
    setSourceResults([]);
    setTargetResults([]);
    setPreview(null);
    setSourceContactFull(null);
    setTargetContactFull(null);
    onOpenChange(false);
  };

  const ContactCard = ({ contact, type }: { contact: SearchResult; type: 'source' | 'target' }) => (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={contact.contact_type === 'person' ? 'default' : 'secondary'}>
            {contact.contact_type === 'person' ? (
              <><User className="h-3 w-3 mr-1" /> Person</>
            ) : (
              <><Building2 className="h-3 w-3 mr-1" /> Business</>
            )}
          </Badge>
          <span className="font-medium">{contact.display_name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => type === 'source' ? setSelectedSource(null) : setSelectedTarget(null)}
        >
          Change
        </Button>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        {contact.email && (
          <div className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {contact.email}
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {contact.phone}
          </div>
        )}
        {contact.tenant_count > 0 && (
          <div className="text-xs">
            <Badge variant="outline">{contact.tenant_count} tenant(s)</Badge>
          </div>
        )}
      </div>
    </div>
  );

  const SearchInput = ({
    value,
    onChange,
    onSearch,
    results,
    onSelect,
    placeholder,
    loading,
  }: {
    value: string;
    onChange: (val: string) => void;
    onSearch: () => void;
    results: SearchResult[];
    onSelect: (contact: SearchResult) => void;
    placeholder: string;
    loading: boolean;
  }) => (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={onSearch} disabled={loading || value.length < 2}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {/* Search Results */}
      {results.length > 0 && (
        <div className="border rounded-lg max-h-60 overflow-y-auto">
          {results.map((contact) => (
            <button
              key={contact.id}
              onClick={() => onSelect(contact)}
              className="w-full text-left p-3 hover:bg-muted border-b last:border-b-0 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={contact.contact_type === 'person' ? 'default' : 'secondary'} className="text-xs">
                      {contact.contact_type === 'person' ? (
                        <><User className="h-3 w-3 mr-1" /> Person</>
                      ) : (
                        <><Building2 className="h-3 w-3 mr-1" /> Business</>
                      )}
                    </Badge>
                    <span className="font-medium">{contact.display_name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                    {contact.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {contact.email}
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open && !previewDialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manual Contact Merge</DialogTitle>
            <DialogDescription>
              Search and select two contacts to merge. The source contact will be merged into the target contact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Source Contact */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">1. Source Contact (will be merged away)</Label>
              {selectedSource ? (
                <ContactCard contact={selectedSource} type="source" />
              ) : (
                <SearchInput
                  value={sourceSearch}
                  onChange={setSourceSearch}
                  onSearch={() => handleSearch(sourceSearch, 'source')}
                  results={sourceResults}
                  onSelect={handleSelectSource}
                  placeholder="Search for source contact..."
                  loading={searching === 'source'}
                />
              )}
            </div>

            {/* Arrow */}
            {selectedSource && selectedTarget && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowRight className="h-6 w-6" />
                  <span className="text-sm">Will merge into</span>
                  <ArrowRight className="h-6 w-6" />
                </div>
              </div>
            )}

            {/* Target Contact */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">2. Target Contact (will be kept)</Label>
              {selectedTarget ? (
                <ContactCard contact={selectedTarget} type="target" />
              ) : (
                <SearchInput
                  value={targetSearch}
                  onChange={setTargetSearch}
                  onSearch={() => handleSearch(targetSearch, 'target')}
                  results={targetResults}
                  onSelect={handleSelectTarget}
                  placeholder="Search for target contact..."
                  loading={searching === 'target'}
                />
              )}
            </div>

            {/* Warning about same contact */}
            {selectedSource && selectedTarget && selectedSource.id === selectedTarget.id && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You cannot merge a contact with itself. Please select two different contacts.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handlePreviewMerge}
              disabled={!selectedSource || !selectedTarget || selectedSource.id === selectedTarget.id}
            >
              Preview Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Preview Dialog */}
      {preview && sourceContactFull && targetContactFull && (
        <MergePreviewDialog
          open={previewDialogOpen}
          onOpenChange={(open) => {
            setPreviewDialogOpen(open);
            if (!open) {
              // If closing preview without completing, reset to main dialog
              setPreview(null);
              setSourceContactFull(null);
              setTargetContactFull(null);
            }
          }}
          preview={preview}
          sourceContact={sourceContactFull}
          targetContact={targetContactFull}
          onConfirm={handleConfirmMerge}
        />
      )}
    </>
  );
}
