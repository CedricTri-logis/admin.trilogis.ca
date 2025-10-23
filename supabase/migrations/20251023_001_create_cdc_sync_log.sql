-- Create CDC sync log table
CREATE TABLE IF NOT EXISTS quickbooks.qb_cdc_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text NOT NULL,
  sync_started_at timestamptz NOT NULL DEFAULT NOW(),
  sync_completed_at timestamptz,
  changed_since timestamptz NOT NULL,
  last_sync_checkpoint timestamptz NOT NULL,
  entities_synced text[],
  records_created int DEFAULT 0,
  records_updated int DEFAULT 0,
  records_deleted int DEFAULT 0,
  total_changes int DEFAULT 0,
  status text NOT NULL CHECK (status IN ('in_progress', 'success', 'failed')),
  error_message text,
  sync_duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Index for finding last successful sync
CREATE INDEX IF NOT EXISTS idx_qb_cdc_sync_log_realm_status
  ON quickbooks.qb_cdc_sync_log(realm_id, status, sync_completed_at DESC);

-- Disable RLS (admin-only table)
ALTER TABLE quickbooks.qb_cdc_sync_log DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE quickbooks.qb_cdc_sync_log IS 'Tracks QuickBooks CDC (Change Data Capture) sync operations for incremental syncing';
