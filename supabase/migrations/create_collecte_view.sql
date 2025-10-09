-- Migration: Create optimized view for collecte actuel page
-- This pre-joins all the data needed, eliminating multiple round trips

CREATE OR REPLACE VIEW integration.v_collecte_actuel AS
WITH ranked_collecte AS (
  -- Get the most recent lease per apartment_folder
  SELECT
    c.*,
    ROW_NUMBER() OVER (
      PARTITION BY c.apartment_folder
      ORDER BY c.lease_start_date DESC
    ) as rn
  FROM integration.collecte c
  WHERE c.apartment_folder IS NOT NULL
    AND c.lease_start_date IS NOT NULL
),
latest_rent AS (
  -- Get most recent monthly rent from leases and renewals
  SELECT DISTINCT ON (tenant_folder_id)
    tenant_folder_id,
    monthly_rent,
    lease_start_date as rent_date
  FROM (
    SELECT
      tenant_folder_id,
      monthly_rent,
      lease_start_date
    FROM long_term.leases
    UNION ALL
    SELECT
      tenant_folder_id,
      monthly_rent,
      renewal_start_date as lease_start_date
    FROM long_term.renewals
  ) combined
  ORDER BY tenant_folder_id, lease_start_date DESC
)
SELECT
  rc.id,
  rc.tenant_folder_id,
  rc.apartment_folder,
  rc.tenant_names,
  rc.qb_balance,
  rc.lease_start_date,
  rc.status,
  rc.qb_customer_id,
  rc.manual_qb_customer_id,
  lr.monthly_rent,
  -- Check if has TAL dossier
  EXISTS (
    SELECT 1
    FROM integration.apartments_tal_dossiers atd
    WHERE atd.tenant_folder_id = rc.tenant_folder_id
  ) as has_tal_dossier,
  -- Include QB customer info
  qbc.qb_id as qb_customer_qb_id,
  qbc.display_name as qb_customer_name
FROM ranked_collecte rc
LEFT JOIN latest_rent lr ON lr.tenant_folder_id = rc.tenant_folder_id
LEFT JOIN quickbooks.qb_customers qbc
  ON qbc.id = COALESCE(rc.manual_qb_customer_id, rc.qb_customer_id)
WHERE rc.rn = 1;  -- Only most recent per apartment

-- Add index for common query patterns
CREATE INDEX IF NOT EXISTS idx_v_collecte_actuel_apartment_folder
  ON integration.collecte(apartment_folder, lease_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_v_collecte_actuel_qb_balance
  ON integration.collecte(qb_balance)
  WHERE qb_balance IS NOT NULL;

-- Grant access
GRANT SELECT ON integration.v_collecte_actuel TO authenticated;
