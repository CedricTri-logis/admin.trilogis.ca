-- Query to find which invoices were paid by each payment
-- Shows payment-to-invoice relationships with full invoice details

SELECT
    p.qb_id AS payment_id,
    p.txn_date AS payment_date,
    p.customer_name,
    p.total_amt AS payment_total,
    p.payment_ref_num AS payment_reference,
    (line_item->>'Amount')::numeric AS amount_applied_to_invoice,

    -- Extracted invoice ID from JSONB
    line_item->'LinkedTxn'->0->>'TxnId' AS invoice_qb_id,

    -- Invoice details (joined from qb_invoices)
    i.doc_number AS invoice_number,
    i.txn_date AS invoice_date,
    i.due_date AS invoice_due_date,
    i.total_amt AS invoice_total,
    i.balance AS invoice_remaining_balance,

    -- Payment status
    CASE
        WHEN i.balance = 0 THEN 'PAID IN FULL'
        WHEN i.balance > 0 AND i.balance < i.total_amt THEN 'PARTIAL'
        ELSE 'UNPAID'
    END AS payment_status,

    -- Days since invoice
    p.txn_date - i.txn_date AS days_to_payment,

    -- Past due?
    CASE
        WHEN p.txn_date > i.due_date THEN 'LATE'
        ELSE 'ON TIME'
    END AS payment_timeliness

FROM quickbooks.qb_payments p
CROSS JOIN LATERAL jsonb_array_elements(p.line_items) AS line_item
LEFT JOIN quickbooks.qb_invoices i ON i.qb_id = line_item->'LinkedTxn'->0->>'TxnId'

WHERE p.total_amt > 0
  AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)
  AND line_item->'LinkedTxn' IS NOT NULL
  -- Adjust date range as needed:
  AND p.txn_date >= CURRENT_DATE - INTERVAL '30 days'

ORDER BY p.txn_date DESC, p.customer_name;


-- ============================================================================
-- VARIATION: Find all payments for a specific invoice
-- ============================================================================
/*
SELECT
    i.qb_id AS invoice_id,
    i.doc_number AS invoice_number,
    i.total_amt AS invoice_total,
    i.balance AS remaining_balance,

    -- Payment details
    p.qb_id AS payment_id,
    p.txn_date AS payment_date,
    (line_item->>'Amount')::numeric AS amount_paid

FROM quickbooks.qb_invoices i
LEFT JOIN quickbooks.qb_payments p ON TRUE
LEFT JOIN LATERAL jsonb_array_elements(p.line_items) AS line_item ON
    line_item->'LinkedTxn'->0->>'TxnId' = i.qb_id

WHERE i.qb_id = '257968'  -- Replace with your invoice ID
  AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)
ORDER BY p.txn_date;
*/


-- ============================================================================
-- VARIATION: Summary by customer (total paid in period)
-- ============================================================================
/*
SELECT
    p.customer_name,
    COUNT(DISTINCT p.qb_id) AS num_payments,
    COUNT(DISTINCT line_item->'LinkedTxn'->0->>'TxnId') AS num_invoices_paid,
    SUM(p.total_amt) AS total_paid,
    SUM((line_item->>'Amount')::numeric) AS total_applied_to_invoices,
    MIN(p.txn_date) AS first_payment,
    MAX(p.txn_date) AS last_payment

FROM quickbooks.qb_payments p
CROSS JOIN LATERAL jsonb_array_elements(p.line_items) AS line_item

WHERE p.total_amt > 0
  AND (p.is_deleted = FALSE OR p.is_deleted IS NULL)
  AND line_item->'LinkedTxn' IS NOT NULL
  AND p.txn_date >= CURRENT_DATE - INTERVAL '30 days'

GROUP BY p.customer_name
ORDER BY total_paid DESC;
*/
