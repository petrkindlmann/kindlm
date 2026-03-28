-- Migration 0011: Audit log enhancements + token rotation support
-- Adds actor_id index on audit_log for filtering by actor.
-- Adds token_default_ttl_hours to orgs for org-level token TTL policy.

-- Index for filtering audit log by actor_id (common query pattern)
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(org_id, actor_id, created_at DESC);

-- Org-level default TTL for newly created tokens (NULL = no default)
ALTER TABLE orgs ADD COLUMN token_default_ttl_hours INTEGER;
