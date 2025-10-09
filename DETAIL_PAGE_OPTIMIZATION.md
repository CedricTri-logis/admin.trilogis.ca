# Detail Page Optimization Strategy

## Current Detail Page Analysis

Your `/collecte/actuel/[id]` page does 3 queries:

```typescript
// Query 1: Get ONE collecte record
const collecteData = await supabase
  .from("collecte")
  .select("*")
  .eq("id", collecteId)
  .single()

// Query 2: Get QB customer (to find customer_qb_id)
const qbCustomer = await supabase
  .from("qb_customers")
  .select("qb_id")
  .eq("id", qbCustomerId)
  .single()

// Query 3: Get invoices (already paginated!)
const invoices = await supabase
  .from("qb_invoices")
  .select("*", { count: "exact" })
  .eq("customer_qb_id", qbCustomer.qb_id)
  .order("txn_date", { ascending: false })
  .range(0, 49)  // ✅ Already using pagination!
```

---

## Performance Assessment

### ✅ What's Already Good:
1. **Fetches only ONE collecte record** (not all records)
2. **Invoices are paginated** at database level with `.range()`
3. **Queries run only on user click** (not on initial page load)

### ⚠️ What Could Be Better:
1. **Sequential queries** (3 round trips)
2. **Could combine collecte + QB customer** (2 queries → 1)

---

## Optimization Strategy

### **Option 1: Use the View for Single Record (Recommended)**

The view you already created can fetch single records too!

```typescript
// ✅ BEFORE: 2 queries
const collecteData = await supabase.from("collecte").select("*").eq("id", id).single()
const qbCustomer = await supabase.from("qb_customers").select("qb_id").eq("id", ...).single()

// ✅ AFTER: 1 query (using the view!)
const { data: collecteData } = await supabase
  .from("v_collecte_actuel")  // View includes QB customer info!
  .select("*")
  .eq("id", collecteId)
  .single()

// Now collecteData has:
// - All collecte fields
// - qb_customer_qb_id (from the JOIN)
// - qb_customer_name (from the JOIN)
// - monthly_rent (from the JOIN)
// - has_tal_dossier (from EXISTS subquery)
```

**Improvement:** 2 queries → 1 query

---

### **Option 2: Create Invoice View (If Needed)**

If you want to show more invoice details (customer name, etc.):

```sql
CREATE VIEW quickbooks.v_invoices_with_customer AS
SELECT
  qi.id,
  qi.qb_id,
  qi.doc_number,
  qi.txn_date,
  qi.due_date,
  qi.total_amt,
  qi.balance,
  qi.status,
  qi.line_items,
  qi.customer_qb_id,
  -- Include customer info
  qc.display_name as customer_name,
  qc.company_name
FROM quickbooks.qb_invoices qi
LEFT JOIN quickbooks.qb_customers qc
  ON qi.customer_qb_id = qc.qb_id;
```

Then query:
```typescript
const { data: invoices } = await supabase
  .from("v_invoices_with_customer")
  .select("*", { count: "exact" })
  .eq("customer_qb_id", customerQbId)
  .range(0, 49)
```

---

## Complete Optimized Detail Page

```typescript
export default function CollecteDetailPage() {
  const params = useParams()
  const collecteId = params.id as string

  const fetchData = async () => {
    setIsFetching(true)
    try {
      // ✅ Query 1: Get collecte with QB customer info (from view)
      const { data: collecteData, error: collecteError } = await supabase
        .from("v_collecte_actuel")  // ← Using the view!
        .select("*")
        .eq("id", collecteId)
        .single()

      if (collecteError) {
        console.error("Error:", collecteError)
        return
      }

      setCollecteInfo(collecteData)

      // QB customer info is already in collecteData.qb_customer_qb_id!
      if (!collecteData.qb_customer_qb_id) {
        console.log("No QB customer")
        setInvoices([])
        setTotal(0)
        return
      }

      // ✅ Query 2: Get invoices (already paginated - no change needed!)
      const { data: invoicesData, error: invoicesError, count } = await supabase
        .schema("quickbooks")
        .from("qb_invoices")
        .select("*", { count: "exact" })
        .eq("customer_qb_id", collecteData.qb_customer_qb_id)  // ← Use from view
        .order("txn_date", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (invoicesError) {
        console.error("Error:", invoicesError)
        setInvoices([])
        setTotal(0)
      } else {
        setInvoices(invoicesData || [])
        setTotal(count || 0)
      }
    } catch (err) {
      console.error("Error:", err)
      setInvoices([])
      setTotal(0)
    } finally {
      setIsLoading(false)
      setIsFetching(false)
    }
  }

  // ... rest of component
}
```

---

## Performance Comparison

### Before (Current):
```
User clicks row
  ↓
Query 1: collecte (50ms)
  ↓
Query 2: qb_customer (50ms)
  ↓
Query 3: qb_invoices (100ms)
  ↓
Total: ~200ms
```

### After (With View):
```
User clicks row
  ↓
Query 1: v_collecte_actuel (50ms) ← includes QB customer
  ↓
Query 2: qb_invoices (100ms)
  ↓
Total: ~150ms (25% faster)
```

**Not as dramatic as list page, but still better!**

---

## Why Detail Pages Are Less Critical

### List Pages (Main Priority):
- ❌ Load on every page visit
- ❌ Fetch 100s-1000s of records
- ❌ Multiple JOINs across tables
- ⏱️ 2-5 seconds → needs optimization

