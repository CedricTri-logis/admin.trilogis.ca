-- Create a function that aggregates customer data with optional match_status filter
-- This moves aggregation from JavaScript to PostgreSQL for much better performance

-- Drop the old function signatures first to avoid conflicts
DROP FUNCTION IF EXISTS integration.get_qb_customers_grouped(text, integer, integer, text, text);
DROP FUNCTION IF EXISTS integration.get_qb_customers_grouped(text, text, integer, integer, text, text);
DROP FUNCTION IF EXISTS integration.get_qb_customers_grouped(text, text, date, date, integer, integer, text, text);
DROP FUNCTION IF EXISTS integration.get_qb_customers_count(text);
DROP FUNCTION IF EXISTS integration.get_qb_customers_count(text, text);
DROP FUNCTION IF EXISTS integration.get_qb_customers_count(text, text, date, date);

CREATE OR REPLACE FUNCTION integration.get_qb_customers_grouped(
    p_match_status text DEFAULT NULL,
    p_qb_id_filter text DEFAULT NULL,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_exclude_trilogis boolean DEFAULT FALSE,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0,
    p_sort_column text DEFAULT 'qb_customer_name',
    p_sort_direction text DEFAULT 'asc'
)
RETURNS TABLE (
    qb_customer_id uuid,
    qb_customer_name text,
    qb_customer_qb_id text,
    total_invoices bigint,
    total_amount numeric,
    match_statuses text[],
    apartment_names text[],
    lease_start_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_reconciliation AS (
        SELECT
            qbr.qb_customer_id,
            qbr.qb_customer_name,
            qbr.qb_customer_qb_id,
            qbr.lt_amount,
            qbr.match_status,
            qbr.apartment_name,
            qbr.tenant_folder_id
        FROM integration.qb_reconciliation qbr
        WHERE qbr.qb_customer_id IS NOT NULL
          AND (p_match_status IS NULL OR p_match_status = 'all' OR qbr.match_status = p_match_status)
          AND (p_start_date IS NULL OR qbr.invoice_month >= p_start_date)
          AND (p_end_date IS NULL OR qbr.invoice_month <= p_end_date)
          AND (NOT p_exclude_trilogis OR qbr.qb_customer_name != 'Tri-Logis Inc.')
    ),
    aggregated AS (
        SELECT
            fr.qb_customer_id,
            fr.qb_customer_name,
            fr.qb_customer_qb_id,
            COUNT(*) as total_invoices,
            SUM(fr.lt_amount::numeric) as total_amount,
            ARRAY_AGG(DISTINCT fr.match_status) as match_statuses,
            ARRAY_AGG(DISTINCT fr.apartment_name) FILTER (WHERE fr.apartment_name IS NOT NULL) as apartment_names,
            MIN(tf.lease_start_date) as lease_start_date
        FROM filtered_reconciliation fr
        LEFT JOIN long_term.tenants_folder tf ON fr.tenant_folder_id = tf.id
        GROUP BY fr.qb_customer_id, fr.qb_customer_name, fr.qb_customer_qb_id
        HAVING (p_qb_id_filter IS NULL OR p_qb_id_filter = 'all')
            OR (p_qb_id_filter = 'with_qb_id' AND MAX(fr.qb_customer_qb_id) IS NOT NULL)
            OR (p_qb_id_filter = 'without_qb_id' AND MAX(fr.qb_customer_qb_id) IS NULL)
    )
    SELECT
        a.qb_customer_id,
        a.qb_customer_name,
        a.qb_customer_qb_id,
        a.total_invoices,
        a.total_amount,
        a.match_statuses,
        a.apartment_names,
        a.lease_start_date
    FROM aggregated a
    ORDER BY
        CASE WHEN p_sort_column = 'qb_customer_name' AND p_sort_direction = 'asc' THEN a.qb_customer_name END ASC,
        CASE WHEN p_sort_column = 'qb_customer_name' AND p_sort_direction = 'desc' THEN a.qb_customer_name END DESC,
        CASE WHEN p_sort_column = 'qb_customer_id' AND p_sort_direction = 'asc' THEN a.qb_customer_id::text END ASC,
        CASE WHEN p_sort_column = 'qb_customer_id' AND p_sort_direction = 'desc' THEN a.qb_customer_id::text END DESC,
        CASE WHEN p_sort_column = 'qb_customer_qb_id' AND p_sort_direction = 'asc' THEN a.qb_customer_qb_id END ASC,
        CASE WHEN p_sort_column = 'qb_customer_qb_id' AND p_sort_direction = 'desc' THEN a.qb_customer_qb_id END DESC,
        CASE WHEN p_sort_column = 'total_invoices' AND p_sort_direction = 'asc' THEN a.total_invoices END ASC,
        CASE WHEN p_sort_column = 'total_invoices' AND p_sort_direction = 'desc' THEN a.total_invoices END DESC,
        CASE WHEN p_sort_column = 'total_amount' AND p_sort_direction = 'asc' THEN a.total_amount END ASC,
        CASE WHEN p_sort_column = 'total_amount' AND p_sort_direction = 'desc' THEN a.total_amount END DESC,
        CASE WHEN p_sort_column = 'lease_start_date' AND p_sort_direction = 'asc' THEN a.lease_start_date END ASC,
        CASE WHEN p_sort_column = 'lease_start_date' AND p_sort_direction = 'desc' THEN a.lease_start_date END DESC,
        a.qb_customer_name ASC  -- Default fallback sort
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Also create a count function for pagination
CREATE OR REPLACE FUNCTION integration.get_qb_customers_count(
    p_match_status text DEFAULT NULL,
    p_qb_id_filter text DEFAULT NULL,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_exclude_trilogis boolean DEFAULT FALSE
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count bigint;
BEGIN
    WITH customer_groups AS (
        SELECT
            qbr.qb_customer_id,
            MAX(qbr.qb_customer_qb_id) as qb_id
        FROM integration.qb_reconciliation qbr
        WHERE qbr.qb_customer_id IS NOT NULL
          AND (p_match_status IS NULL OR p_match_status = 'all' OR qbr.match_status = p_match_status)
          AND (p_start_date IS NULL OR qbr.invoice_month >= p_start_date)
          AND (p_end_date IS NULL OR qbr.invoice_month <= p_end_date)
          AND (NOT p_exclude_trilogis OR qbr.qb_customer_name != 'Tri-Logis Inc.')
        GROUP BY qbr.qb_customer_id
        HAVING (p_qb_id_filter IS NULL OR p_qb_id_filter = 'all')
            OR (p_qb_id_filter = 'with_qb_id' AND MAX(qbr.qb_customer_qb_id) IS NOT NULL)
            OR (p_qb_id_filter = 'without_qb_id' AND MAX(qbr.qb_customer_qb_id) IS NULL)
    )
    SELECT COUNT(*)
    INTO v_count
    FROM customer_groups;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION integration.get_qb_customers_grouped IS
'Aggregates QB reconciliation data by customer with filtering, sorting, and pagination done in SQL for performance.';

COMMENT ON FUNCTION integration.get_qb_customers_count IS
'Returns the total count of unique customers for pagination, with optional match_status filter.';
