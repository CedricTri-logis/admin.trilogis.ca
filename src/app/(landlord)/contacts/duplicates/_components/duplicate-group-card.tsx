'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Phone, Calendar, Building, Target, GitMerge, User, Building2, AlertTriangle, X, Edit2, Save, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { DuplicateGroup, Contact } from '@/lib/contacts/types';

interface DuplicateGroupCardProps {
  group: DuplicateGroup;
  selectedTarget?: string;
  onTargetChange?: (targetId: string) => void;
  onMerge: (sourceId: string, targetId: string) => void;
  onNotDuplicate?: (contactId1: string, contactId2: string) => void;
  onContactUpdated?: () => void;
}

export function DuplicateGroupCard({
  group,
  selectedTarget,
  onTargetChange,
  onMerge,
  onNotDuplicate,
  onContactUpdated
}: DuplicateGroupCardProps) {
  // Sort by completeness score (highest first - most complete = best target)
  const sortedContacts = [...group.contacts].sort(
    (a, b) => b.completeness_score - a.completeness_score
  );

  // No default target - user must choose
  const targetId = selectedTarget;

  // Edit mode state
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();

  const handleTargetChange = (newTargetId: string) => {
    if (onTargetChange) {
      onTargetChange(newTargetId);
    }
  };

  const handleEditClick = (contactId: string) => {
    const contact = sortedContacts.find(c => c.id === contactId);
    if (contact) {
      setEditingContactId(contactId);
      setEditedValues({
        contact_type: contact.contact_type,
        first_name: contact.first_name || '',
        middle_name: contact.middle_name || '',
        last_name: contact.last_name || '',
        display_name: contact.display_name || '',
        date_of_birth: contact.date_of_birth || '',
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingContactId(null);
    setEditedValues({});
  };

  const handleSaveEdit = async () => {
    if (!editingContactId) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/contacts/${editingContactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedValues),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Contact updated successfully',
        });
        setEditingContactId(null);
        setEditedValues({});

        // Refresh the duplicates list
        if (onContactUpdated) {
          onContactUpdated();
        }
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update contact',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update contact',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedValues({ ...editedValues, [field]: value });
  };

  // Check if there are type conflicts (mixing persons and businesses)
  const contactTypes = new Set(sortedContacts.map(c => c.contact_type));
  const hasTypeConflict = contactTypes.size > 1;

  // Define comparable fields
  const fields = [
    { key: 'contact_type', label: 'Type', icon: Building2 },
    { key: 'first_name', label: 'First Name', icon: User },
    { key: 'middle_name', label: 'Middle Name', icon: User },
    { key: 'last_name', label: 'Last Name', icon: User },
    { key: 'display_name', label: 'Display Name', icon: User },
    { key: 'date_of_birth', label: 'Date of Birth', icon: Calendar },
    { key: 'tenant_count', label: 'Tenant Records', icon: Building },
  ];

  const getFieldValue = (contact: Contact, fieldKey: string) => {
    const value = (contact as any)[fieldKey];
    if (fieldKey === 'date_of_birth' && value) {
      return new Date(value).toLocaleDateString();
    }
    if (fieldKey === 'contact_type') {
      return value === 'person' ? 'Person' : 'Business';
    }
    return value || '';
  };

  const hasFieldDifference = (fieldKey: string) => {
    const values = new Set(sortedContacts.map(c => getFieldValue(c, fieldKey)));
    return values.size > 1;
  };

  return (
    <Card className="p-6">
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold">{group.identifier}</h3>
            <p className="text-sm text-muted-foreground">
              {group.count} duplicate{group.count > 1 ? 's' : ''} found • Click "Set as Target" to choose which contact to keep
            </p>
          </div>
          {onNotDuplicate && sortedContacts.length === 2 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNotDuplicate(sortedContacts[0].id, sortedContacts[1].id)}
              className="ml-2"
            >
              <X className="h-3 w-3 mr-1" />
              Not Duplicates
            </Button>
          )}
        </div>

        {/* Type Conflict Warning */}
        {hasTypeConflict && (
          <Alert variant="destructive" className="mt-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Type Conflict:</strong> This group contains both Person and Business contacts.
              These should likely not be merged together. Consider marking them as "Not Duplicates".
            </AlertDescription>
          </Alert>
        )}

        {/* No Target Selected Warning */}
        {!targetId && (
          <Alert className="mt-3">
            <AlertDescription>
              <strong>No target selected.</strong> Click "Set as Target" on the contact you want to keep, then merge the others into it.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Field-by-Field Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr className="border-b-2">
              <th className="text-left px-2 py-2 bg-gray-50 font-semibold text-sm w-32">Field</th>
              {sortedContacts.map((contact, idx) => {
                const isTarget = contact.id === targetId;
                const isMostComplete = idx === 0;

                const isEditing = editingContactId === contact.id;

                return (
                  <th key={contact.id} className={`px-2 py-2 text-left ${isTarget ? 'bg-green-50' : isEditing ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {isEditing ? (
                          <Badge variant="default" className="bg-blue-600 text-xs px-1.5 py-0">
                            <Edit2 className="h-3 w-3 mr-0.5" />
                            Editing
                          </Badge>
                        ) : isTarget ? (
                          <Badge variant="default" className="bg-green-600 text-xs px-1.5 py-0">
                            <Target className="h-3 w-3 mr-0.5" />
                            Target
                          </Badge>
                        ) : targetId ? (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            Will merge
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            Choose
                          </Badge>
                        )}
                        {isMostComplete && !isTarget && !isEditing && (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            Complete
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contact.completeness_score}%
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={isSaving}
                              className="bg-blue-600 hover:bg-blue-700 text-xs h-6 px-2"
                            >
                              <Save className="h-3 w-3 mr-0.5" />
                              {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              disabled={isSaving}
                              className="text-xs h-6 px-2"
                            >
                              <XCircle className="h-3 w-3 mr-0.5" />
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClick(contact.id)}
                              className="text-xs h-6 px-2"
                            >
                              <Edit2 className="h-3 w-3 mr-0.5" />
                              Edit
                            </Button>
                            {!isTarget && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTargetChange(contact.id)}
                                className="text-xs h-6 px-2"
                              >
                                <Target className="h-3 w-3 mr-0.5" />
                                Set Target
                              </Button>
                            )}
                            {!isTarget && targetId && (
                              <Button
                                size="sm"
                                onClick={() => onMerge(contact.id, targetId)}
                                className="bg-orange-600 hover:bg-orange-700 text-xs h-6 px-2"
                              >
                                <GitMerge className="h-3 w-3 mr-0.5" />
                                Merge
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => {
              const hasDifference = hasFieldDifference(field.key);
              const FieldIcon = field.icon;

              // Skip if no contact has this field
              if (!sortedContacts.some(c => getFieldValue(c, field.key))) {
                return null;
              }

              return (
                <tr key={field.key} className={`border-b ${hasDifference ? 'bg-yellow-50' : ''}`}>
                  <td className="px-2 py-1.5 font-medium text-xs">
                    <div className="flex items-center gap-1">
                      <FieldIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{field.label}</span>
                      {hasDifference && (
                        <Badge variant="outline" className="text-xs bg-yellow-100 px-1 py-0 ml-1">
                          ≠
                        </Badge>
                      )}
                    </div>
                  </td>
                  {sortedContacts.map((contact) => {
                    const value = getFieldValue(contact, field.key);
                    const isTarget = contact.id === targetId;
                    const isEditing = editingContactId === contact.id;
                    const isEditable = field.key !== 'tenant_count'; // tenant_count is read-only

                    return (
                      <td
                        key={contact.id}
                        className={`px-2 py-1.5 text-xs ${isTarget ? 'bg-green-50 font-medium' : isEditing ? 'bg-blue-50' : ''}`}
                      >
                        {isEditing && isEditable ? (
                          field.key === 'contact_type' ? (
                            <Select
                              value={editedValues.contact_type || 'person'}
                              onValueChange={(val) => handleFieldChange('contact_type', val)}
                            >
                              <SelectTrigger className="h-6 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="person">Person</SelectItem>
                                <SelectItem value="business">Business</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : field.key === 'date_of_birth' ? (
                            <Input
                              type="date"
                              value={editedValues.date_of_birth || ''}
                              onChange={(e) => handleFieldChange('date_of_birth', e.target.value)}
                              className="h-6 text-xs"
                            />
                          ) : (
                            <Input
                              type="text"
                              value={editedValues[field.key] || ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="h-6 text-xs"
                              placeholder={field.label}
                            />
                          )
                        ) : (
                          value ? (
                            <span className={isTarget ? 'text-green-800' : ''}>
                              {value}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">empty</span>
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Emails Row */}
            <tr className="border-b">
              <td className="px-2 py-1.5 font-medium text-xs">
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span>Emails</span>
                </div>
              </td>
              {sortedContacts.map((contact) => {
                const isTarget = contact.id === targetId;
                return (
                  <td key={contact.id} className={`px-2 py-1.5 text-xs ${isTarget ? 'bg-green-50' : ''}`}>
                    {contact.emails && contact.emails.length > 0 ? (
                      <div className="space-y-0.5">
                        {contact.emails.map((e, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className={`truncate ${isTarget ? 'text-green-800 font-medium' : ''}`}>{e.email}</span>
                            {e.is_primary && (
                              <Badge variant="outline" className="text-xs px-1 py-0">P</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-xs">empty</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Phones Row */}
            <tr className="border-b">
              <td className="px-2 py-1.5 font-medium text-xs">
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span>Phones</span>
                </div>
              </td>
              {sortedContacts.map((contact) => {
                const isTarget = contact.id === targetId;
                return (
                  <td key={contact.id} className={`px-2 py-1.5 text-xs ${isTarget ? 'bg-green-50' : ''}`}>
                    {contact.phones && contact.phones.length > 0 ? (
                      <div className="space-y-0.5">
                        {contact.phones.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className={isTarget ? 'text-green-800 font-medium' : ''}>{p.phone}</span>
                            {p.is_primary && (
                              <Badge variant="outline" className="text-xs px-1 py-0">P</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-xs">empty</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
