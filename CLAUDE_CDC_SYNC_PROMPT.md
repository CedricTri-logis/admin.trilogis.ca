# QuickBooks CDC Sync Module - Implementation Prompt

## Objective
Create a brand new, production-ready QuickBooks CDC (Change Data Capture) sync module in a Next.js 14 application. This module should replicate the functionality of the working terminal script but be accessible via a web UI.

## Project Context

### Tech Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **QuickBooks**: OAuth 2.0 with automatic token refresh
- **UI**: React with shadcn/ui components

### Current Directory Structure
```
src/
├── app/
│   ├── (landlord)/
│   │   └── integration/
│   │       └── quickbooks/
│   │           └── sync/          # Existing buggy sync (DO NOT TOUCH)
│   └── api/
│       └── quickbooks/
│           ├── sync/
│           │   ├── cdc/          # Existing buggy endpoint (DO NOT TOUCH)
│           │   └── jobs/
│           └── auth/
├── lib/
│   ├── quickbooks/
│   │   ├── qb-service.ts        # Token management & API helpers
│   │   └── sync/
│   │       └── entity-preparers.ts  # Entity data transformation
│   └── supabase/
│       ├── client.ts
│       ├── server.ts
│       └── service-role-client.ts
└── components/
    └── quickbooks/
```

## Reference Implementation

### Working Terminal Script Location
`/Users/cedriclajoie/Project/cs50/DockerFile copy/scripts/quickbooks/Import/sync-cdc-incremental.js`

This script demonstrates:
- ✅ Proper CDC API usage (single API call)
- ✅ Progress logging with emojis (📊, ✅, ❌, ⚠️, 🔍)
- ✅ Verify mode that compares QuickBooks counts vs Database counts
- ✅ Entity preparation for all types
- ✅ Proper error handling
- ✅ Token refresh logic

## Requirements

### 1. Create New Page Route
**Location**: `src/app/(landlord)/integration/quickbooks/cdc-sync/page.tsx`

Features:
- Modern UI with progress display
- Real-time sync status updates
- Enable/disable verify mode checkbox
- Entity-by-entity progress with emoji indicators
- Final summary with stats (created, updated, deleted, errors)
- Verification table (if verify enabled) showing QB vs DB counts

### 2. Create API Endpoint
**Location**: `src/app/api/quickbooks/cdc-sync/route.ts`

Features:
- POST endpoint that accepts `{ realmId: string, verify?: boolean }`
- Server-Sent Events (SSE) for real-time progress updates
- Automatic token refresh using `makeQBRequest` from qb-service
- Process all QuickBooks entities via CDC API
- Return verification results if verify flag is true

### 3. Entity Processing

#### Supported Entity Types (in this order)
```typescript
const ENTITY_TYPES = [
  // Core entities
  'CompanyInfo',
  'Customer',
  'Vendor',
  'Account',
  'Class',
  'Department',
  'Item',
  'Employee',

  // Transaction entities
  'Invoice',
  'Bill',
  'Payment',
  'BillPayment',
  'CreditMemo',
  'Deposit',
  'JournalEntry',
  'Purchase',
  'SalesReceipt',
  'TimeActivity',
  'Transfer',
  'VendorCredit'
]
```

#### Entity to Table Mapping
```typescript
const ENTITY_TABLE_MAP = {
  'CompanyInfo': 'qb_companies',
  'Customer': 'qb_customers',
  'Vendor': 'qb_vendors',
  'Account': 'qb_accounts',
  'Class': 'qb_classes',
  'Department': 'qb_departments',
  'Item': 'qb_items',
  'Employee': 'qb_employees',
  'Invoice': 'qb_invoices',
  'Bill': 'qb_bills',
  'Payment': 'qb_payments',
  'BillPayment': 'qb_bill_payments',
  'CreditMemo': 'qb_credit_memos',
  'Deposit': 'qb_deposits',
  'JournalEntry': 'qb_journal_entries',
  'Purchase': 'qb_purchases',
  'SalesReceipt': 'qb_sales_receipts',
  'TimeActivity': 'qb_time_activities',
  'Transfer': 'qb_transfers',
  'VendorCredit': 'qb_vendor_credits'
}
```

All tables are in the `quickbooks` schema and have:
- `realm_id` (text) - Company identifier
- `qb_id` (text) - QuickBooks entity ID
- `is_deleted` (boolean) - Soft delete flag
- Primary key: `(realm_id, qb_id)`

### 4. QuickBooks CDC API

#### Endpoint Format
```
GET https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}/cdc?entities={entityList}&changedSince={timestamp}
```

Production URL: `https://quickbooks.api.intuit.com`

#### Response Structure
```json
{
  "CDCResponse": [{
    "QueryResponse": [{
      "Customer": [...],
      "Invoice": [...],
      "Payment": [...]
    }]
  }]
}
```

#### Deleted Entities
Deleted entities have `status === 'Deleted'` and only contain `Id` field.

### 5. Token Management

Use existing `qb-service.ts` functions:

```typescript
import { getAuthToken, makeQBRequest } from '@/lib/quickbooks/qb-service'

// Get token
const token = await getAuthToken(realmId)

// Make API request with automatic refresh
const response = await makeQBRequest('GET', cdcUrl, token)
```

**IMPORTANT**: The `makeQBRequest` function automatically:
- Retries on 401 errors
- Refreshes tokens
- Handles rate limiting

### 6. Entity Data Preparation

**Source**: Look at the reference script's `prepareEntityData` method (lines 205-900)

Key entities to prepare:

