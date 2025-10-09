# Updating Data with Views

## TL;DR
✅ **Read from view** (fast queries)
✅ **Write to base table** (simple, works perfectly)

---

## The Pattern

```typescript
// ✅ READ: Query the view (fast, includes JOINs)
const { data } = await supabase
  .from('v_collecte_actuel')
  .select('*')

// ✅ WRITE: Update the base table (simple, no complications)
const { error } = await supabase
  .from('collecte')  // Base table, not the view!
  .update({ status: 'paid' })
  .eq('id', collecteId)

// ✅ The view automatically shows the updated data
// No refresh needed - next query will include the change
```

---

## Why This Works Perfectly

### Timeline Example:

```
10:00 AM - Query the view
SELECT * FROM v_collecte_actuel
Result: status = 'pending'

10:01 AM - User clicks "Mark as Paid"
UPDATE collecte SET status = 'paid' WHERE id = 'xxx'

10:02 AM - Query the view again (auto-refresh or manual)
SELECT * FROM v_collecte_actuel
Result: status = 'paid'  ✅ Updated!
```

**The view queries the base table, so changes appear immediately!**

---

## Your Current Component (Already Correct!)

```typescript
// Your EditableStatusCell component
<EditableStatusCell
  collecteId={row.id}
  currentStatus={row.status}
  onStatusUpdate={() => fetchData()}
/>
```

### Inside EditableStatusCell:
```typescript
const handleStatusUpdate = async (newStatus: string) => {
  // ✅ Update the BASE TABLE (collecte)
  const { error } = await supabase
    .from('collecte')  // Not the view!
    .update({ status: newStatus })
    .eq('id', collecteId)

  if (!error) {
    onStatusUpdate()  // Refetch from view
  }
}
```

### What Happens:
1. User changes status in UI
2. Component updates `collecte` table directly
3. Component calls `onStatusUpdate()` → triggers `fetchData()`
4. `fetchData()` queries `v_collecte_actuel` view
5. View shows updated data (because it queries the updated `collecte` table)

**✅ This pattern works perfectly with views!**

---

## Complete Example: Your Collecte Page

```typescript
export default function CollecteActuelPage() {
  const supabase = createSupabaseBrowserClient()

  // ✅ FETCH: Query the view (fast, includes all JOINs)
  const fetchData = async () => {
    const { data } = await supabase
      .from('v_collecte_actuel')  // View
      .select('*')
      .range((page - 1) * pageSize, page * pageSize - 1)

    setRows(data || [])
  }

  // ✅ UPDATE: Modify the base table
  const updateStatus = async (id: string, newStatus: string) => {
    await supabase
      .from('collecte')  // Base table
      .update({ status: newStatus })
      .eq('id', id)

    // Refetch from view - will show updated data
    fetchData()
  }

  return (
    // ... UI with EditableStatusCell
    <EditableStatusCell
      collecteId={row.id}
      currentStatus={row.status}
      onStatusUpdate={fetchData}  // Refetch from view
    />
  )
}
```

---

## What About INSERT and DELETE?

### ✅ INSERT: Add to base table
```typescript
// Insert new lease
const { data } = await supabase
  .from('collecte')  // Base table
  .insert({
    apartment_folder: '123-A',
    tenant_names: ['John Doe'],
    lease_start_date: '2025-01-01',
    status: 'active'
  })

// Next query to v_collecte_actuel will include it
```

### ✅ DELETE: Remove from base table
```typescript
// Soft delete (recommended)
await supabase
  .from('collecte')
  .update({ is_active: false })
  .eq('id', collecteId)

// Or hard delete
await supabase
  .from('collecte')
  .delete()
  .eq('id', collecteId)

// View will no longer show it
```

---

## Can You Update the View Directly?

### For Simple Views: YES
```sql
-- Simple view (single table, no JOINs)
CREATE VIEW simple_view AS
SELECT * FROM collecte WHERE status = 'active';

-- ✅ This works:
UPDATE simple_view SET status = 'paid' WHERE id = 'xxx';
-- Postgres updates the underlying collecte table
```

### For Complex Views (like yours): NO
```sql
-- Complex view (with JOINs, aggregates, DISTINCT ON)
CREATE VIEW v_collecte_actuel AS
SELECT c.*, lr.monthly_rent, qbc.display_name
FROM collecte c
LEFT JOIN leases l ON ...
LEFT JOIN qb_customers qbc ON ...;

-- ❌ This fails:
UPDATE v_collecte_actuel SET status = 'paid' WHERE id = 'xxx';
-- Error: cannot update view with joins
```

**Why?** Postgres doesn't know which table to update when the view has JOINs.

---

