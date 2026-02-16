-- Audit log for enterprise compliance
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  actor_id TEXT,
  actor_type TEXT NOT NULL DEFAULT 'token',
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id, created_at DESC);
