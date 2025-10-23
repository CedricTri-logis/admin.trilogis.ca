/**
 * Contact Types for Duplicate Detection and Merge
 */

export interface ContactEmail {
  id: string;
  email: string;
  email_type: string;
  is_primary: boolean;
}

export interface ContactPhone {
  id: string;
  phone: string;
  phone_type: string;
  is_primary: boolean;
}

export interface ContactAddress {
  id: string;
  civic_number?: string;
  street_name?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  is_primary: boolean;
}

export interface Contact {
  id: string;
  display_name: string;
  contact_type: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth?: string;
  emails: ContactEmail[];
  phones: ContactPhone[];
  addresses: ContactAddress[];
  completeness_score: number;
  tenant_count: number;
  created_at: string;
}

export interface DuplicateGroup {
  identifier: string;
  type: 'name' | 'email' | 'phone';
  count: number;
  contacts: Contact[];
}

export interface MergeConflict {
  field: string;
  sourceValue: any;
  targetValue: any;
}

export interface MergePreview {
  conflicts: MergeConflict[];
  willTransfer: {
    emails: number;
    phones: number;
    addresses: number;
  };
  foreignKeyUpdates: Record<string, number>;
}

export interface MergeResult {
  success: boolean;
  source_contact_id: string;
  target_contact_id: string;
  conflicts: Record<string, any>;
  transferred: {
    emails: number;
    phones: number;
    addresses: number;
  };
  updated_references: Record<string, number>;
}
