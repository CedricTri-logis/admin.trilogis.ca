# React Query Setup for Caching

React Query (TanStack Query) is already in your project! Use it to cache Supabase queries.

## Benefits
- ✅ Automatic caching (5 minutes default)
- ✅ Background refetching
- ✅ Optimistic updates
- ✅ Automatic retries on failure
- ✅ Prefetching for faster navigation

## Example Implementation

```typescript
// src/hooks/useCollecte.ts
import { useQuery } from "@tanstack/react-query"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type CollecteFilters = {
  page: number
  pageSize: number
  balanceFilter: "all" | "with_balance" | "without_balance"
  sortColumn: string
  sortDirection: "asc" | "desc"
}

export function useCollecteActuel(filters: CollecteFilters) {
  const supabase = createSupabaseBrowserClient()

  return useQuery({
    queryKey: ["collecte-actuel", filters],  // Cache key includes all filters
    queryFn: async () => {
      let query = supabase
        .schema("integration")
        .from("v_collecte_actuel")
        .select("*", { count: "exact" })

      // Apply filters
      if (filters.balanceFilter === "with_balance") {
        query = query.not("qb_balance", "is", null)
      } else if (filters.balanceFilter === "without_balance") {
        query = query.is("qb_balance", null)
      }

      // Apply sorting
      query = query.order(filters.sortColumn, {
        ascending: filters.sortDirection === "asc",
        nullsFirst: false
      })

      // Apply pagination
      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      return { data: data || [], count: count || 0 }
    },
    staleTime: 5 * 60 * 1000,  // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000,    // Keep in cache for 10 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  })
}
```

## Usage in Component

```typescript
export default function CollecteActuelPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [balanceFilter, setBalanceFilter] = useState("all")
  const [sortColumn, setSortColumn] = useState("apartment_folder")
  const [sortDirection, setSortDirection] = useState("asc")

  // ✅ Use the hook - automatic caching!
  const { data, isLoading, isFetching, error } = useCollecteActuel({
    page,
    pageSize,
    balanceFilter,
    sortColumn,
    sortDirection
  })

  // No need for fetchData() function anymore!
  // React Query handles everything

  if (error) return <div>Error: {error.message}</div>

  return (
    // ... your UI with data.data and data.count
  )
}
```

## Key Benefits

1. **Instant navigation**: Going back to page 1 loads instantly from cache
2. **Smart refetching**: Only refetches when data is stale
3. **No duplicate requests**: Multiple components can use same query without duplicating requests
4. **Optimistic updates**: UI updates immediately, syncs in background
5. **Prefetching**: Can prefetch next page while user views current page

## Prefetching Example

```typescript
import { useQueryClient } from "@tanstack/react-query"

export default function CollecteActuelPage() {
  const queryClient = useQueryClient()

  // Current page query
  const { data } = useCollecteActuel({ page, pageSize, ... })

  // Prefetch next page when current page loads
  useEffect(() => {
    if (page < totalPages) {
      queryClient.prefetchQuery({
        queryKey: ["collecte-actuel", { ...filters, page: page + 1 }],
        queryFn: () => fetchCollecteData({ ...filters, page: page + 1 })
      })
    }
  }, [page, queryClient])

  // Next page loads INSTANTLY when user clicks "Next"!
}
```
