-- ============================================================
-- Organizations & Auth
-- ============================================================

CREATE TABLE IF NOT EXISTS orgs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',
  github_org  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Users
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  github_id     INTEGER NOT NULL UNIQUE,
  github_login  TEXT NOT NULL,
  email         TEXT,
  avatar_url    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_github ON users(github_id);

-- ============================================================
-- Org Members
-- ============================================================

CREATE TABLE IF NOT EXISTS org_members (
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

CREATE TABLE IF NOT EXISTS tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id),
  name        TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  scope       TEXT NOT NULL DEFAULT 'full',
  project_id  TEXT,
  expires_at  TEXT,
  last_used   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_tokens_org ON tokens(org_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON tokens(token_hash);

-- ============================================================
-- Projects
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);

-- ============================================================
-- Suites
-- ============================================================

CREATE TABLE IF NOT EXISTS suites (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  config_hash TEXT NOT NULL,
  tags        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_suites_project ON suites(project_id);

-- ============================================================
-- Runs
-- ============================================================

CREATE TABLE IF NOT EXISTS runs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id      TEXT NOT NULL REFERENCES suites(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'running',
  commit_sha    TEXT,
  branch        TEXT,
  environment   TEXT,
  triggered_by  TEXT,
  pass_rate         REAL,
  drift_score       REAL,
  schema_fail_count INTEGER DEFAULT 0,
  pii_fail_count    INTEGER DEFAULT 0,
  keyword_fail_count INTEGER DEFAULT 0,
  judge_avg_score   REAL,
  cost_estimate_usd REAL,
  latency_avg_ms    REAL,
  test_count        INTEGER DEFAULT 0,
  model_count       INTEGER DEFAULT 0,
  gate_passed       INTEGER,
  compliance_report TEXT,
  compliance_hash   TEXT,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_suite ON runs(suite_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at DESC);

-- ============================================================
-- Results (per test case per model, aggregated)
-- ============================================================

CREATE TABLE IF NOT EXISTS results (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  run_id          TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  test_case_name  TEXT NOT NULL,
  model_id        TEXT NOT NULL,
  passed          INTEGER NOT NULL,
  pass_rate       REAL NOT NULL,
  run_count       INTEGER NOT NULL,
  judge_avg       REAL,
  drift_score     REAL,
  latency_avg_ms  REAL,
  cost_usd        REAL,
  total_tokens    INTEGER,
  failure_codes   TEXT,
  failure_messages TEXT,
  assertion_scores TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_results_run ON results(run_id);
CREATE INDEX IF NOT EXISTS idx_results_test ON results(test_case_name);

-- ============================================================
-- Artifacts (optional, large data)
-- Reserved for future use: per-run raw I/O storage
-- ============================================================

CREATE TABLE IF NOT EXISTS artifacts (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  result_id   TEXT NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  run_index   INTEGER NOT NULL,
  output_text TEXT,
  input_text  TEXT,
  tool_calls  TEXT,
  raw_response TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_artifacts_result ON artifacts(result_id);

-- ============================================================
-- Baselines
-- ============================================================

CREATE TABLE IF NOT EXISTS baselines (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  suite_id    TEXT NOT NULL REFERENCES suites(id) ON DELETE CASCADE,
  run_id      TEXT NOT NULL REFERENCES runs(id),
  label       TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_baselines_suite ON baselines(suite_id);
CREATE INDEX IF NOT EXISTS idx_baselines_active ON baselines(suite_id, is_active);

-- ============================================================
-- Auth Codes (short-lived, single-use OAuth code exchange)
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_codes (
  code        TEXT PRIMARY KEY,
  token       TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_codes_expires ON auth_codes(expires_at);

-- ============================================================
-- Idempotency Keys (prevent duplicate uploads)
-- ============================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  response    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_keys(expires_at);

-- ============================================================
-- Webhooks
-- ============================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  events      TEXT NOT NULL,
  secret      TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(org_id);

-- ============================================================
-- Billing
-- ============================================================

CREATE TABLE IF NOT EXISTS billing (
  org_id                  TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  plan                    TEXT NOT NULL DEFAULT 'free',
  period_end              TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Audit Log (0002_audit_log.sql)
-- ============================================================

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

-- ============================================================
-- Signing Keys (0003_signing_keys.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS signing_keys (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  private_key_enc TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'Ed25519',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- SAML SSO Configuration (0004_saml.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS saml_configs (
  org_id TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  idp_entity_id TEXT NOT NULL,
  idp_sso_url TEXT NOT NULL,
  idp_certificate TEXT NOT NULL,
  sp_entity_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Rate Limits (0005_hardening.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

-- ============================================================
-- Additional Indexes (0005_hardening.sql)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_runs_project_created ON runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_org ON org_members(org_id);

-- ============================================================
-- Pending Invites (0007_pending_invites.sql)
-- ============================================================

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

-- ============================================================
-- SAML Assertion Replay Protection (0009_saml_assertions.sql)
-- ============================================================

CREATE TABLE IF NOT EXISTS saml_assertions (
  assertion_id TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL,
  used_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at   TEXT NOT NULL
);
