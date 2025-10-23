-- Disable RLS on QuickBooks sync tables
-- These are admin-only tables that don't need row-level security

ALTER TABLE quickbooks.sync_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks.sync_entity_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE quickbooks.sync_batches DISABLE ROW LEVEL SECURITY;
