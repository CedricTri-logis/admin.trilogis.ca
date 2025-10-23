# Refine v5 + Shadcn Project Structure Analysis
## Admin Portal: admin.trilogis.ca

---

## 1. REFINE V5 CONFIGURATION

### 1.1 Main Application Entry Point
**File**: `/Users/cedriclajoie/Project/cs50/admin.trilogis.ca/src/app/layout.tsx`

The root layout wraps the entire application with:
- **SessionProvider**: Manages Supabase authentication state
- **RefineProvider**: Configures Refine core, data providers, and routing
- **Toaster**: react-hot-toast for notifications

```tsx
<SessionProvider>
  <RefineProvider>
    {children}
  </RefineProvider>
</SessionProvider>
<Toaster />
```

### 1.2 Refine Provider Configuration
**File**: `/Users/cedriclajoie/Project/cs50/admin.trilogis.ca/src/components/providers/RefineProvider.tsx`

Key setup:

- **Router Provider**: Uses `@refinedev/nextjs-router/app` for Next.js App Router integration
- **Data Provider**: Supabase via `@refinedev/supabase`
- **Live Provider**: Supabase real-time subscriptions
- **Auth Provider**: Custom implementation using Supabase auth
- **Routing**: Synced with Next.js navigation, disables sync with URL location (`syncWithLocation: false`)

#### Resource Definitions:
```tsx
const resources: IResourceItem[] = [
  {
    name: "dashboard",
    list: "/dashboard",
  },
  {
    name: "landlord-access",
    list: "/landlord-access",
    create: "/landlord-access/create",
    edit: "/landlord-access/edit/:id",
    meta: {
      label: "Landlord Access",
      schema: "portal_auth",
      canDelete: true,
    },
  },
  {
    name: "landlord-categories",
    list: "/landlord-categories",
    create: "/landlord-categories/create",
    edit: "/landlord-categories/edit/:id",
    meta: {
      label: "Landlord Categories",
      schema: "portal_auth",
      canDelete: true,
    },
  },
  {
    name: "apartments_tal_dossiers",
    list: "/integration/apartments-tal-dossiers",
    meta: {
      label: "TAL Dossiers",
      schema: "integration",
    },
  },
  {
    name: "tal_recours",
    list: "/integration/tal-recours",
    meta: {
      label: "TAL Recours",
      schema: "integration",
    },
  },
  {
    name: "buildings",
    list: "/propriete/immeubles",
    create: "/propriete/immeubles/create",
    edit: "/propriete/immeubles/edit/:id",
    meta: {
      label: "Immeubles",
      schema: "public",
    },
  },
  {
    name: "apartments",
    list: "/propriete/apartments",
    create: "/propriete/apartments/create",
    edit: "/propriete/apartments/edit/:id",
    meta: {
      label: "Apartments",
      schema: "public",
    },
  },
]
```

#### Auth Provider Implementation:
- Custom login/register/logout/password reset
- Role-based permissions via `app_metadata.role`
- Identity retrieval from Supabase user
- Error handling with `onError` callback

### 1.3 Supabase Data Provider Setup
**File**: `/Users/cedriclajoie/Project/cs50/admin.trilogis.ca/src/lib/supabase/client.ts`

