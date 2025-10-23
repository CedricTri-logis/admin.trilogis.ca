'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { MergePreview, Contact } from '@/lib/contacts/types';

interface MergePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: MergePreview | null;
  sourceContact: Contact | null;
  targetContact: Contact | null;
  onConfirm: (resolutions: Record<string, any>, reason: string) => Promise<void>;
}

export function MergePreviewDialog({
  open,
  onOpenChange,
  preview,
  sourceContact,
  targetContact,
  onConfirm,
}: MergePreviewDialogProps) {
  const [resolutions, setResolutions] = useState<Record<string, any>>({});
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('Duplicate contact detected during review');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      // Build final resolutions (use manual values if 'manual' was selected)
      const finalResolutions: Record<string, any> = {};
      for (const [field, value] of Object.entries(resolutions)) {
        if (value === 'manual') {
          finalResolutions[field] = manualValues[field];
        } else {
          finalResolutions[field] = value;
        }
      }

      await onConfirm(finalResolutions, reason);

      // Reset state
      setResolutions({});
      setManualValues({});
      setReason('Duplicate contact detected during review');
      onOpenChange(false);
    } catch (error) {
      console.error('Merge failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolutionChange = (field: string, value: string) => {
    setResolutions({ ...resolutions, [field]: value });
  };

  const handleManualChange = (field: string, value: string) => {
    setManualValues({ ...manualValues, [field]: value });
  };

  if (!preview || !sourceContact || !targetContact) return null;

  const conflicts = Object.entries(preview.conflicts || {});
  const hasConflicts = conflicts.length > 0;
  const allConflictsResolved =
    !hasConflicts ||
    conflicts.every(
      ([field]) =>
        resolutions[field] &&
        (resolutions[field] !== 'manual' || manualValues[field])
    );

  // Get all comparable fields
  const compareFields = [
    { key: 'contact_type', label: 'Contact Type', isConflict: !!preview.conflicts?.contact_type },
    { key: 'first_name', label: 'First Name', isConflict: !!preview.conflicts?.first_name },
    { key: 'middle_name', label: 'Middle Name', isConflict: !!preview.conflicts?.middle_name },
    { key: 'last_name', label: 'Last Name', isConflict: !!preview.conflicts?.last_name },
    { key: 'date_of_birth', label: 'Date of Birth', isConflict: !!preview.conflicts?.date_of_birth },
  ].filter(field => {
    // Only show if at least one contact has this field
    const sourceValue = (sourceContact as any)[field.key];
    const targetValue = (targetContact as any)[field.key];
    return sourceValue || targetValue;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge Preview</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source → Target */}
          <div className="flex items-center justify-center gap-3 p-4 bg-muted rounded-lg">
            <span className="font-medium">{sourceContact.display_name}</span>
            <ArrowRight className="h-5 w-5" />
            <span className="font-medium">{targetContact.display_name}</span>
          </div>

          {/* Conflicts Warning */}
          {hasConflicts && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{conflicts.length} conflict(s) detected.</strong>{' '}
                Please resolve all conflicts before merging.
              </AlertDescription>
            </Alert>
          )}

          {/* Field-by-Field Comparison */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">Field Comparison</h3>
            {compareFields.map((field) => {
              const sourceValue = (sourceContact as any)[field.key];
              const targetValue = (targetContact as any)[field.key];
              const isDifferent = sourceValue !== targetValue;
              const conflictData = preview.conflicts?.[field.key as keyof typeof preview.conflicts];

              return (
                <div
                  key={field.key}
                  className={`border rounded-lg p-4 ${
                    field.isConflict ? 'border-red-300 bg-red-50' : isDifferent ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Field Label */}
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold text-base">{field.label}</Label>
                      {field.isConflict && (
                        <span className="text-xs text-red-600 font-medium">CONFLICT - Choose one</span>
                      )}
                      {!field.isConflict && isDifferent && (
                        <span className="text-xs text-yellow-600 font-medium">Different (target kept)</span>
                      )}
                      {!isDifferent && (
                        <span className="text-xs text-green-600 font-medium">Same value</span>
                      )}
                    </div>

                    {/* Values Comparison */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Source (will be merged)</div>
                        <div className="p-2 bg-orange-100 rounded text-sm font-mono">
                          {sourceValue || <span className="text-gray-400 italic">empty</span>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground">Target (will be kept)</div>
                        <div className="p-2 bg-green-100 rounded text-sm font-mono">
                          {targetValue || <span className="text-gray-400 italic">empty</span>}
                        </div>
                      </div>
                    </div>

                    {/* Conflict Resolution */}
                    {field.isConflict && conflictData && (
                      <RadioGroup
                        value={resolutions[field.key] || ''}
                        onValueChange={(val) => handleResolutionChange(field.key, val)}
                      >
                        <div className="flex items-center space-x-2 p-2 rounded hover:bg-white">
                          <RadioGroupItem
                            value={(conflictData as any).source?.toString() || ''}
                            id={`source-${field.key}`}
                          />
                          <Label htmlFor={`source-${field.key}`} className="cursor-pointer">
                            Keep source value
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-2 rounded hover:bg-white">
                          <RadioGroupItem
                            value={(conflictData as any).target?.toString() || ''}
                            id={`target-${field.key}`}
                          />
                          <Label htmlFor={`target-${field.key}`} className="cursor-pointer">
                            Keep target value
                          </Label>
                        </div>
                        <div className="flex items-start space-x-2 p-2 rounded hover:bg-white">
                          <RadioGroupItem value="manual" id={`manual-${field.key}`} />
                          <div className="flex-1 space-y-2">
                            <Label htmlFor={`manual-${field.key}`} className="cursor-pointer">
                              Enter manually:
                            </Label>
                            <Input
                              type={field.key === 'date_of_birth' ? 'date' : 'text'}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                              disabled={resolutions[field.key] !== 'manual'}
                              value={manualValues[field.key] || ''}
                              onChange={(e) => handleManualChange(field.key, e.target.value)}
                            />
                          </div>
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Will Transfer */}
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Will transfer from source to target:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>
                  • <strong>{preview.willTransfer.emails}</strong> email(s)
                </li>
                <li>
                  • <strong>{preview.willTransfer.phones}</strong> phone(s)
                </li>
                <li>
                  • <strong>{preview.willTransfer.addresses}</strong> address(es)
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Foreign Key Updates */}
          {Object.keys(preview.foreignKeyUpdates).length > 0 && (
            <Alert>
              <AlertDescription>
                <strong>Will update references:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  {Object.entries(preview.foreignKeyUpdates).map(([table, count]) => (
                    <li key={table}>
                      • <strong>{count}</strong> records in{' '}
                      <code className="bg-muted px-1 py-0.5 rounded">{table}</code>
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for merge *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g., Duplicate tenant records from legacy import"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !allConflictsResolved || !reason.trim()}
          >
            {loading ? 'Merging...' : 'Confirm Merge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
