-- Create a materialized view for QuickBooks customer summary
-- This dramatically improves the performance of the /integration/quickbooks page
-- by moving all aggregation from JavaScript to PostgreSQL

CREATE MATERIALIZED VIEW IF NOT EXISTS integration.qb_customers_summary AS
SELECT
    qbr.qb_customer_id,
    qbr.qb_customer_name,
    qbr.qb_customer_qb_id,
    COUNT(*) as total_invoices,
    SUM(qbr.lt_amount::numeric) as total_amount,
    ARRAY_AGG(DISTINCT qbr.match_status) as match_statuses,
    ARRAY_AGG(DISTINCT qbr.apartment_name) FILTER (WHERE qbr.apartment_name IS NOT NULL) as apartment_names,
    MIN(tf.lease_start_date) as lease_start_date
FROM integration.qb_reconciliation qbr
LEFT JOIN long_term.tenants_folder tf ON qbr.tenant_folder_id = tf.id
WHERE qbr.qb_customer_id IS NOT NULL
GROUP BY qbr.qb_customer_id, qbr.qb_customer_name, qbr.qb_customer_qb_id;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_qb_customers_summary_customer_name
ON integration.qb_customers_summary(qb_customer_name);

CREATE INDEX IF NOT EXISTS idx_qb_customers_summary_total_amount
ON integration.qb_customers_summary(total_amount);

CREATE INDEX IF NOT EXISTS idx_qb_customers_summary_lease_date
ON integration.qb_customers_summary(lease_start_date);

-- Create a function to refresh the materialized view
CREATE OR REPLACE FUNCTION integration.refresh_qb_customers_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW integration.qb_customers_summary;
END;
$$;

COMMENT ON MATERIALIZED VIEW integration.qb_customers_summary IS
'Pre-aggregated customer summary for QuickBooks reconciliation. Refresh periodically or after bulk updates.';

COMMENT ON FUNCTION integration.refresh_qb_customers_summary() IS
'Refreshes the qb_customers_summary materialized view. Call after bulk reconciliation updates.';

-- Initial refresh
REFRESH MATERIALIZED VIEW integration.qb_customers_summary;
