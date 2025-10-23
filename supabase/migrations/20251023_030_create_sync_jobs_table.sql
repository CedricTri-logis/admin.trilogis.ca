-- Create sync jobs table for tracking CDC sync operations
CREATE TABLE quickbooks.qb_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  verify boolean DEFAULT false,
  started_at timestamptz,
  completed_at timestamptz,
  stats jsonb,
  error_message text,
  created_at timestamptz DEFAULT NOW()
);

-- Create index for quick status lookups
CREATE INDEX idx_sync_jobs_status ON quickbooks.qb_sync_jobs(status, created_at DESC);
CREATE INDEX idx_sync_jobs_realm ON quickbooks.qb_sync_jobs(realm_id, created_at DESC);

COMMENT ON TABLE quickbooks.qb_sync_jobs IS 'Tracks QuickBooks CDC sync job executions';
COMMENT ON COLUMN quickbooks.qb_sync_jobs.verify IS 'Whether to run verification mode (compare QB counts vs DB counts)';
COMMENT ON COLUMN quickbooks.qb_sync_jobs.stats IS 'JSON containing sync statistics: {created, updated, deleted, errors}';
