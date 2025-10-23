-- Migration: QuickBooks Sync Job Tracking
-- Description: Create tables to track QuickBooks data synchronization jobs and their progress

-- Table for tracking overall sync jobs
CREATE TABLE IF NOT EXISTS quickbooks.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text NOT NULL,
  company_name text,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  sync_type text NOT NULL CHECK (sync_type IN ('full', 'incremental', 'entity_specific')),
  start_date date,
  end_date date,
  entities_to_sync text[], -- Array of entity types to sync
  total_entities int DEFAULT 0,
  completed_entities int DEFAULT 0,
  failed_entities int DEFAULT 0,
  total_records int DEFAULT 0,
  processed_records int DEFAULT 0,
  error_records int DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for tracking individual entity sync progress
CREATE TABLE IF NOT EXISTS quickbooks.sync_entity_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_job_id uuid NOT NULL REFERENCES quickbooks.sync_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_table text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_count int DEFAULT 0,
  processed_count int DEFAULT 0,
  error_count int DEFAULT 0,
  current_position int DEFAULT 1,
  batch_size int DEFAULT 1000,
  error_message text,
  error_details jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for tracking individual batches within entity syncs
CREATE TABLE IF NOT EXISTS quickbooks.sync_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_job_id uuid NOT NULL REFERENCES quickbooks.sync_entity_jobs(id) ON DELETE CASCADE,
  batch_number int NOT NULL,
  start_position int NOT NULL,
  batch_size int NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  records_processed int DEFAULT 0,
  error_count int DEFAULT 0,
  error_message text,
  retry_count int DEFAULT 0,
  max_retries int DEFAULT 3,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_jobs_realm_id ON quickbooks.sync_jobs(realm_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON quickbooks.sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON quickbooks.sync_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_entity_jobs_sync_job_id ON quickbooks.sync_entity_jobs(sync_job_id);
CREATE INDEX IF NOT EXISTS idx_sync_entity_jobs_status ON quickbooks.sync_entity_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_entity_jobs_entity_type ON quickbooks.sync_entity_jobs(entity_type);

CREATE INDEX IF NOT EXISTS idx_sync_batches_entity_job_id ON quickbooks.sync_batches(entity_job_id);
CREATE INDEX IF NOT EXISTS idx_sync_batches_status ON quickbooks.sync_batches(status);

-- Function to get next pending batch across all entities
CREATE OR REPLACE FUNCTION quickbooks.get_next_pending_batch()
RETURNS TABLE (
  batch_id uuid,
  entity_job_id uuid,
  entity_type text,
  entity_table text,
  batch_number int,
  start_position int,
  batch_size int,
  sync_job_id uuid,
  realm_id text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id as batch_id,
    b.entity_job_id,
    ej.entity_type,
    ej.entity_table,
    b.batch_number,
    b.start_position,
    b.batch_size,
    ej.sync_job_id,
    sj.realm_id
  FROM quickbooks.sync_batches b
  INNER JOIN quickbooks.sync_entity_jobs ej ON b.entity_job_id = ej.id
  INNER JOIN quickbooks.sync_jobs sj ON ej.sync_job_id = sj.id
  WHERE b.status = 'pending'
    AND ej.status IN ('pending', 'running')
    AND sj.status = 'running'
    AND b.retry_count < b.max_retries
  ORDER BY sj.created_at ASC, ej.created_at ASC, b.batch_number ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to update job progress
CREATE OR REPLACE FUNCTION quickbooks.update_sync_job_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update entity job progress
  IF TG_TABLE_NAME = 'sync_batches' THEN
    UPDATE quickbooks.sync_entity_jobs
    SET
      processed_count = (
        SELECT COALESCE(SUM(records_processed), 0)
        FROM quickbooks.sync_batches
        WHERE entity_job_id = NEW.entity_job_id
          AND status = 'completed'
      ),
      error_count = (
        SELECT COALESCE(SUM(error_count), 0)
        FROM quickbooks.sync_batches
        WHERE entity_job_id = NEW.entity_job_id
      ),
      status = CASE
        WHEN (
          SELECT COUNT(*)
          FROM quickbooks.sync_batches
          WHERE entity_job_id = NEW.entity_job_id
            AND status IN ('pending', 'running')
        ) = 0 THEN 'completed'
        ELSE 'running'
      END,
      completed_at = CASE
        WHEN (
          SELECT COUNT(*)
          FROM quickbooks.sync_batches
          WHERE entity_job_id = NEW.entity_job_id
            AND status IN ('pending', 'running')
        ) = 0 THEN now()
        ELSE NULL
      END,
      updated_at = now()
    WHERE id = NEW.entity_job_id;
  END IF;

  -- Update overall sync job progress
  IF TG_TABLE_NAME = 'sync_entity_jobs' THEN
    UPDATE quickbooks.sync_jobs
    SET
      completed_entities = (
        SELECT COUNT(*)
        FROM quickbooks.sync_entity_jobs
        WHERE sync_job_id = NEW.sync_job_id
          AND status = 'completed'
      ),
      failed_entities = (
        SELECT COUNT(*)
        FROM quickbooks.sync_entity_jobs
        WHERE sync_job_id = NEW.sync_job_id
          AND status = 'failed'
      ),
      processed_records = (
        SELECT COALESCE(SUM(processed_count), 0)
        FROM quickbooks.sync_entity_jobs
        WHERE sync_job_id = NEW.sync_job_id
      ),
      error_records = (
        SELECT COALESCE(SUM(error_count), 0)
        FROM quickbooks.sync_entity_jobs
        WHERE sync_job_id = NEW.sync_job_id
      ),
      status = CASE
        WHEN (
          SELECT COUNT(*)
          FROM quickbooks.sync_entity_jobs
          WHERE sync_job_id = NEW.sync_job_id
            AND status IN ('pending', 'running')
        ) = 0 THEN 'completed'
        ELSE 'running'
      END,
      completed_at = CASE
        WHEN (
          SELECT COUNT(*)
          FROM quickbooks.sync_entity_jobs
          WHERE sync_job_id = NEW.sync_job_id
            AND status IN ('pending', 'running')
        ) = 0 THEN now()
        ELSE NULL
      END,
      updated_at = now()
    WHERE id = NEW.sync_job_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update progress
CREATE TRIGGER trigger_update_progress_from_batches
AFTER UPDATE ON quickbooks.sync_batches
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION quickbooks.update_sync_job_progress();

CREATE TRIGGER trigger_update_progress_from_entities
AFTER UPDATE ON quickbooks.sync_entity_jobs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION quickbooks.update_sync_job_progress();

-- Grant permissions (adjust as needed for your RLS policies)
ALTER TABLE quickbooks.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks.sync_entity_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks.sync_batches ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE quickbooks.sync_jobs IS 'Tracks QuickBooks synchronization jobs';
COMMENT ON TABLE quickbooks.sync_entity_jobs IS 'Tracks entity-level sync progress within a job';
COMMENT ON TABLE quickbooks.sync_batches IS 'Tracks individual batches for chunked processing';
