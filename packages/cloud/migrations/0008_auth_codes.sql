CREATE TABLE IF NOT EXISTS auth_codes (
  code        TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_codes(expires_at);
