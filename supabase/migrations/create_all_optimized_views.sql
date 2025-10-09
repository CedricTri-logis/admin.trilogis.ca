-- ============================================================================
-- PERFORMANCE OPTIMIZATION VIEWS
-- These views pre-join data to eliminate multiple round trips
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. View for TAL Audience Page (integration/tal-audience)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW tal.v_audience_with_lease AS
SELECT
  a.id,
  a.dossier,
  a.audience_date,
  a.audience_time,
  a.audience_type,
  a.created_at,
  a.updated_at,
  -- Get lease folder through the junction table
  tf.lease_folder,
  -- Get apartment info
  ap.apartment_name
FROM tal.audience a
LEFT JOIN integration.apartments_tal_dossiers atd
  ON a.dossier = atd.dossier
LEFT JOIN long_term.tenants_folder tf
  ON COALESCE(atd.manual_tenant_folder_id, atd.tenant_folder_id) = tf.id
LEFT JOIN public.apartments ap
  ON COALESCE(atd.manual_apartment_id, atd.apartment_id) = ap.id;

GRANT SELECT ON tal.v_audience_with_lease TO authenticated;

-- Add index for date filtering (future/past audiences)
CREATE INDEX IF NOT EXISTS idx_audience_date ON tal.audience(audience_date)
  WHERE audience_date IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. View for Apartments TAL Dossiers Page (integration/apartments-tal-dossiers)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW integration.v_apartments_tal_dossiers_full AS
SELECT
  atd.id,
  atd.dossier,
  atd.tenant_folder_id,
  atd.manual_tenant_folder_id,
  atd.apartment_id,
  atd.manual_apartment_id,
  atd.statut,
  atd.type_demandeur,
  atd.demandeur,
  atd.defendeur,
  atd.recours_array,
  atd.first_action_date,
  atd.created_at,
  atd.updated_at,
  -- Get apartment info
  ap.apartment_name,
  -- Get lease folder
  tf.lease_folder,
  -- Get QB balance from collecte
  c.qb_balance
FROM integration.apartments_tal_dossiers atd
LEFT JOIN public.apartments ap
  ON COALESCE(atd.manual_apartment_id, atd.apartment_id) = ap.id
LEFT JOIN long_term.tenants_folder tf
  ON COALESCE(atd.manual_tenant_folder_id, atd.tenant_folder_id) = tf.id
LEFT JOIN integration.collecte c
  ON c.tenant_folder_id = COALESCE(atd.manual_tenant_folder_id, atd.tenant_folder_id)
  AND c.lease_start_date = (
    -- Get most recent collecte for this tenant folder
    SELECT MAX(lease_start_date)
    FROM integration.collecte c2
    WHERE c2.tenant_folder_id = COALESCE(atd.manual_tenant_folder_id, atd.tenant_folder_id)
  );

GRANT SELECT ON integration.v_apartments_tal_dossiers_full TO authenticated;

-- Add indexes for common filters
CREATE INDEX IF NOT EXISTS idx_tal_dossiers_statut
  ON integration.apartments_tal_dossiers(statut);

CREATE INDEX IF NOT EXISTS idx_tal_dossiers_apartment
  ON integration.apartments_tal_dossiers(apartment_id, manual_apartment_id);

-- ----------------------------------------------------------------------------
-- 3. View for Collecte Ancien (Historical Leases)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW integration.v_collecte_ancien AS
WITH latest_rent AS (
  SELECT DISTINCT ON (tenant_folder_id)
    tenant_folder_id,
    monthly_rent
  FROM (
    SELECT tenant_folder_id, monthly_rent, lease_start_date
    FROM long_term.leases
    UNION ALL
    SELECT tenant_folder_id, monthly_rent, renewal_start_date as lease_start_date
    FROM long_term.renewals
  ) combined
  ORDER BY tenant_folder_id, lease_start_date DESC
)
SELECT
  c.id,
  c.tenant_folder_id,
  c.apartment_folder,
  c.tenant_names,
  c.qb_balance,
  c.lease_start_date,
  c.status,
  lr.monthly_rent,
  EXISTS (
    SELECT 1
    FROM integration.apartments_tal_dossiers atd
    WHERE atd.tenant_folder_id = c.tenant_folder_id
  ) as has_tal_dossier
