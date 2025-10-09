-- Fix the handle_qb_invoice_approval trigger to match the current qb_invoices_import schema
-- This resolves the "apartment_name does not exist" error when approving invoices

CREATE OR REPLACE FUNCTION integration.handle_qb_invoice_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_existing_import_id uuid;
    v_qb_customer_qb_id text;
    v_realm_id text;
BEGIN
    -- APPROVAL: false → true
    IF NEW.approved_for_qb_import = true AND (OLD.approved_for_qb_import IS NULL OR OLD.approved_for_qb_import = false) THEN

        -- Validate: must be no_qb_invoice status
        IF NEW.match_status != 'no_qb_invoice' THEN
            RAISE EXCEPTION 'Can only approve invoices with status "no_qb_invoice". Current status: %', NEW.match_status
                USING HINT = 'Only missing invoices can be approved for import.';
        END IF;

        -- Validate: must have QB customer
        IF NEW.qb_customer_id IS NULL THEN
            RAISE EXCEPTION 'Cannot approve: no QuickBooks customer linked to this tenant'
                USING HINT = 'Link a QB customer first in the collecte/tenant folder.';
        END IF;

        -- Get QB customer QB ID and realm ID
        SELECT qb_id, realm_id
        INTO v_qb_customer_qb_id, v_realm_id
        FROM quickbooks.qb_customers
        WHERE id = NEW.qb_customer_id;

        IF v_qb_customer_qb_id IS NULL THEN
            RAISE EXCEPTION 'Cannot find QuickBooks customer QB ID for customer_id: %', NEW.qb_customer_id;
        END IF;

        IF v_realm_id IS NULL THEN
            RAISE EXCEPTION 'Cannot find realm_id for QuickBooks customer: %', NEW.qb_customer_id;
        END IF;

        -- Check if already in import queue
        SELECT id INTO v_existing_import_id
        FROM integration.qb_invoices_import
        WHERE lt_invoice_id = NEW.lt_invoice_id;

        IF v_existing_import_id IS NOT NULL THEN
            RAISE NOTICE 'Invoice already in import queue: %', v_existing_import_id;
        ELSE
            -- Insert into qb_invoices_import with correct schema
            INSERT INTO integration.qb_invoices_import (
                qb_reconciliation_id,
                lt_invoice_id,
                realm_id,
                qb_customer_id,
                qb_customer_qb_id,
                customer_name,
                txn_date,
                line_items,
                total_amt,
                import_status
            ) VALUES (
                NEW.id,
                NEW.lt_invoice_id,
                v_realm_id,
                NEW.qb_customer_id,
                v_qb_customer_qb_id,
                NEW.qb_customer_name,
                NEW.invoice_month,
                jsonb_build_array(
                    jsonb_build_object(
                        'Description', COALESCE(NEW.apartment_name, 'Rent'),
                        'Amount', NEW.lt_amount::numeric,
                        'DetailType', 'SalesItemLineDetail',
                        'SalesItemLineDetail', jsonb_build_object(
                            'ItemRef', jsonb_build_object('name', COALESCE(NEW.service_type, 'Rent'))
                        )
                    )
                ),
                NEW.lt_amount::numeric,
                'pending'
            );

            RAISE NOTICE 'Added invoice % to QB import queue', NEW.lt_invoice_id;
        END IF;

        -- Update approval metadata
        NEW.approved_at := NOW();
        NEW.approved_by := auth.uid();

    -- UN-APPROVAL: true → false
    ELSIF NEW.approved_for_qb_import = false AND OLD.approved_for_qb_import = true THEN

        -- Remove from qb_invoices_import (only if not yet imported)
        DELETE FROM integration.qb_invoices_import
        WHERE lt_invoice_id = OLD.lt_invoice_id
          AND import_status IN ('pending', 'failed');

        IF FOUND THEN
            RAISE NOTICE 'Removed invoice % from QB import queue', OLD.lt_invoice_id;
        ELSE
            RAISE NOTICE 'Invoice % was already imported or not in queue', OLD.lt_invoice_id;
        END IF;

        -- Clear approval metadata
        NEW.approved_at := NULL;
        NEW.approved_by := NULL;
    END IF;

    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION integration.handle_qb_invoice_approval() IS
'Handles approval/un-approval of invoices for QB import. Updated to match current qb_invoices_import schema.';
