'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Building2, ArrowRight } from 'lucide-react';
import { useState } from 'react';

interface Contact {
  id: string;
  display_name: string;
  contact_type: string;
  first_name?: string;
  last_name?: string;
}

interface ConvertToBusinessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
  onSuccess: () => void;
}

export function ConvertToBusinessDialog({
  open,
  onOpenChange,
  contact,
  onSuccess,
}: ConvertToBusinessDialogProps) {
  const [businessName, setBusinessName] = useState(contact.display_name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConvert = async () => {
    if (!businessName.trim()) {
      setError('Business name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/contacts/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          businessName: businessName.trim(),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(result.error || 'Failed to convert contact');
      }
    } catch (err) {
      console.error('Conversion error:', err);
      setError('Failed to convert contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convert to Business</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Contact */}
          <div className="flex items-center justify-center gap-3 p-4 bg-muted rounded-lg">
            <span className="font-medium">{contact.display_name}</span>
            <ArrowRight className="h-5 w-5" />
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Business</span>
          </div>

          {/* Business Name Input */}
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name *</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Enter business name"
            />
            <p className="text-sm text-muted-foreground">
              This will be the new name for this contact
            </p>
          </div>

          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>This will:</strong>
              <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                <li>Change contact type from Person to Business</li>
                <li>Remove person-specific data (middle name, date of birth)</li>
                <li>Keep all emails, phones, addresses, and tenant records</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={loading || !businessName.trim()}>
            {loading ? 'Converting...' : 'Convert to Business'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
