'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { Search, MoreVertical, Building2, User, Mail, Phone, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, GitMerge } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ConvertToBusinessDialog } from './_components/convert-to-business-dialog';
import { ManualMergeDialog } from './_components/manual-merge-dialog';

interface Contact {
  id: string;
  display_name: string;
  contact_type: 'person' | 'business';
  first_name?: string;
  last_name?: string;
  business_name?: string;
  email?: string;
  phone?: string;
  tenant_count: number;
  completeness_score: number;
  created_at: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState(''); // For debounced search
  const [typeFilter, setTypeFilter] = useState<'all' | 'person' | 'business'>('all');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [manualMergeDialogOpen, setManualMergeDialogOpen] = useState(false);
  const [mergeSourceContact, setMergeSourceContact] = useState<Contact | null>(null);
  const [sortColumn, setSortColumn] = useState<keyof Contact | null>('display_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const { toast } = useToast();

  useEffect(() => {
    fetchContacts();
  }, [typeFilter, currentPage, pageSize, sortColumn, sortDirection, search]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (search) params.append('search', search);
      params.append('limit', pageSize.toString());
      params.append('offset', ((currentPage - 1) * pageSize).toString());
      if (sortColumn) {
        params.append('sortBy', sortColumn);
        params.append('sortDir', sortDirection);
      }

      const response = await fetch(`/api/admin/contacts?${params}`);
      const result = await response.json();

      if (response.ok) {
        setContacts(result.data || []);
        setTotalCount(result.meta?.total || 0);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to fetch contacts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch contacts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToBusiness = (contact: Contact) => {
    setSelectedContact(contact);
    setConvertDialogOpen(true);
  };

  const handleConversionComplete = () => {
    setConvertDialogOpen(false);
    setSelectedContact(null);
    fetchContacts(); // Refresh list
    toast({
      title: 'Success',
      description: 'Contact converted to business successfully',
    });
  };

  const handleMergeClick = (contact: Contact) => {
    setMergeSourceContact(contact);
    setManualMergeDialogOpen(true);
  };

  const handleSort = (column: keyof Contact) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const handleSearch = () => {
    setSearch(searchInput);
    setCurrentPage(1);
  };

  const getSortIcon = (column: keyof Contact) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-2 text-muted-foreground" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-2" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-2" />
    );
  };

  // Server-side pagination - no need to filter/sort here
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value));
    setCurrentPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Contacts</h1>
        <p className="text-muted-foreground">
          Manage all contacts in your system
        </p>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </Card>

      {/* Tabs for Type Filter */}
      <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">
              All ({totalCount})
            </TabsTrigger>
            <TabsTrigger value="person">
              <User className="h-4 w-4 mr-2" />
              Persons
            </TabsTrigger>
            <TabsTrigger value="business">
              <Building2 className="h-4 w-4 mr-2" />
              Businesses
            </TabsTrigger>
          </TabsList>

          {/* Page Size Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">per page</span>
          </div>
        </div>

        <TabsContent value={typeFilter} className="mt-6 space-y-4">
          {loading ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Loading contacts...</p>
            </Card>
          ) : contacts.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No contacts found</p>
            </Card>
          ) : (
            <>
              {/* Contacts Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('display_name')}
                        className="h-8 font-semibold hover:bg-transparent p-0"
                      >
                        Name
                        {getSortIcon('display_name')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('contact_type')}
                        className="h-8 font-semibold hover:bg-transparent p-0"
                      >
                        Type
                        {getSortIcon('contact_type')}
                      </Button>
                    </TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('tenant_count')}
                        className="h-8 font-semibold hover:bg-transparent p-0"
                      >
                        Tenants
                        {getSortIcon('tenant_count')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('completeness_score')}
                        className="h-8 font-semibold hover:bg-transparent p-0"
                      >
                        Completeness
                        {getSortIcon('completeness_score')}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        onClick={() => handleSort('created_at')}
                        className="h-8 font-semibold hover:bg-transparent p-0"
                      >
                        Created
                        {getSortIcon('created_at')}
                      </Button>
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        {contact.display_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={contact.contact_type === 'person' ? 'default' : 'secondary'}>
                          {contact.contact_type === 'person' ? (
                            <><User className="h-3 w-3 mr-1" /> Person</>
                          ) : (
                            <><Building2 className="h-3 w-3 mr-1" /> Business</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {contact.email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{contact.tenant_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${contact.completeness_score}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {contact.completeness_score}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleMergeClick(contact)}
                            >
                              <GitMerge className="h-4 w-4 mr-2" />
                              Merge to Another Contact
                            </DropdownMenuItem>
                            {contact.contact_type === 'person' && (
                              <DropdownMenuItem
                                onClick={() => handleConvertToBusiness(contact)}
                              >
                                <Building2 className="h-4 w-4 mr-2" />
                                Convert to Business
                              </DropdownMenuItem>
                            )}
                            {contact.contact_type === 'business' && (
                              <DropdownMenuItem
                                onClick={() => toast({
                                  title: 'Coming soon',
                                  description: 'Convert to person will be available soon'
                                })}
                              >
                                <User className="h-4 w-4 mr-2" />
                                Convert to Person
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Pagination */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {endIndex} of {totalCount} contacts
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      // Show current page and 2 pages before/after
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Convert Dialog */}
      {selectedContact && (
        <ConvertToBusinessDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          contact={selectedContact}
          onSuccess={handleConversionComplete}
        />
      )}

      {/* Manual Merge Dialog */}
      <ManualMergeDialog
        open={manualMergeDialogOpen}
        onOpenChange={(open) => {
          setManualMergeDialogOpen(open);
          if (!open) {
            setMergeSourceContact(null);
          }
        }}
        initialSourceContact={mergeSourceContact}
        onSuccess={() => {
          setManualMergeDialogOpen(false);
          setMergeSourceContact(null);
          fetchContacts();
          toast({
            title: 'Success',
            description: 'Contacts merged successfully',
          });
        }}
      />
    </div>
  );
}