Browser client creation:
```tsx
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 1.4 Session/Auth Provider
**File**: `/Users/cedriclajoie/Project/cs50/admin.trilogis.ca/src/components/providers/SessionProvider.tsx`

Separate from Refine's auth provider:
- Manages session state in React Context
- Listens to Supabase auth state changes
- Provides refresh and signOut methods
- Hydrates session on mount
- Exports `useSession()` hook

---

## 2. PROJECT STRUCTURE

### 2.1 Directory Organization

```
/src
├── /app
│   ├── layout.tsx (root with providers)
│   ├── page.tsx (redirect to dashboard)
│   ├── login/
│   │   └── page.tsx (login page)
│   ├── /api (API routes)
│   │   ├── /auth
│   │   ├── /quickbooks
│   │   ├── /accounting
│   │   ├── /lease-discrepancies
│   │   └── /landlord
│   ├── /(landlord) (authenticated routes)
│   │   ├── layout.tsx (with DashboardShell)
│   │   ├── /dashboard
│   │   ├── /accounting
│   │   ├── /landlord-access
│   │   ├── /landlord-categories
│   │   ├── /propriete (immeubles, apartments, photo)
│   │   ├── /integration (TAL, QuickBooks, lease-discrepancies)
│   │   ├── /collecte (actuel, ancien)
│   │   └── /settings
│
├── /components
│   ├── /ui (shadcn components)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   ├── form.tsx
│   │   ├── select.tsx
│   │   ├── input.tsx
│   │   ├── checkbox.tsx
│   │   ├── popover.tsx
│   │   ├── calendar.tsx
│   │   ├── label.tsx
│   │   ├── textarea.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── sheet.tsx
│   │   ├── avatar.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   └── toaster.tsx
│   ├── /providers
│   │   ├── RefineProvider.tsx
│   │   └── SessionProvider.tsx
│   ├── /landlord
│   │   └── DashboardShell.tsx (main layout with navigation)
│   ├── /auth
│   │   └── GoogleOAuthButton.tsx
│   └── /collecte (custom components)
│       ├── CommentsCell.tsx
│       ├── EditableDueDateCell.tsx
│       └── EditableStatusCell.tsx
│
├── /hooks
│   └── use-toast.ts (shadcn toast hook)
│
└── /lib
    ├── /supabase
    │   ├── client.ts (browser client)
    │   ├── server.ts (server client)
    │   └── service-role-client.ts
    ├── /quickbooks
    │   ├── qb-service.ts
    │   └── types.ts
    ├── /services
    │   └── portal-service.ts
    └── utils.ts (cn, formatDateOnly)
```

### 2.2 Routing Structure

**Next.js App Router** with route groups:
- `/(landlord)` - Protected routes (wrapped with auth check in layout)
- All pages are async server components or marked with `"use client"`
- Dynamic routes use `[id]` and `[slug]` patterns

### 2.3 API/Data Layer Structure

API routes in `/src/app/api/`:
- Each feature has its own route handler
- Examples:
  - `/api/quickbooks/auth/connect`
  - `/api/quickbooks/invoices/bulk-update`
  - `/api/lease-discrepancies/route`
  - `/api/accounting/data`

---

## 3. SHADCN COMPONENTS

### 3.1 Installed Components
All components use **Radix UI** primitives with Tailwind CSS:

| Component | Purpose | Radix Primitive |
|-----------|---------|-----------------|
| button.tsx | Primary action trigger | - (custom) |
| card.tsx | Content container | - (custom) |
| dialog.tsx | Modal dialogs | @radix-ui/react-dialog |
| table.tsx | Data display | - (custom) |
| form.tsx | React Hook Form integration | - (custom) |
| select.tsx | Dropdown selection | @radix-ui/react-select |
| input.tsx | Text input | - (custom) |
| checkbox.tsx | Toggle boolean | @radix-ui/react-checkbox |
| label.tsx | Form labels | @radix-ui/react-label |
| textarea.tsx | Multi-line text | - (custom) |
| dropdown-menu.tsx | Menu actions | @radix-ui/react-dropdown-menu |
| sheet.tsx | Side panels (mobile nav) | @radix-ui/react-dialog |
| popover.tsx | Floating panels | @radix-ui/react-popover |
| calendar.tsx | Date picker | (custom + react-day-picker) |
| avatar.tsx | User avatars | @radix-ui/react-avatar |
| skeleton.tsx | Loading placeholders | - (custom) |
| toast.tsx | Notifications | @radix-ui/react-toast |
| toaster.tsx | Toast container | react-hot-toast |

### 3.2 Component Library Location
- **Path**: `/src/components/ui/`
- **Style**: New York (shadcn default)
- **Icon Library**: Lucide React (`lucide-react`)
- **CSS Framework**: Tailwind CSS with CSS variables
- **Base Color**: Neutral

### 3.3 Custom Components Built on Shadcn

**DashboardShell** (`/src/components/landlord/DashboardShell.tsx`):
- Combines button, dropdown-menu, avatar, sheet for complex navigation
- Expandable menu sections with chevron icons
- Responsive desktop/mobile navigation
- Shows notification badges (e.g., uncategorized count, lease discrepancies)

**Collecte Components**:
- `CommentsCell.tsx` - Inline comments in tables
- `EditableDueDateCell.tsx` - Inline date editing
- `EditableStatusCell.tsx` - Inline status changing

---

## 4. EXISTING CRUD PATTERNS

### 4.1 List Pages Pattern

**Pattern File**: `/Users/cedriclajoie/Project/cs50/admin.trilogis.ca/src/app/(landlord)/landlord-access/page.tsx`

```tsx
"use client"

