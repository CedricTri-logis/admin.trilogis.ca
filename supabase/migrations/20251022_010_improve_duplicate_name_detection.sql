-- Improve duplicate name detection to handle names without spaces
-- Examples: "Alimatou Sow" and "AlimatouSow" should be detected as duplicates

CREATE OR REPLACE FUNCTION contacts.find_duplicate_names()
RETURNS TABLE (
    identifier TEXT,
    contact_ids UUID[],
    duplicate_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = contacts, public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.full_name as identifier,
        array_agg(c.id) as contact_ids,
        COUNT(*) as duplicate_count
    FROM contacts.persons p
    JOIN contacts.contacts c ON c.id = p.id
    WHERE c.is_merged = false
      AND c.is_active = true
    GROUP BY
        -- Normalize by removing all whitespace and converting to lowercase
        LOWER(REGEXP_REPLACE(p.first_name || p.last_name, '\s+', '', 'g')),
        p.full_name
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC, p.full_name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION contacts.find_duplicate_names() TO authenticated;
GRANT EXECUTE ON FUNCTION contacts.find_duplicate_names() TO service_role;

COMMENT ON FUNCTION contacts.find_duplicate_names() IS
'Find duplicate person names by normalizing names (removing whitespace and lowercasing).
This catches duplicates like "Alimatou Sow" and "AlimatouSow".';
