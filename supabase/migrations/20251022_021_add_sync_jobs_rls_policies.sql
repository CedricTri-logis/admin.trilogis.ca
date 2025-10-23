-- Migration: Add RLS policies for QuickBooks sync tables
-- Description: Allow landlords with access to view and manage sync jobs

-- Policy: Allow landlords to view all sync jobs
CREATE POLICY "Landlords can view sync jobs"
ON quickbooks.sync_jobs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM portal_auth.landlord_access
    WHERE landlord_access.user_id = auth.uid()
      AND landlord_access.revoked_at IS NULL
  )
);

-- Policy: Allow landlords to view entity jobs
CREATE POLICY "Landlords can view entity jobs"
ON quickbooks.sync_entity_jobs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM portal_auth.landlord_access
    WHERE landlord_access.user_id = auth.uid()
      AND landlord_access.revoked_at IS NULL
  )
);

-- Policy: Allow landlords to view batch jobs
CREATE POLICY "Landlords can view batch jobs"
ON quickbooks.sync_batches
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM portal_auth.landlord_access
    WHERE landlord_access.user_id = auth.uid()
      AND landlord_access.revoked_at IS NULL
  )
);

-- Grant usage on quickbooks schema to authenticated users
GRANT USAGE ON SCHEMA quickbooks TO authenticated;

-- Grant select on sync tables to authenticated users
GRANT SELECT ON quickbooks.sync_jobs TO authenticated;
GRANT SELECT ON quickbooks.sync_entity_jobs TO authenticated;
GRANT SELECT ON quickbooks.sync_batches TO authenticated;

COMMENT ON POLICY "Landlords can view sync jobs" ON quickbooks.sync_jobs IS 'Allow authenticated landlords to view all synchronization jobs';
