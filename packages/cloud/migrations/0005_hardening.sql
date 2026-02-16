-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_results_run_id ON results(run_id);
CREATE INDEX IF NOT EXISTS idx_runs_project_created ON runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_baselines_suite ON baselines(suite_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_org ON tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(org_id);
CREATE INDEX IF NOT EXISTS idx_members_org ON org_members(org_id);

-- Rate limiting table (D1-based, replaces in-memory Map)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);
