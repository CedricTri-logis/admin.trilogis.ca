-- Manually update the current sync job with actual progress from entity_jobs
-- This is a one-time fix for the job that already completed

UPDATE quickbooks.sync_jobs sj
SET
  completed_entities = (
    SELECT COUNT(*)
    FROM quickbooks.sync_entity_jobs
    WHERE sync_job_id = sj.id
      AND status = 'completed'
  ),
  failed_entities = (
    SELECT COUNT(*)
    FROM quickbooks.sync_entity_jobs
    WHERE sync_job_id = sj.id
      AND status = 'failed'
  ),
  processed_records = (
    SELECT COALESCE(SUM(processed_count), 0)
    FROM quickbooks.sync_entity_jobs
    WHERE sync_job_id = sj.id
  ),
  error_records = (
    SELECT COALESCE(SUM(error_count), 0)
    FROM quickbooks.sync_entity_jobs
    WHERE sync_job_id = sj.id
  ),
  status = CASE
    WHEN (
      SELECT COUNT(*)
      FROM quickbooks.sync_entity_jobs
      WHERE sync_job_id = sj.id
        AND status IN ('pending', 'running')
    ) = 0 THEN 'completed'
    ELSE 'running'
  END,
  completed_at = CASE
    WHEN (
      SELECT COUNT(*)
      FROM quickbooks.sync_entity_jobs
      WHERE sync_job_id = sj.id
        AND status IN ('pending', 'running')
    ) = 0 THEN now()
    ELSE completed_at
  END,
  updated_at = now()
WHERE id = '09b0f039-a8b0-4846-84b6-3364e3a31ac2';

-- Show the updated job
SELECT
  id,
  company_name,
  status,
  completed_entities,
  total_entities,
  processed_records,
  error_records
FROM quickbooks.sync_jobs
WHERE id = '09b0f039-a8b0-4846-84b6-3364e3a31ac2';
