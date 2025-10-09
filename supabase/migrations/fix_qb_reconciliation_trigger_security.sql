-- Fix the trigger function to use SECURITY DEFINER
-- This allows it to bypass RLS and read from the apartments table
-- Resolves error code 42703 when updating approved_for_qb_import

CREATE OR REPLACE FUNCTION integration.auto_populate_qb_reconciliation_apartment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER  -- Added this to bypass RLS
AS $function$
BEGIN
    -- If apartment_id is set but apartment_name is NULL, populate from apartments table
    IF NEW.apartment_id IS NOT NULL AND NEW.apartment_name IS NULL THEN
        SELECT
            a.apartment_name,
            a.apartment_category,
            CASE a.apartment_category
                WHEN 'residential' THEN 'Rent_Residential'
                WHEN 'Residential' THEN 'Rent_Residential'
                WHEN 'Commercial' THEN 'Rent_Commercial'
                WHEN 'Parking' THEN 'Rent_Parking'
                WHEN 'Storage' THEN 'Rent_Storage_Unit'
                ELSE NULL
            END
        INTO
            NEW.apartment_name,
            NEW.apartment_category,
            NEW.service_type
        FROM public.apartments a
        WHERE a.id = NEW.apartment_id;
    END IF;

    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION integration.auto_populate_qb_reconciliation_apartment() IS
'Auto-populates apartment details when apartment_id is set. Uses SECURITY DEFINER to bypass RLS.';