export default function LandlordAccessList() {
  const { data, isLoading } = useList<LandlordAccessRecord>({
    resource: "landlord-access",
    meta: {
      select: "id,user_id,created_at,revoked_at",
      schema: "portal_auth",
    },
  })

  const records = data?.data ?? []

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Landlord access</CardTitle>
          <CardDescription>Grant and monitor landlord portal access</CardDescription>
        </div>
        <Button asChild size="sm">
          <Link href="/landlord-access/create">
            <PlusCircle className="mr-2 h-4 w-4" />
            Grant access
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User ID</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(3)].map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  {/* More skeleton cells... */}
                </TableRow>
              ))
            ) : records.length ? (
              records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.user_id}</TableCell>
                  <TableCell>{new Date(record.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    {record.revoked_at ? `Revoked ${formatDateOnly(record.revoked_at)}` : "Active"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/landlord-access/edit/${record.id}`}>Manage</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

**Key Pattern Elements**:
1. `useList()` from Refine Core
2. `isLoading` state with Skeleton placeholders
3. Card wrapper with header and action button
4. Table with header, body, and empty state
5. `meta` object with schema and select fields
6. Link-based navigation for actions

### 4.2 Complex List with Filtering & Sorting

**Pattern File**: `/Users/cedriclajoie/Project/cs50/admin.trilogis.ca/src/app/(landlord)/integration/quickbooks/page.tsx` (1000+ lines)

Key features:
- Advanced filtering with Select components
- Date range presets with custom date inputs
- Checkbox filters (exclude-trilogis)
- Sortable column headers with icons (↑↓)
- Pagination with canPrevious/canNext
- Custom RPC calls via Supabase
- Direct state management (useState)
- URL query parameter persistence
- Row click handlers for navigation

### 4.3 Create/Edit Forms Pattern

**Create Pattern**: `/Users/cedriclajoie/Project/cs50/admin.trilogis.ca/src/app/(landlord)/landlord-access/create/page.tsx`

```tsx
"use client"

const schema = z.object({
  user_id: z.string().min(1, "User ID is required"),
})

type FormValues = z.infer<typeof schema>

export default function CreateLandlordAccessPage() {
  const router = useRouter()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    refineCoreProps: {
      resource: "landlord-access",
      action: "create",
      meta: {
        schema: "portal_auth",
      },
      redirect: "list",
    },
    defaultValues: {
      user_id: "",
    },
  })

  const {
    refineCore: { onFinish, formLoading },
    handleSubmit,
    control,
  } = form

  const onSubmit = handleSubmit(async (values) => {
    await onFinish(values)
    router.push("/landlord-access")
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Grant landlord access</CardTitle>
        <CardDescription>Provide a Supabase user ID</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <FormField
              control={control}
              name="user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User ID</FormLabel>
                  <FormControl>
                    <Input placeholder="UUID..." className="font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={formLoading}>
                {formLoading ? "Saving..." : "Grant access"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.push("/landlord-access")}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

**Key Pattern Elements**:
1. Zod schema for validation
2. `useForm()` from `@refinedev/react-hook-form`
3. `zodResolver` for validation
4. `refineCoreProps` with resource, action, redirect
5. Form component from shadcn with FormField
6. Control flow with `onFinish` callback
7. Loading state management
8. Manual router.push for final navigation

**Edit Pattern**: `/Users/cedriclajoie/Project/cs50/admin.trilogis.ca/src/app/(landlord)/landlord-access/edit/[id]/page.tsx`

Similar to create, but:
- Uses `useParams()` to get `[id]`
- Sets `action: "edit"` instead of `"create"`
- Has `queryResult?.data?.data` for initial data
- Uses `useEffect` to populate form with fetched data
- Updates existing record instead of creating new

### 4.4 Modal/Dialog Patterns

**Pattern File**: `/Users/cedriclajoie/Project/cs50/admin.trilogis.ca/src/app/(landlord)/integration/apartments-tal-dossiers/page.tsx` (850+ lines)

Dialog implementation:
```tsx
<Dialog open={!!selectedDossier} onOpenChange={() => {
  setSelectedDossier(null)
  setSelectedApartmentId(null)
}}>
  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Dossier {selectedDossier?.dossier}</DialogTitle>
      <DialogDescription>Complete dossier information</DialogDescription>
    </DialogHeader>
    {selectedDossier && (
      <div className="space-y-6">
        {/* Dialog content with nested selects and forms */}
        <Select value={selectedBuildingId || "none"} onValueChange={handleBuildingChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select a building..." />
          </SelectTrigger>
          <SelectContent>
            {buildings.map((building) => (
              <SelectItem key={building.id} value={building.id}>
                {building.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button onClick={handleSaveAssignment} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    )}
  </DialogContent>
</Dialog>
```

**Key Dialog Pattern**:
1. Open state controlled by existence of selectedItem
2. DialogContent wraps all content
3. DialogHeader with title and description
4. Nested forms/selects inside dialog
5. Save button with loading state
6. onOpenChange resets state when closed

---

## 5. ROUTING

### 5.1 Router Setup
- **Framework**: Next.js 14.2+ with App Router
- **Refine Integration**: `@refinedev/nextjs-router/app`
- **Routing Config**: In RefineProvider, `syncWithLocation: false`
- **Dynamic Routes**: `[id]` parameters for edit pages

### 5.2 Route Organization

```
/dashboard - authenticated home
/landlord-access - list page
/landlord-access/create - create form
/landlord-access/edit/[id] - edit form

/landlord-categories - list page
/landlord-categories/create - create form
/landlord-categories/edit/[id] - edit form

/accounting - accounting dashboard
/settings/quickbooks - QB settings

/propriete/immeubles - buildings list
/propriete/apartments - apartments list
/propriete/photo - photo management

/integration/apartments-tal-dossiers - TAL dossiers
/integration/tal-recours - TAL recours
/integration/tal-audience - TAL audience
/integration/quickbooks - QB reconciliation
/integration/quickbooks/invoices - QB invoices
/integration/quickbooks/[qb_customer_id] - customer detail
/integration/quickbooks/[qb_customer_id]/[reconciliation_id] - reconciliation detail
/integration/lease-discrepancies - lease discrepancies

/collecte/actuel - current collecte
/collecte/ancien - old collecte
/collecte/actuel/[id] - collecte detail
```

### 5.3 Navigation Methods

**Client-Side**:
- `useRouter()` from next/navigation for programmatic navigation
- `<Link>` components for standard navigation
- URL parameters for filters and state

**Server-Side**:
- `redirect()` from next/navigation in server components

### 5.4 Authentication Flow

1. Unauthenticated users redirected to `/login`
2. `/(landlord)` layout checks user via `createClient()` (server-side)
3. Layout also checks `detectUserPortals()` for role-based access
4. SessionProvider maintains client-side auth state
5. RefineProvider's authProvider handles Refine-specific auth

---

## 6. DEPENDENCIES & VERSIONS

### Refine Packages:
```json
"@refinedev/core": "^5.0.4",
"@refinedev/nextjs-router": "^7.0.1",
"@refinedev/react-hook-form": "^5.0.1",
"@refinedev/react-table": "^6.0.0",
"@refinedev/supabase": "^6.0.0",
```

### Shadcn Components:
```json
"@radix-ui/react-avatar": "^1.1.10",
"@radix-ui/react-checkbox": "^1.3.3",
"@radix-ui/react-dialog": "^1.1.15",
"@radix-ui/react-dropdown-menu": "^2.1.16",
"@radix-ui/react-label": "^2.1.7",
"@radix-ui/react-popover": "^1.1.15",
"@radix-ui/react-select": "^2.2.6",
"@radix-ui/react-slot": "^1.2.3",
"@radix-ui/react-toast": "^1.2.15",
```

### Form & Validation:
```json
"@hookform/resolvers": "^5.2.2",
"react-hook-form": "^7.63.0",
"zod": "^4.1.11",
```

### Data & Utils:
```json
"@supabase/auth-helpers-nextjs": "^0.10.0",
"@supabase/supabase-js": "^2.39.3",
"@tanstack/react-table": "^8.21.3",
"axios": "^1.12.2",
"react-hot-toast": "^2.6.0",
"recharts": "^3.2.1", (charting)
"lucide-react": "^0.540.0", (icons)
"date-fns": "^4.1.0", (date utilities)
```

---

## 7. KEY PATTERNS & CONVENTIONS

### 7.1 File Naming
- Page files: `page.tsx` (Next.js convention)
- Layout files: `layout.tsx`
- Components: PascalCase (e.g., `DashboardShell.tsx`)
- Utilities: camelCase (e.g., `formatDateOnly()`)

### 7.2 Component Organization
- All client components marked with `"use client"`
- Server components are default (async)
- Provider components are client components
- Page components are often client components

### 7.3 State Management
- Local component state with `useState()`
- Context API for session/auth
- Refine hooks for data fetching (`useList`, `useCreate`, etc.)
- No Redux or Zustand (simple state management)

### 7.4 Form Handling
- React Hook Form for all forms
- Zod for schema validation
- Refine's `useForm()` for integration
- Always has loading state on submit button

### 7.5 Data Fetching Patterns
- Direct Supabase client calls for complex queries
- Refine hooks for standard CRUD
- Pagination with useState
- Filtering with URL params or local state
- Error handling with console.error

### 7.6 Styling Conventions
- Tailwind CSS utility classes
- shadcn/ui component base classes
- `cn()` utility for conditional classes
- Responsive design with `sm:`, `md:` breakpoints
- Color scheme using CSS variables (neutral base)

---

## 8. NOTABLE IMPLEMENTATION DETAILS

### 8.1 Schema Routing
Refine resource definitions include `schema` in meta:
- `schema: "portal_auth"` - user access tables
- `schema: "public"` - shared data
- `schema: "integration"` - integrated data (TAL, QB)
- `schema: "long_term"` - tenant/lease data

### 8.2 Empty States
All tables include empty state row:
```tsx
<TableRow>
  <TableCell colSpan={n} className="py-8 text-center text-muted-foreground">
    No records found.
  </TableCell>
</TableRow>
```

### 8.3 Loading States
- Skeleton placeholders for table rows
- Loading buttons with "Saving..." text
- isLoading/isFetching boolean checks

### 8.4 URL Query Persistence
Some pages (quickbooks) persist filters in URL:
- `?status=matched&qb_id=with_qb_id&date_preset=last_month`
- useSearchParams() and useRouter() for state management

### 8.5 Responsive Design
- Mobile nav in Sheet component (hidden on md:)
- Desktop nav always visible on md:+
- Flex layouts that stack on mobile
- Table overflow with `overflow-x-auto`

### 8.6 Icon Usage
- Lucide React icons (`lucide-react` imports)
- Used in buttons, navigation, and status indicators
- Consistent sizing (h-4 w-4, h-5 w-5)

### 8.7 Date Handling
Special utility function to avoid timezone issues:
```tsx
export function formatDateOnly(dateString: string | null | undefined): string {
  if (!dateString) return "—"
  const parts = dateString.split('T')[0].split('-')
  if (parts.length !== 3) return "—"
  const [year, month, day] = parts.map(p => parseInt(p, 10))
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('fr-CA')
}
```

---

## 9. CONFIGURATION FILES

### 9.1 Components.json (shadcn config)
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### 9.2 Next.js Config
- App Router enabled
- Image optimization from Supabase URLs
- ESLint/TypeScript errors ignored during builds
- Security headers configured
- Cache control headers set

### 9.3 TSConfig
- Strict: false (allows some type flexibility)
- Paths aliased (@/*)
- Module resolution: bundler
- JSX: preserve (Next.js handles)

---

## 10. KEY INSIGHTS FOR DUPLICATION/MERGE FEATURES

### 10.1 Existing Dialog Usage
The apartments-tal-dossiers page demonstrates:
- Row selection (setState on click)
- Dialog open state controlled by selected item
- Nested dropdowns inside dialog (building → apartment → tenant folder)
- Save functionality with loading state
- State reset on dialog close

### 10.2 Table Patterns for Comparison
QuickBooks reconciliation page shows:
- Multiple filter dropdowns with Select components
- Sortable headers with icon indicators
- Clickable rows for detail navigation
- Status badges with color coding
- Pagination with server-side filtering

### 10.3 Form Patterns for Merge
The edit pages show:
- useEffect to populate form from fetched data
- Manual field manipulation with setValue()
- Transforming data before submission (e.g., revoked_at calculation)
- Conditional logic in rendered fields

### 10.4 Potential Areas for Duplication Detection
- Use Supabase RPC functions for similarity matching
- Add match status column in table similar to QB reconciliation
- Use Dialog for manual merge confirmation
- Use checkboxes for multi-select merge operations
- Use custom Badge components for match status colors

