-- Create mews_sync_events table in quickbooks schema
CREATE TABLE IF NOT EXISTS quickbooks.mews_sync_events (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES quickbooks.mews_sync_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient event polling
CREATE INDEX IF NOT EXISTS idx_mews_sync_events_job_id ON quickbooks.mews_sync_events(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mews_sync_events_created_at ON quickbooks.mews_sync_events(created_at);

-- Add comment
COMMENT ON TABLE quickbooks.mews_sync_events IS 'Temporary storage for Mews sync progress events (auto-deleted after streaming)';
