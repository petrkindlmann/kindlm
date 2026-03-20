CREATE TABLE IF NOT EXISTS pending_invites (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES orgs(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_pending_invites_org ON pending_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_pending_invites_email ON pending_invites(email);