### Detail Pages (Lower Priority):
- ✅ Load only when user clicks
- ✅ Fetch 1 main record + related data
- ✅ Invoices already paginated
- ⏱️ 200ms → acceptable, but can improve

---

## Recommended Approach

### **Step 1: Optimize List Pages First** 🔥
Apply views to these (biggest impact):
- ✅ `/collecte/actuel` (main page)
- ✅ `/collecte/ancien` (historical)
- ✅ `/integration/tal-audience`
- ✅ `/integration/apartments-tal-dossiers`

**Impact:** 2-5s → 300-500ms (80-90% faster)

### **Step 2: Optimize Detail Pages Second** 💎
Use the same views for single record lookups:
- ✅ `/collecte/actuel/[id]`
- ✅ `/integration/quickbooks/[id]`

**Impact:** 200ms → 150ms (25% faster)

---

## When NOT to Use Views

### ❌ Don't create views for:
1. **Already fast queries** (single record by primary key)
2. **Frequently changing schemas** (views need to be updated)
3. **Simple queries** (no JOINs, just SELECT * FROM table)

### ✅ DO create views for:
1. **Complex JOINs** (multiple tables)
2. **Repeated patterns** (same query used in multiple places)
3. **Aggregations** (COUNT, SUM, etc.)
4. **Slow queries** (taking > 500ms)

---

## Detail Page Patterns

### Pattern 1: Master-Detail (Your Case)
```typescript
// Master record (use view)
const master = await supabase
  .from("v_collecte_actuel")
  .select("*")
  .eq("id", id)
  .single()

// Detail records (use base table with pagination)
const details = await supabase
  .from("qb_invoices")
  .select("*", { count: "exact" })
  .eq("customer_qb_id", master.qb_customer_qb_id)
  .range(0, 49)
```

**Why this works:**
- Master: ONE record, can include JOINs (view is perfect)
- Details: Many records, already paginated (base table is fine)

### Pattern 2: Nested Details
```typescript
// Master
const lease = await supabase
  .from("v_collecte_actuel")
  .select("*")
  .eq("id", id)
  .single()

// Detail Level 1: Invoices (paginated)
const invoices = await supabase
  .from("qb_invoices")
  .select("*")
  .eq("customer_qb_id", lease.qb_customer_qb_id)
  .range(0, 49)

// Detail Level 2: Invoice Line Items (small, no pagination needed)
const lineItems = await supabase
  .from("qb_invoice_line_items")
  .select("*")
  .eq("invoice_id", selectedInvoice.id)
```

**Strategy:**
- Level 0 (master): Use view
- Level 1 (many): Paginate
- Level 2 (few): Direct query

---

## Advanced: Prefetching

If detail pages are still slow, prefetch data:

```typescript
// On list page, prefetch when hovering
const handleRowHover = (id: string) => {
  queryClient.prefetchQuery({
    queryKey: ["collecte-detail", id],
    queryFn: () => fetchCollecteDetail(id)
  })
}

<TableRow
  onMouseEnter={() => handleRowHover(row.id)}
  onClick={() => router.push(`/collecte/actuel/${row.id}`)}
>
  ...
</TableRow>

// When user clicks, data is already loaded!
```

**Result:** Detail page loads instantly from cache

---

## Summary

### For Detail Pages:

| Optimization | Impact | Priority | Effort |
|--------------|--------|----------|--------|
| Use view for master record | 25% faster | Medium | Low (reuse existing view) |
| Keep invoices paginated | Already good | N/A | N/A |
| Add invoice view | 10% faster | Low | Medium |
| Prefetching | Feels instant | High (UX) | Medium |
| React Query cache | Return visits instant | High (UX) | Low |

### Your Action Plan:

1. ✅ **Apply view migration** (creates v_collecte_actuel)
2. ✅ **Update list page** to use view (biggest impact)
3. ✅ **Update detail page** to use view for master record
4. ⏭️ **Optional:** Add prefetching for better UX
5. ⏭️ **Optional:** Create invoice view if needed

**Main takeaway:** Views help detail pages too, but **list pages are the priority** because they affect all users on every visit!

---

## Code Example: Updated Detail Page

```typescript
const fetchData = async () => {
  setIsFetching(true)
  try {
    // ✅ Get collecte + QB customer in ONE query
    const { data: collecteData, error: collecteError } = await supabase
      .from("v_collecte_actuel")  // View has QB customer info!
      .select("*")
      .eq("id", collecteId)
      .single()

    if (collecteError) throw collecteError

    setCollecteInfo(collecteData)

    // No second query needed - QB customer ID is in the view!
    if (!collecteData.qb_customer_qb_id) {
      setInvoices([])
      setTotal(0)
      return
    }

    // ✅ Get invoices (no change - already optimized)
    const { data: invoicesData, count } = await supabase
      .schema("quickbooks")
      .from("qb_invoices")
      .select("*", { count: "exact" })
      .eq("customer_qb_id", collecteData.qb_customer_qb_id)
      .order("txn_date", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    setInvoices(invoicesData || [])
    setTotal(count || 0)
  } catch (err) {
    console.error("Error:", err)
    setInvoices([])
    setTotal(0)
  } finally {
    setIsLoading(false)
    setIsFetching(false)
  }
}
```

**Changes:**
- Query 1: Use `v_collecte_actuel` instead of `collecte`
- Query 2: Removed (QB customer info is in view)
- Query 3: No change (already optimized)

**Result:** 3 queries → 2 queries, ~25% faster
