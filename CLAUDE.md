# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tri-Logis Landlord Portal - Admin portal for property management with landlord-only access. Built with Next.js 14 (App Router), Supabase, and integrates with QuickBooks for accounting operations.

## Development Commands

### Basic Development
```bash
npm install              # Install dependencies
npm run dev             # Start development server (localhost:3000)
npm run build           # Production build
npm start               # Start production server
npm run lint            # Run ESLint
```

### Testing
No test suite is currently configured (Playwright is installed but not set up).

## Architecture & Key Concepts

### Authentication & Authorization Flow

The authentication system uses a **dual-client pattern**:

1. **Browser Client** (`@/lib/supabase/client.ts`) - For client components
2. **Server Client** (`@/lib/supabase/server.ts`) - For server components with cookie-based sessions
3. **Service Role Client** (`@/lib/supabase/service-role-client.ts`) - For privileged operations that bypass RLS

**Authorization happens at the layout level** (`src/app/(landlord)/layout.tsx`):
- All routes under `(landlord)` route group require authentication
- `detectUserPortals()` checks if user has `landlord_access` in `portal_auth.landlord_access` table
- Users without landlord access see an "Access Denied" screen
- Landlord categories determine feature access (wildcard `*` grants all)

### Database Schema Organization

Multiple Supabase schemas are used:
- `portal_auth.*` - Authentication and access control tables
  - `landlord_access` - Grants landlord portal access
  - `landlord_categories` - Defines category-based permissions
  - `profiles` - User profile information
- `quickbooks.*` - QuickBooks integration tables
  - `qb_auth_tokens` - OAuth tokens with automatic refresh
  - `qb_invoices` - Synced invoice data
  - `qb_customers` - Customer mappings
- `integration.*` - External system integrations (TAL, lease data)
- `public.*` - Core property data (buildings, apartments)

### Refine Framework Integration

The app uses **Refine** (v5) for CRUD operations and data management:
- `RefineProvider.tsx` configures resources, auth, and Supabase integration
- Resources defined in provider map to database tables via schema metadata
- Data provider automatically handles Supabase queries
- Auth bindings integrate Supabase Auth with Refine's auth system

**Key resources:**
- `landlord-access`, `landlord-categories` → `portal_auth` schema
- `apartments_tal_dossiers`, `tal_recours` → `integration` schema
- `buildings`, `apartments` → `public` schema

### QuickBooks Integration Architecture

QuickBooks integration (`src/lib/quickbooks/qb-service.ts`) handles:
- **OAuth 2.0 flow** with automatic token refresh
- **Retry logic** with exponential backoff for failed requests
- **Invoice CRUD operations** with proper sync token management
- Stores all data in `quickbooks.*` schema for offline access

**Important patterns:**
- Always fetch auth token via `getAuthToken(realmId)`
- Use `makeQBRequest()` for API calls (handles 401 refresh automatically)
- Save all QuickBooks responses to database via `saveInvoiceToDatabase()`
- Invoice updates require `SyncToken` from most recent data

### Route Organization

```
src/app/
├── (landlord)/          # Protected routes with auth guard (layout.tsx)
│   ├── dashboard/       # Main dashboard
│   ├── landlord-access/ # Manage user access (Refine CRUD)
│   ├── landlord-categories/ # Manage categories (Refine CRUD)
│   ├── accounting/      # Financial overview
│   ├── collecte/        # Rent collection workflows
│   ├── integration/     # External integrations
│   │   ├── quickbooks/  # QB invoice management
│   │   ├── lease-discrepancies/ # Lease validation
│   │   ├── tal-recours/ # TAL (Tribunal) cases
│   │   └── tal-audience/
│   ├── propriete/       # Property management
│   │   ├── immeubles/   # Buildings
│   │   ├── apartments/  # Units
│   │   └── photo/       # Photo management
│   └── settings/        # App settings
├── api/                 # API routes
│   ├── accounting/      # Financial aggregations
│   ├── quickbooks/      # QB API proxy endpoints
│   ├── lease-discrepancies/ # Document handling
│   └── auth/callback    # OAuth callbacks
└── login/               # Public login page
```

### Supabase Client Usage Rules

**Server Components:**
```typescript
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
```

**Client Components:**
```typescript
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
const supabase = createSupabaseBrowserClient()
```

**System Operations (bypasses RLS):**
```typescript
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
const supabase = createSupabaseServiceRoleClient()
```

**Never** expose service role key to client-side code.

### UI Component Library

Uses **shadcn/ui** components built on Radix UI primitives. All components in `src/components/ui/` are auto-generated via shadcn CLI and should not be manually edited.

To add new components:
```bash
npx shadcn@latest add [component-name]
```

## Common Patterns

### Checking Landlord Category Access

```typescript
import { hasLandlordCategory } from '@/lib/services/portal-service'

const hasAccess = await hasLandlordCategory(userId, 'accounting')
if (!hasAccess) {
  // Show access denied or hide feature
}
```

### Creating QuickBooks Invoices

```typescript
import { getAuthToken, createInvoice, saveInvoiceToDatabase, buildInvoicePayload } from '@/lib/quickbooks/qb-service'

const token = await getAuthToken(realmId)
if (!token) throw new Error('QuickBooks not connected')

const payload = buildInvoicePayload(importData)
const qbInvoice = await createInvoice(realmId, payload, token)
await saveInvoiceToDatabase(qbInvoice, realmId, customerName)
```

### API Route Error Handling

All API routes should return consistent error responses:
```typescript
return NextResponse.json(
  { error: 'Error message' },
  { status: 400 }
)
```

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=           # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Anon key (client-safe)
SUPABASE_SERVICE_ROLE_KEY=          # Service role key (server-only)
QUICKBOOKS_CLIENT_ID=               # QuickBooks OAuth client ID
QUICKBOOKS_CLIENT_SECRET=           # QuickBooks OAuth secret
QUICKBOOKS_ENVIRONMENT=             # 'sandbox' or 'production'
```

## Important Implementation Notes

### Next.js Configuration
- `typescript.ignoreBuildErrors: true` and `eslint.ignoreDuringBuilds: true` are enabled
- Production builds strip console logs
- Aggressive caching disabled for all routes (private portal)
- Security headers configured (XSS protection, frame options, etc.)

### Authentication Middleware
No middleware.ts exists - authentication happens at route layout level. All routes under `(landlord)` group share the same layout that checks auth and landlord access.

### Service Role Usage
Service role client is used in:
- `portal-service.ts` for checking landlord access (system-level auth check)
- `qb-service.ts` for storing QuickBooks data
- API routes that need to bypass RLS for administrative operations

### QuickBooks Sync Strategy
- OAuth tokens stored in `quickbooks.qb_auth_tokens` with `is_active` flag
- Tokens automatically refresh when expired (401 detected)
- All QB invoices cached in database for offline access and faster queries
- Use `SyncToken` pattern for updates to prevent race conditions

## File References

Key files to understand the system:
- Authentication: `src/lib/services/portal-service.ts:15`
- Layout guard: `src/app/(landlord)/layout.tsx:14`
- Refine config: `src/components/providers/RefineProvider.tsx:14`
- QB service: `src/lib/quickbooks/qb-service.ts:1`
- Supabase clients: `src/lib/supabase/`
