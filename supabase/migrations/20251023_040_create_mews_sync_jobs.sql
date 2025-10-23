-- Create mews_sync_jobs table in quickbooks schema (reusing same schema for all sync operations)
CREATE TABLE IF NOT EXISTS quickbooks.mews_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  options JSONB,
  stats JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Create index for querying jobs
CREATE INDEX IF NOT EXISTS idx_mews_sync_jobs_status ON quickbooks.mews_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mews_sync_jobs_created_at ON quickbooks.mews_sync_jobs(created_at DESC);

-- Add comment
COMMENT ON TABLE quickbooks.mews_sync_jobs IS 'Tracks Mews data import jobs';
