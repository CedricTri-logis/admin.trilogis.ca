-- Create sync events table for SSE streaming
CREATE TABLE quickbooks.qb_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES quickbooks.qb_sync_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz DEFAULT NOW()
);

-- Create index for efficient event streaming
CREATE INDEX idx_sync_events_job_id ON quickbooks.qb_sync_events(job_id, created_at);

COMMENT ON TABLE quickbooks.qb_sync_events IS 'Real-time events for Server-Sent Events (SSE) streaming during sync operations';
COMMENT ON COLUMN quickbooks.qb_sync_events.event_type IS 'Event types: progress, verification, complete, error';
COMMENT ON COLUMN quickbooks.qb_sync_events.event_data IS 'JSON payload for the event (entity, message, count, emoji, etc.)';
