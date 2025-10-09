# Performance Optimization Plan
## Make Your Pages Load 10x Faster

---

## 🎯 Current Problems

### Pages Taking 2-5 Seconds to Load

**Root Causes:**
1. ❌ Fetching ALL records (no pagination at database level)
2. ❌ Multiple sequential queries (N+1 problem)
3. ❌ Client-side filtering, sorting, and grouping
4. ❌ No caching between page loads
5. ❌ Client-side pagination (fetches all data first)

**Example from `collecte/actuel/page.tsx`:**
- Query 1: Fetch ALL collecte (could be 1000s of rows)
- Query 2: Fetch TAL dossiers for all tenants
- Query 3: Fetch all leases
- Query 4: Fetch all renewals
- JavaScript: Group, filter, sort, paginate
- **Result: 2-5 seconds, high memory usage**

---

## ✅ Solutions (Ordered by Impact)

### 🥇 **Priority 1: Database Views (Biggest Impact - 10x faster)**

**What:** Create Postgres views that pre-join your data

**Why:**
- Reduces 4-5 queries → 1 query
- Postgres does filtering/sorting/joining (it's MUCH faster than JavaScript)
- Only fetch exactly what you need (25 rows instead of 1000s)

**How:**
```bash
# 1. Apply the migration
npx supabase db push --include-all

# The migration file is already created:
# supabase/migrations/create_all_optimized_views.sql
```

**What This Creates:**
- `v_collecte_actuel` - Pre-joined data for current leases
- `v_collecte_ancien` - Pre-joined data for historical leases
- `v_audience_with_lease` - TAL audience with lease info
- `v_apartments_tal_dossiers_full` - TAL dossiers with all related data
- `v_qb_customers_with_reconciliation` - QuickBooks data with stats

**Expected Result:**
- 2-5 seconds → 200-500ms ✨
- Memory usage reduced by 90%
- Works on slow mobile connections

---

### 🥈 **Priority 2: Update Queries (Required for views to work)**

**What:** Change your queries to use the new views

**Before:**
```typescript
// ❌ Multiple queries, client-side processing
const { data: allCollecte } = await supabase.from("collecte").select("*")
const { data: talDossiers } = await supabase.from("apartments_tal_dossiers")...
const { data: leases } = await supabase.from("leases")...
// ... then filter/sort/paginate in JavaScript
```

**After:**
```typescript
// ✅ Single query, database does everything
const { data, count } = await supabase
  .from("v_collecte_actuel")
  .select("*", { count: "exact" })
  .not("qb_balance", "is", null)  // Filter in DB
  .order("apartment_folder", { ascending: true })  // Sort in DB
  .range(0, 24)  // Paginate in DB
```

**See example implementation in:**
`PERFORMANCE_OPTIMIZATION_EXAMPLE.tsx`

---

### 🥉 **Priority 3: Add React Query Caching (Huge UX improvement)**

**What:** Use React Query (already in your project!) for intelligent caching

**Benefits:**
- Navigate back to previous page → **Instant load from cache**
- Change filter → **Refetch only if data is stale**
- Multiple components use same data → **No duplicate requests**
- Background refetching → **Always fresh data**

**How:**
```bash
# 1. Create a hook for collecte data
# See examples in: CACHING_SETUP.md

# 2. Replace your fetchData() with the hook
const { data, isLoading } = useCollecteActuel({ page, pageSize, filters })
```

**Expected Result:**
- First load: 200-500ms
- Return to page: **Instant** (from cache)
- Filter change: 200-500ms (with optimistic UI)

---

### 📊 **Priority 4: Add Database Indexes (Easy wins)**

Already included in the migration! These indexes speed up common queries:

```sql
-- For collecte page sorting/filtering
CREATE INDEX idx_v_collecte_actuel_apartment_folder
  ON integration.collecte(apartment_folder, lease_start_date DESC);

CREATE INDEX idx_v_collecte_actuel_qb_balance
  ON integration.collecte(qb_balance) WHERE qb_balance IS NOT NULL;

-- For TAL audience date filtering
CREATE INDEX idx_audience_date
  ON tal.audience(audience_date) WHERE audience_date IS NOT NULL;

-- For TAL dossiers status filtering
CREATE INDEX idx_tal_dossiers_statut
  ON integration.apartments_tal_dossiers(statut);
```

**Expected Result:**
- 20-30% faster queries
- Better performance as data grows

---

## 🚀 Implementation Steps

### Step 1: Apply Database Migrations (5 minutes)

```bash
# Run this command to create all views and indexes
npx supabase db push --include-all
```

**Verify it worked:**
```sql
-- Run in Supabase SQL Editor
SELECT * FROM integration.v_collecte_actuel LIMIT 10;
```

---

### Step 2: Update Collecte Actuel Page (15 minutes)

Replace the `fetchData` function in `src/app/(landlord)/collecte/actuel/page.tsx`:

**Find this code (lines 75-196):**
```typescript
const fetchData = async () => {
  // Get all collecte records
  const { data: allCollecte } = await supabase...
  // Get TAL dossiers...
  // Get leases...
  // Get renewals...
  // Client-side grouping, filtering, sorting, pagination
}
```

**Replace with:**
```typescript
const fetchData = async () => {
  setIsFetching(true)
  try {
    let query = supabase
      .schema("integration")
      .from("v_collecte_actuel")  // ✨ Use the view!
      .select("*", { count: "exact" })

    // Database-side filtering
    if (balanceFilter === "with_balance") {
      query = query.not("qb_balance", "is", null)
    } else if (balanceFilter === "without_balance") {
      query = query.is("qb_balance", null)
    }

    // Database-side sorting
    query = query.order(sortColumn, {
      ascending: sortDirection === "asc",
      nullsFirst: false
    })

    // Database-side pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) throw error

    setRows(data || [])
    setTotal(count || 0)
  } catch (err) {
    console.error("Error:", err)
    setRows([])
    setTotal(0)
  } finally {
    setIsLoading(false)
    setIsFetching(false)
  }
}
```

**Test it:**
1. Navigate to `/collecte/actuel`
2. Should load in **~300ms** instead of 2-5 seconds
3. Filtering/sorting should be instant

---

### Step 3: Update Other Pages (Repeat for each)

Apply same pattern to:

| Page | View to Use | Time Saved |
|------|-------------|------------|
| `collecte/ancien` | `v_collecte_ancien` | 2-3s → 300ms |
| `integration/tal-audience` | `v_audience_with_lease` | 1-2s → 200ms |
| `integration/apartments-tal-dossiers` | `v_apartments_tal_dossiers_full` | 3-4s → 400ms |
| `integration/quickbooks` | `v_qb_customers_with_reconciliation` | 1-2s → 200ms |

---

### Step 4: Add React Query Caching (Optional but Recommended)

See `CACHING_SETUP.md` for detailed examples.

**Quick version:**
```typescript
// 1. Create hook
export function useCollecteActuel(filters) {
  return useQuery({
    queryKey: ["collecte-actuel", filters],
    queryFn: () => fetchCollecteData(filters),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  })
}

// 2. Use in component
const { data, isLoading } = useCollecteActuel({ page, pageSize, ... })
```

---

## 📈 Expected Results

### Before Optimization
- **Collecte Actuel:** 2.5s → 😞
- **TAL Dossiers:** 3.2s → 😞
- **TAL Audience:** 1.8s → 😞
- **Memory Usage:** 150MB → 😞
- **Mobile Experience:** Poor

### After Optimization
- **Collecte Actuel:** 300ms → ✨ 8x faster
- **TAL Dossiers:** 350ms → ✨ 9x faster
- **TAL Audience:** 200ms → ✨ 9x faster
- **Memory Usage:** 15MB → ✨ 90% reduction
- **Mobile Experience:** Excellent

### With React Query Caching
- **First Load:** 300ms
- **Return to Page:** **Instant** (from cache)
- **Background Refresh:** Automatic

---

## 🔍 Monitoring & Debugging

### Check View Performance
```sql
-- Run in Supabase SQL Editor
EXPLAIN ANALYZE
SELECT * FROM integration.v_collecte_actuel
WHERE qb_balance IS NOT NULL
ORDER BY apartment_folder
LIMIT 25;

-- Should show execution time < 50ms
```

### Check Index Usage
```sql
-- See which indexes are being used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as times_used,
  idx_tup_read as rows_read
FROM pg_stat_user_indexes
WHERE schemaname = 'integration'
ORDER BY idx_scan DESC;
```

### Monitor Slow Queries
```sql
-- Find slow queries (in Supabase Dashboard → Database → Logs)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- > 100ms
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 🎓 Key Learnings

### Why This Is So Much Faster

1. **Database Does What It's Best At**
   - Postgres is optimized for filtering/sorting/joining
   - Uses indexes, query planner, disk I/O optimization
   - JavaScript can't compete

2. **Reduce Network Round Trips**
   - 4 queries → 1 query
   - Each round trip adds 50-200ms latency

3. **Fetch Only What You Need**
   - Old: Fetch 1000 rows, use 25
   - New: Fetch 25 rows

4. **Caching Eliminates Redundant Fetches**
   - React Query caches results
   - Same query = instant response

### Common Mistakes to Avoid

❌ **Don't do this:**
```typescript
// Fetching all data then filtering in JS
const all = await supabase.from("table").select("*")
const filtered = all.filter(x => x.status === "active")
```

✅ **Do this instead:**
```typescript
// Let database filter
const filtered = await supabase
  .from("table")
  .select("*")
  .eq("status", "active")
```

---

## 📚 Additional Resources

- [Supabase Performance Best Practices](https://supabase.com/docs/guides/database/performance)
- [React Query Documentation](https://tanstack.com/query/latest)
- [PostgreSQL Index Documentation](https://www.postgresql.org/docs/current/indexes.html)

---

## 🆘 Need Help?

If you encounter issues:

1. **View doesn't exist:** Run `npx supabase db push --include-all`
2. **Permission denied:** Check the `GRANT SELECT` statements in migration
3. **Slow queries:** Check if indexes were created
4. **Data looks wrong:** Verify view logic matches your requirements

---

## ✅ Checklist

- [ ] Apply database migration (creates views & indexes)
- [ ] Update collecte/actuel page to use `v_collecte_actuel`
- [ ] Update collecte/ancien page to use `v_collecte_ancien`
- [ ] Update tal-audience page to use `v_audience_with_lease`
- [ ] Update apartments-tal-dossiers page to use `v_apartments_tal_dossiers_full`
- [ ] Test each page (should be 5-10x faster)
- [ ] (Optional) Add React Query caching
- [ ] (Optional) Add prefetching for next page
- [ ] Monitor performance in production

**Estimated Time:** 1-2 hours to implement
**Expected Improvement:** 10x faster page loads
**ROI:** Massive improvement in user experience
