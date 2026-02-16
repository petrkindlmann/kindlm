-- Ed25519 signing keys for compliance report verification
CREATE TABLE IF NOT EXISTS signing_keys (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  private_key_enc TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'Ed25519',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