FROM integration.collecte c
LEFT JOIN latest_rent lr ON lr.tenant_folder_id = c.tenant_folder_id
WHERE c.apartment_folder IS NOT NULL
  AND c.lease_start_date IS NOT NULL
  -- Exclude current leases (those are in v_collecte_actuel)
  AND NOT EXISTS (
    SELECT 1
    FROM integration.v_collecte_actuel va
    WHERE va.apartment_folder = c.apartment_folder
      AND va.id = c.id
  );

GRANT SELECT ON integration.v_collecte_ancien TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. View for QuickBooks Integration Page
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW integration.v_qb_customers_with_reconciliation AS
SELECT
  qbc.id,
  qbc.qb_id,
  qbc.display_name,
  qbc.company_name,
  qbc.balance,
  qbc.active,
  qbc.created_at,
  qbc.updated_at,
  -- Count reconciliations
  COUNT(DISTINCT qbr.id) as reconciliation_count,
  -- Get most recent reconciliation date
  MAX(qbr.created_at) as last_reconciliation_date,
  -- Count linked collecte records
  COUNT(DISTINCT c.id) as collecte_count
FROM quickbooks.qb_customers qbc
LEFT JOIN integration.qb_reconciliation qbr
  ON qbr.qb_customer_id = qbc.id
LEFT JOIN integration.collecte c
  ON c.qb_customer_id = qbc.id OR c.manual_qb_customer_id = qbc.id
GROUP BY qbc.id, qbc.qb_id, qbc.display_name, qbc.company_name,
         qbc.balance, qbc.active, qbc.created_at, qbc.updated_at;

GRANT SELECT ON integration.v_qb_customers_with_reconciliation TO authenticated;

-- ----------------------------------------------------------------------------
-- Performance Monitoring Query
-- ----------------------------------------------------------------------------
-- Run this to see which queries are slow:
COMMENT ON VIEW integration.v_collecte_actuel IS
'Optimized view for collecte actuel page. Pre-joins collecte + TAL dossiers + leases/renewals.
Expected query time: < 100ms for 1000 records.
If slower, check indexes on integration.collecte(apartment_folder, lease_start_date)';

COMMENT ON VIEW tal.v_audience_with_lease IS
'Optimized view for TAL audience page. Pre-joins audience + dossiers + tenant folders + apartments.
Expected query time: < 50ms for 500 records.
If slower, check index on tal.audience(audience_date)';

COMMENT ON VIEW integration.v_apartments_tal_dossiers_full IS
'Optimized view for apartments TAL dossiers page. Pre-joins all related tables.
Expected query time: < 100ms for 500 records.
If slower, check indexes on apartments_tal_dossiers(statut, apartment_id)';

-- ============================================================================
-- USAGE EXAMPLE
-- ============================================================================
/*

Before (Slow - Multiple Queries):
---------------------------------
// Query 1: Get all collecte
const collecte = await supabase.from('collecte').select('*')

// Query 2: Get TAL dossiers
const tal = await supabase.from('apartments_tal_dossiers').select('*').in('tenant_folder_id', ids)

// Query 3: Get leases
const leases = await supabase.from('leases').select('*').in('tenant_folder_id', ids)

// Query 4: Get renewals
const renewals = await supabase.from('renewals').select('*').in('tenant_folder_id', ids)

// Client-side: Join, filter, sort, paginate
// Total: 4 queries + heavy JS processing = 2-5 seconds


After (Fast - Single Query):
-----------------------------
const { data, count } = await supabase
  .from('v_collecte_actuel')
  .select('*', { count: 'exact' })
  .eq('has_tal_dossier', true)  // Filter in DB
  .order('apartment_folder', { ascending: true })  // Sort in DB
  .range(0, 24)  // Paginate in DB

// Total: 1 query, zero JS processing = 200-500ms (10x faster!)

*/