**Customer**:
```typescript
{
  realm_id, qb_id, sync_token,
  display_name, given_name, family_name, company_name,
  primary_email_addr, primary_phone, mobile_phone,
  billing_addr, shipping_addr, notes, taxable, balance,
  parent_ref, parent_qb_id, is_job, fully_qualified_name,
  level, is_active, is_deleted,
  created_at, updated_at
}
```

**Invoice**:
```typescript
{
  realm_id, qb_id, sync_token,
  doc_number, txn_date, due_date,
  customer_ref, customer_qb_id, customer_name,
  bill_addr, ship_addr, class_ref,
  total_amt, balance, deposit,
  customer_memo, private_note,
  line_items, linked_txn, raw_data,
  is_deleted, created_at, updated_at
}
```

**Payment**:
```typescript
{
  realm_id, qb_id, sync_token,
  txn_date, customer_ref, customer_qb_id, customer_name,
  total_amt, unapplied_amt,
  payment_method_ref, payment_ref_num,
  line_items, linked_txn, raw_data,
  is_deleted, created_at, updated_at
}
```

Refer to the reference script for complete field mappings.

### 7. Progress Logging

Send SSE events with this structure:

```typescript
{
  type: 'progress',
  entity: 'Customer',
  count: 42,
  action: 'processing' | 'completed' | 'skipped',
  emoji: '📊' | '✅' | '❌' | '⚠️'
}

{
  type: 'stats',
  stats: { created: 10, updated: 5, deleted: 2, errors: 0 }
}

{
  type: 'verification',
  results: [
    { entity: 'Customer', qbCount: 100, dbCount: 100, match: true },
    { entity: 'Invoice', qbCount: 500, dbCount: 500, match: true }
  ]
}
```

### 8. Verification Mode

When `verify: true`:

1. After sync completes, query QuickBooks for each entity count:
   ```sql
   SELECT COUNT(*) FROM {EntityType}
   ```

2. Query database for each entity count:
   ```sql
   SELECT COUNT(*) FROM {table} WHERE realm_id = ? AND is_deleted = false
   ```

3. Compare and report:
   ```
   Entity          QuickBooks │  Database │  Status
   ────────────────────────────┼───────────┼──────────
   Customer              100 │       100 │ ✅ Match
   Invoice               500 │       498 │ ❌ Mismatch
   ```

### 9. Database Operations

Use Supabase service role client:

```typescript
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'

const supabase = createSupabaseServiceRoleClient()

// Upsert entity
await supabase
  .from('qb_customers')
  .upsert(data, {
    onConflict: 'realm_id,qb_id'
  })

// Delete entity
await supabase
  .from('qb_customers')
  .update({ is_deleted: true })
  .eq('realm_id', realmId)
  .eq('qb_id', entityId)
```

### 10. Track Sync Progress

Store sync metadata in `qb_cdc_sync_log`:

```sql
CREATE TABLE quickbooks.qb_cdc_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text NOT NULL,
  sync_started_at timestamptz NOT NULL,
  sync_completed_at timestamptz,
  changed_since timestamptz NOT NULL,
  last_sync_checkpoint timestamptz NOT NULL,
  entities_synced text[],
  records_created int DEFAULT 0,
  records_updated int DEFAULT 0,
  records_deleted int DEFAULT 0,
  total_changes int DEFAULT 0,
  status text NOT NULL CHECK (status IN ('in_progress', 'success', 'failed')),
  error_message text,
  sync_duration_seconds int
)
```

## What NOT to Do

❌ **DO NOT** modify or use these files:
- `src/app/(landlord)/integration/quickbooks/sync/` (buggy existing sync)
- `src/app/api/quickbooks/sync/cdc/` (buggy CDC endpoint)

❌ **DO NOT** use dynamic imports (`await import()`) - they cause function resolution issues

❌ **DO NOT** use axios directly - use `makeQBRequest` for automatic token refresh

❌ **DO NOT** sync entities without preparers - check if preparer exists first

## Implementation Checklist

- [ ] Create new page at `src/app/(landlord)/integration/quickbooks/cdc-sync/page.tsx`
- [ ] Create SSE API endpoint at `src/app/api/quickbooks/cdc-sync/route.ts`
- [ ] Implement entity preparation for all types (copy from reference script)
- [ ] Add real-time progress updates via SSE
- [ ] Implement verification mode with QB vs DB comparison
- [ ] Add error handling with retry logic
- [ ] Create UI with:
  - [ ] Company selector
  - [ ] Verify checkbox
  - [ ] Start sync button
  - [ ] Progress display with emojis
  - [ ] Stats summary
  - [ ] Verification results table
- [ ] Test with sandbox QuickBooks data
- [ ] Handle token expiration gracefully
- [ ] Log sync to `qb_cdc_sync_log`

## Success Criteria

✅ Sync completes in < 30 seconds for 2000 entities
✅ Progress updates in real-time with entity counts
✅ Verify mode shows accurate QB vs DB comparisons
✅ Automatic token refresh works seamlessly
✅ No errors for entities with preparers
✅ Gracefully skips entities without preparers
✅ UI shows clear status with emoji indicators
✅ All synced data matches QuickBooks exactly

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_ENVIRONMENT=sandbox  # or 'production'
```

## Testing Command

After implementation, test with:
```bash
curl -X POST http://localhost:3000/api/quickbooks/cdc-sync \
  -H 'Content-Type: application/json' \
  -d '{"realmId": "9130348651845276", "verify": true}'
```

---

**Note**: This module should be completely independent and self-contained. Start fresh with clean code based on the working terminal script reference.