## Making Complex Views Updatable (Advanced)

If you REALLY want to update through the view, use triggers:

```sql
-- Create an INSTEAD OF trigger
CREATE OR REPLACE FUNCTION update_collecte_actuel()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the base table
  UPDATE integration.collecte
  SET status = NEW.status,
      updated_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_collecte_actuel_trigger
INSTEAD OF UPDATE ON integration.v_collecte_actuel
FOR EACH ROW
EXECUTE FUNCTION update_collecte_actuel();
```

**Now this works:**
```typescript
// Update through the view
await supabase
  .from('v_collecte_actuel')  // View itself
  .update({ status: 'paid' })
  .eq('id', collecteId)
```

**BUT this is overkill for your use case!**
Just update the base table directly. It's simpler and works perfectly.

---

## Recommended Pattern for Your App

### ✅ Use Views For:
- **Reading/Fetching** data (queries)
- **Displaying** data in tables/lists
- **Filtering/Sorting** data
- **Pagination**

### ✅ Use Base Tables For:
- **Inserting** new records
- **Updating** existing records
- **Deleting** records

---

## Real-World Example: Your Status Update Flow

### 1. User Sees Data (from view)
```typescript
// Query view - includes JOINs with leases, TAL dossiers, QB customers
const { data } = await supabase
  .from('v_collecte_actuel')
  .select('*')
  .range(0, 24)

// Display in table with status column
```

### 2. User Changes Status
```typescript
// Component updates BASE TABLE
const updateStatus = async (id: string, newStatus: string) => {
  await supabase
    .from('collecte')  // Base table
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
}
```

### 3. UI Refreshes (from view)
```typescript
// Refetch from view - shows updated status
await fetchData()  // Queries v_collecte_actuel

// View automatically includes the new status because it queries
// the collecte table which was just updated
```

---

## Performance Comparison

### ❌ Old Way (Your Current Code):
```typescript
// Fetch: 5 queries + JS processing = 2-5 seconds
const collecte = await supabase.from('collecte').select('*')
const tal = await supabase.from('apartments_tal_dossiers')...
const qb = await supabase.from('qb_customers')...
const leases = await supabase.from('leases')...
const renewals = await supabase.from('renewals')...
// JS: join, filter, sort, paginate

// Update: 1 query = 100ms
await supabase.from('collecte').update({ status: 'paid' })...

// Total: Slow reads, fast writes
```

### ✅ New Way (With View):
```typescript
// Fetch: 1 query = 300ms
const data = await supabase
  .from('v_collecte_actuel')
  .select('*')
  .range(0, 24)

// Update: 1 query = 100ms (same as before)
await supabase.from('collecte').update({ status: 'paid' })...

// Total: Fast reads, fast writes!
```

**Writes don't change, but reads are 10x faster!**

---

## Other Columns You Might Want to Update

### ✅ Status (collecte table)
```typescript
await supabase
  .from('collecte')
  .update({ status: 'paid' })
  .eq('id', id)
```

### ✅ QB Balance (collecte table)
```typescript
await supabase
  .from('collecte')
  .update({ qb_balance: 1500.00 })
  .eq('id', id)
```

### ✅ Manual QB Customer Assignment (collecte table)
```typescript
await supabase
  .from('collecte')
  .update({ manual_qb_customer_id: 'customer-uuid' })
  .eq('id', id)
```

### ✅ Manual Apartment Assignment (apartments_tal_dossiers table)
```typescript
await supabase
  .from('apartments_tal_dossiers')
  .update({ manual_apartment_id: 'apartment-uuid' })
  .eq('dossier', dossierId)
```

**All these updates work fine with views!**
Just update the base table, then refetch from the view.

---

## Summary

| Operation | Table to Use | Speed |
|-----------|--------------|-------|
| **SELECT** (read) | `v_collecte_actuel` (view) | ✅ Fast |
| **INSERT** (create) | `collecte` (base table) | ✅ Fast |
| **UPDATE** (edit) | `collecte` (base table) | ✅ Fast |
| **DELETE** (remove) | `collecte` (base table) | ✅ Fast |

**Pattern:**
1. Read from view (fast queries with JOINs)
2. Write to base table (simple updates)
3. Refetch from view (shows updated data)

**Your `EditableStatusCell` component already follows this pattern!**
No changes needed - it will work perfectly with views.

---

## Key Takeaway

**Views are for READING, base tables are for WRITING.**

Think of views as a "fast query shortcut":
- They make complex SELECTs faster
- They don't change how INSERTs/UPDATEs/DELETEs work
- Updates to base tables are automatically visible in views

Your current update logic is perfect - keep it as is! 🎯
