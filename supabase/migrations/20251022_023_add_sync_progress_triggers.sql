-- Add triggers to automatically update sync job progress
-- This was missing from the initial table creation

-- Function to update job progress
CREATE OR REPLACE FUNCTION quickbooks.update_sync_job_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update entity job progress from batch updates
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

  -- Update overall sync job progress from entity job updates
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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_progress_from_batches ON quickbooks.sync_batches;
DROP TRIGGER IF EXISTS trigger_update_progress_from_entities ON quickbooks.sync_entity_jobs;

-- Create triggers to automatically update progress
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
