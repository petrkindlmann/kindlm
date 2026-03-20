CREATE TABLE IF NOT EXISTS saml_assertions (
  assertion_id TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL,
  used_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL
);
