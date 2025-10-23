-- Test Query: Daily Receivables for Last 7 Days
-- This calculates the total amount to collect for each of the last 7 days

WITH
-- Generate last 7 days
date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date AS snapshot_date
),

-- For each date, calculate receivables
daily_receivables AS (
    SELECT
        ds.snapshot_date,

        -- Total receivables: sum of invoice balances that existed at that date
        COALESCE(SUM(
            CASE
                -- Invoice existed at this snapshot date
                WHEN i.txn_date <= ds.snapshot_date
                     AND (i.is_deleted = FALSE OR i.is_deleted IS NULL)
                THEN
                    -- Use current balance, but we need to add back payments made AFTER snapshot_date
                    i.balance + COALESCE(
                        (SELECT COALESCE(SUM(
                            -- Extract payment amount from line_items JSONB
                            (jsonb_array_elements(p.line_items)->>'Amount')::numeric
                        ), 0)
                        FROM quickbooks.qb_payments p
                        WHERE p.txn_date > ds.snapshot_date
                          AND p.is_deleted = FALSE
                          AND p.customer_qb_id = i.customer_qb_id
                          -- This is simplified - ideally we'd match specific invoice in line_items
                        ),
                        0
                    )
                ELSE 0
            END
        ), 0) AS total_receivables,

        -- Count of invoices with outstanding balance
        COUNT(CASE
            WHEN i.txn_date <= ds.snapshot_date
                 AND i.balance > 0
                 AND (i.is_deleted = FALSE OR i.is_deleted IS NULL)
            THEN 1
        END) AS outstanding_invoices,

        -- Count unique customers with balances
        COUNT(DISTINCT CASE
            WHEN i.txn_date <= ds.snapshot_date
                 AND i.balance > 0
                 AND (i.is_deleted = FALSE OR i.is_deleted IS NULL)
            THEN i.customer_qb_id
        END) AS customers_with_balance,

        -- Amount overdue (past due_date)
        COALESCE(SUM(
            CASE
                WHEN i.txn_date <= ds.snapshot_date
                     AND i.due_date < ds.snapshot_date
                     AND i.balance > 0
                     AND (i.is_deleted = FALSE OR i.is_deleted IS NULL)
                THEN i.balance
                ELSE 0
            END
        ), 0) AS overdue_amount,

        -- Amount not yet due
        COALESCE(SUM(
            CASE
                WHEN i.txn_date <= ds.snapshot_date
                     AND (i.due_date >= ds.snapshot_date OR i.due_date IS NULL)
                     AND i.balance > 0
                     AND (i.is_deleted = FALSE OR i.is_deleted IS NULL)
                THEN i.balance
                ELSE 0
            END
        ), 0) AS current_amount

    FROM date_series ds
    CROSS JOIN quickbooks.qb_invoices i
    WHERE i.realm_id = (SELECT realm_id FROM quickbooks.qb_companies LIMIT 1) -- Change if you have multiple companies
    GROUP BY ds.snapshot_date
)

SELECT
    snapshot_date,
    TO_CHAR(snapshot_date, 'Day') AS day_of_week,
    total_receivables,
    outstanding_invoices,
    customers_with_balance,
    overdue_amount,
    current_amount,
    -- Calculate change from previous day
    total_receivables - LAG(total_receivables) OVER (ORDER BY snapshot_date) AS daily_change,
    -- Calculate percentage change
    CASE
        WHEN LAG(total_receivables) OVER (ORDER BY snapshot_date) > 0
        THEN ROUND(
            ((total_receivables - LAG(total_receivables) OVER (ORDER BY snapshot_date))
            / LAG(total_receivables) OVER (ORDER BY snapshot_date) * 100)::numeric,
            2
        )
        ELSE NULL
    END AS daily_change_pct
FROM daily_receivables
ORDER BY snapshot_date DESC;


-- ============================================================================
-- ALTERNATIVE SIMPLER VERSION (More Accurate for Current State)
-- This version uses current balances as-is, which is accurate for TODAY
-- but won't perfectly reconstruct historical balances
-- ============================================================================

-- Uncomment below to use simpler version:

/*
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date AS snapshot_date
)
SELECT
    ds.snapshot_date,
    TO_CHAR(ds.snapshot_date, 'Day') AS day_of_week,

    -- Sum of all outstanding invoice balances
    COALESCE(SUM(i.balance), 0) AS total_receivables,

    -- Count outstanding invoices
    COUNT(CASE WHEN i.balance > 0 THEN 1 END) AS outstanding_invoices,

    -- Unique customers
    COUNT(DISTINCT i.customer_qb_id) AS customers_with_balance,

    -- Overdue amount
    COALESCE(SUM(CASE WHEN i.due_date < ds.snapshot_date THEN i.balance ELSE 0 END), 0) AS overdue_amount,

    -- Current (not yet due)
    COALESCE(SUM(CASE WHEN i.due_date >= ds.snapshot_date THEN i.balance ELSE 0 END), 0) AS current_amount

FROM date_series ds
CROSS JOIN quickbooks.qb_invoices i
WHERE i.txn_date <= ds.snapshot_date
  AND (i.is_deleted = FALSE OR i.is_deleted IS NULL)
  AND i.balance > 0
  AND i.realm_id = (SELECT realm_id FROM quickbooks.qb_companies LIMIT 1)
GROUP BY ds.snapshot_date
ORDER BY ds.snapshot_date DESC;
*/


-- ============================================================================
-- BONUS: Summary Statistics
-- ============================================================================

/*
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '6 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date AS snapshot_date
),
daily_totals AS (
    SELECT
        ds.snapshot_date,
        COALESCE(SUM(i.balance), 0) AS total_receivables
    FROM date_series ds
    CROSS JOIN quickbooks.qb_invoices i
    WHERE i.txn_date <= ds.snapshot_date
      AND (i.is_deleted = FALSE OR i.is_deleted IS NULL)
      AND i.balance > 0
      AND i.realm_id = (SELECT realm_id FROM quickbooks.qb_companies LIMIT 1)
    GROUP BY ds.snapshot_date
)
SELECT
    MIN(total_receivables) AS min_receivables,
    MAX(total_receivables) AS max_receivables,
    AVG(total_receivables)::numeric(10,2) AS avg_receivables,
    MAX(total_receivables) - MIN(total_receivables) AS total_change,
    ROUND(((MAX(total_receivables) - MIN(total_receivables)) / NULLIF(MIN(total_receivables), 0) * 100)::numeric, 2) AS pct_change
FROM daily_totals;
*/
