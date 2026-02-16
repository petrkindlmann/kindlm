# KindLM Cloud API

## Overview

The KindLM Cloud API provides persistent storage for test runs, baseline management, and team collaboration. Built on Cloudflare Workers + D1 (serverless SQLite) for zero cold starts and global distribution.

**Base URL:** `https://api.kindlm.com/v1`  
**Auth:** Bearer token  
**Format:** JSON request/response  
**Versioning:** URL path (`/v1`)

---

## D1 SQL Schema

```sql
-- packages/cloud/src/db/schema.sql

-- ============================================================
-- Organizations & Auth
-- ============================================================

CREATE TABLE IF NOT EXISTS orgs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free', -- free, team, enterprise
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                -- Human-readable label
  token_hash  TEXT NOT NULL UNIQUE,         -- SHA-256 hash of the actual token
  scope       TEXT NOT NULL DEFAULT 'full', -- full, ci, readonly
  project_id  TEXT,                         -- NULL = all projects, else scoped
  expires_at  TEXT,                         -- NULL = never expires
  last_used   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at  TEXT                          -- Soft delete
);

CREATE INDEX idx_tokens_org ON tokens(org_id);
CREATE INDEX idx_tokens_hash ON tokens(token_hash);

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

CREATE INDEX idx_projects_org ON projects(org_id);

-- ============================================================
-- Suites
-- ============================================================

CREATE TABLE IF NOT EXISTS suites (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  config_hash TEXT NOT NULL,    -- SHA-256 hash of config for dedup
  tags        TEXT,             -- JSON array of strings
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, name)
);

CREATE INDEX idx_suites_project ON suites(project_id);

-- ============================================================
-- Runs
-- ============================================================

CREATE TABLE IF NOT EXISTS runs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  suite_id      TEXT NOT NULL REFERENCES suites(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
  commit_sha    TEXT,
  branch        TEXT,
  environment   TEXT,               -- ci, local, staging, production
  triggered_by  TEXT,               -- token name or user identifier

  -- Summary metrics (populated on completion)
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
  gate_passed       INTEGER,        -- 1 = passed, 0 = failed

  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_runs_project ON runs(project_id);
CREATE INDEX idx_runs_suite ON runs(suite_id);
CREATE INDEX idx_runs_status ON runs(status);
CREATE INDEX idx_runs_created ON runs(created_at DESC);

-- ============================================================
-- Results (per test case per model, aggregated)
-- ============================================================

CREATE TABLE IF NOT EXISTS results (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  run_id          TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  test_case_name  TEXT NOT NULL,
  model_id        TEXT NOT NULL,
  passed          INTEGER NOT NULL, -- 1 = passed, 0 = failed
  pass_rate       REAL NOT NULL,    -- Aggregated across repeat runs
  run_count       INTEGER NOT NULL, -- Number of repeat runs

  -- Metrics
  judge_avg       REAL,
  drift_score     REAL,
  latency_avg_ms  REAL,
  cost_usd        REAL,
  total_tokens    INTEGER,

  -- Failure details
  failure_codes   TEXT,             -- JSON array of FailureCode strings
  failure_messages TEXT,            -- JSON array of failure message strings

  -- Assertion detail scores
  assertion_scores TEXT,            -- JSON: { "type:label": { mean, min, max } }

  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_results_run ON results(run_id);
CREATE INDEX idx_results_test ON results(test_case_name);

-- ============================================================
-- Artifacts (optional, large data)
-- ============================================================

CREATE TABLE IF NOT EXISTS artifacts (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  result_id   TEXT NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  run_index   INTEGER NOT NULL,     -- Which repeat run (0-indexed)
  output_text TEXT,                 -- Raw model output
  input_text  TEXT,                 -- Rendered prompt (after interpolation)
  tool_calls  TEXT,                 -- JSON array of tool call objects
  raw_response TEXT,                -- Full provider response JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_artifacts_result ON artifacts(result_id);

-- ============================================================
-- Baselines
-- ============================================================

CREATE TABLE IF NOT EXISTS baselines (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(12)))),
  suite_id    TEXT NOT NULL REFERENCES suites(id) ON DELETE CASCADE,
  run_id      TEXT NOT NULL REFERENCES runs(id),
  label       TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 0, -- Only one active per suite
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at TEXT
);

CREATE INDEX idx_baselines_suite ON baselines(suite_id);
CREATE INDEX idx_baselines_active ON baselines(suite_id, is_active);

-- ============================================================
-- Idempotency Keys (prevent duplicate uploads)
-- ============================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  response    TEXT NOT NULL,         -- Cached response JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL           -- Auto-cleanup after 24h
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

---

## REST Endpoints

### Authentication

All endpoints require `Authorization: Bearer <token>` header.

Token is validated by hashing and looking up in the `tokens` table. Revoked tokens are rejected. Expired tokens are rejected.

```
POST /v1/auth/tokens
  Body: { name: string, scope: "full" | "ci" | "readonly", projectId?: string, expiresInDays?: number }
  Response: { token: string, id: string, expiresAt: string | null }
  Note: The raw token is returned ONLY in this response. Store it securely.

GET /v1/auth/tokens
  Response: { tokens: [{ id, name, scope, projectId, lastUsed, createdAt, expiresAt }] }

DELETE /v1/auth/tokens/:id
  Response: { revoked: true }
```

### Projects

```
POST /v1/projects
  Body: { name: string, description?: string }
  Response: { id, name, description, createdAt }

GET /v1/projects
  Response: { projects: [...] }

GET /v1/projects/:projectId
  Response: { id, name, description, createdAt, recentRuns: [...top 5] }

DELETE /v1/projects/:projectId
  Response: { deleted: true }
  Note: Cascades to suites, runs, results, artifacts, baselines
```

### Suites

```
POST /v1/projects/:projectId/suites
  Body: { name, description?, configHash, tags? }
  Response: { id, name, configHash, createdAt }
  Note: Upserts — if suite with same name exists, updates configHash

GET /v1/projects/:projectId/suites
  Response: { suites: [...] }

GET /v1/suites/:suiteId
  Response: { id, name, description, configHash, tags, activeBaseline, latestRun }
```

### Runs

```
POST /v1/projects/:projectId/runs
  Body: {
    suiteId: string,
    metadata: { commitSha?, branch?, environment?, triggeredBy? }
  }
  Response: { runId, createdAt }
  Headers: Idempotency-Key recommended

POST /v1/runs/:runId/results
  Body: {
    summary: {
      passRate, driftScore, schemaFailCount, piiFailCount,
      keywordFailCount, judgeAvgScore, costEstimateUsd,
      latencyAvgMs, testCount, modelCount, gatePassed
    },
    results: [{
      testCaseName, modelId, passed, passRate, runCount,
      judgeAvg?, driftScore?, latencyAvgMs?, costUsd?, totalTokens?,
      failureCodes?, failureMessages?, assertionScores?
    }],
    artifacts?: [{
      testCaseName, modelId, runIndex, outputText?, inputText?,
      toolCalls?, rawResponse?
    }]
  }
  Response: { uploaded: true, resultCount: number }
  Headers: Idempotency-Key required

PATCH /v1/runs/:runId
  Body: { status: "completed" | "failed", finishedAt: string }
  Response: { updated: true }

GET /v1/runs/:runId
  Response: Full run with summary + results

GET /v1/projects/:projectId/runs?limit=20&cursor=<createdAt>&status=completed
  Response: { runs: [...], nextCursor: string | null }

GET /v1/suites/:suiteId/runs?limit=20&cursor=<createdAt>
  Response: { runs: [...], nextCursor: string | null }
```

### Baselines

```
POST /v1/suites/:suiteId/baselines
  Body: { runId: string, label: string }
  Response: { id, label, runId, createdAt }

GET /v1/suites/:suiteId/baselines
  Response: { baselines: [...], active: { id, label, runId } | null }

POST /v1/baselines/:baselineId/activate
  Response: { activated: true }
  Note: Deactivates any previously active baseline for the suite

DELETE /v1/baselines/:baselineId
  Response: { deleted: true }
```

### Compare

```
GET /v1/runs/:runId/compare?baselineRunId=<id>
  Response: {
    current: { runId, passRate, driftScore, ... },
    baseline: { runId, passRate, driftScore, ... },
    delta: {
      passRate: number,        // positive = improvement
      driftScore: number,      // positive = more drift (worse)
      schemaFailCount: number,
      judgeAvgScore: number,
    },
    regressions: [{            // Test cases that passed in baseline but fail now
      testCaseName, modelId,
      baselinePassRate, currentPassRate,
      newFailureCodes
    }],
    improvements: [{           // Test cases that failed in baseline but pass now
      testCaseName, modelId,
      baselinePassRate, currentPassRate,
    }]
  }
```

---

## Rate Limiting

Per-org limits enforced via D1 counter table:

| Plan | Requests/min | Runs/month | Artifacts storage |
|------|-------------|------------|-------------------|
| Free | 60 | 100 | None |
| Pro | 300 | 5,000 | 1 GB |
| Enterprise | Custom | Custom | Custom |

Rate limit headers returned on every response:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1708012800
```

---

## Error Format

All errors return consistent JSON:

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token has been revoked",
    "details": {}
  }
}
```

Error codes:
- `INVALID_TOKEN` — 401
- `TOKEN_EXPIRED` — 401
- `FORBIDDEN` — 403 (token scope insufficient)
- `NOT_FOUND` — 404
- `CONFLICT` — 409 (duplicate resource)
- `RATE_LIMITED` — 429
- `VALIDATION_ERROR` — 422 (body validation failed)
- `IDEMPOTENCY_CONFLICT` — 409 (different body for same idempotency key)
- `INTERNAL_ERROR` — 500

---

## Upload Flow (CLI → Cloud)

```
CLI                                 Cloud API
 │                                      │
 │  POST /projects/:id/runs             │
 │  { suiteId, metadata }               │
 │ ────────────────────────────────────▶ │
 │                                      │  Create run (status=running)
 │  ◀──── { runId }                     │
 │                                      │
 │  ... execute tests locally ...       │
 │                                      │
 │  POST /runs/:id/results              │
 │  { summary, results, artifacts? }    │
 │  Idempotency-Key: <uuid>            │
 │ ────────────────────────────────────▶ │
 │                                      │  Store results + artifacts
 │  ◀──── { uploaded: true }            │
 │                                      │
 │  PATCH /runs/:id                     │
 │  { status: "completed" }             │
 │ ────────────────────────────────────▶ │
 │                                      │  Update run status
 │  ◀──── { updated: true }             │
```

---

## Cloudflare Workers Setup

```toml
# packages/cloud/wrangler.toml

name = "kindlm-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "kindlm-prod"
database_id = "<generated>"

# Optional: R2 for large artifact storage (v1.2)
# [[r2_buckets]]
# binding = "ARTIFACTS"
# bucket_name = "kindlm-artifacts"

[vars]
ENVIRONMENT = "production"
```

```typescript
// packages/cloud/src/index.ts

import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { projectRoutes } from "./routes/projects";
import { suiteRoutes } from "./routes/suites";
import { runRoutes } from "./routes/runs";
import { resultRoutes } from "./routes/results";
import { baselineRoutes } from "./routes/baselines";
import { compareRoutes } from "./routes/compare";
import { authRoutes } from "./routes/auth";

type Bindings = {
  DB: D1Database;
  ENVIRONMENT: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());
app.use("/v1/*", authMiddleware);
app.use("/v1/*", rateLimitMiddleware);

app.route("/v1/auth", authRoutes);
app.route("/v1/projects", projectRoutes);
app.route("/v1/suites", suiteRoutes);
app.route("/v1/runs", runRoutes);
app.route("/v1/results", resultRoutes);
app.route("/v1/baselines", baselineRoutes);
app.route("/v1/compare", compareRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
```

---

## Plan Gating

The Cloud API enforces feature limits based on the organization's plan. The `plan-gate` middleware checks the org's plan before allowing access to gated features.

### Plan Limits

| Resource / Feature | Free | Team ($49/mo) | Enterprise ($299/mo) |
|-------------------|------|---------------|---------------------|
| Projects | 1 | 5 | Unlimited |
| Team members | 1 | 10 | Unlimited |
| Test run history retention | 7 days | 90 days | Unlimited |
| Compliance PDF export | — | ✓ | ✓ |
| Signed compliance reports | — | — | ✓ |
| SSO / SAML | — | — | ✓ |
| Audit log API (`/v1/audit-log`) | — | — | ✓ |
| Webhook / Slack notifications | — | ✓ | ✓ |
| API rate limit | 100 req/hr | 1,000 req/hr | 10,000 req/hr |
| Support | GitHub Issues | Email | Dedicated |
| SLA | — | — | 99.9% |

### Middleware Implementation

```typescript
// packages/cloud/src/middleware/plan-gate.ts

import { Context, Next } from "hono";

type Plan = "free" | "team" | "enterprise";

const LIMITS: Record<Plan, { projects: number; members: number; retentionDays: number; rateLimit: number }> = {
  free:       { projects: 1,        members: 1,        retentionDays: 7,    rateLimit: 100 },
  team:       { projects: 5,        members: 10,       retentionDays: 90,   rateLimit: 1000 },
  enterprise: { projects: Infinity, members: Infinity,  retentionDays: -1,   rateLimit: 10000 },
};

const GATED_FEATURES: Record<string, Plan[]> = {
  "compliance-pdf":     ["team", "enterprise"],
  "compliance-signed":  ["enterprise"],
  "sso":                ["enterprise"],
  "audit-log":          ["enterprise"],
  "webhooks":           ["team", "enterprise"],
};

export function requirePlan(...allowed: Plan[]) {
  return async (c: Context, next: Next) => {
    const org = c.get("org");
    if (!allowed.includes(org.plan as Plan)) {
      return c.json({
        error: "plan_required",
        message: `This feature requires a ${allowed[0]} plan or higher.`,
        upgrade_url: "https://kindlm.com/#pricing",
      }, 403);
    }
    return next();
  };
}

export function getLimits(plan: Plan) {
  return LIMITS[plan] ?? LIMITS.free;
}
```

### Billing Integration

Billing is handled via Stripe. The Cloud dashboard exposes plan management at `https://cloud.kindlm.com/settings/billing`.

- Plan upgrades take effect immediately
- Plan downgrades take effect at the end of the billing period
- Enterprise plans require a sales conversation (contact form)
- Free plan requires no payment method

### Data Retention

Test runs older than the plan's retention period are automatically deleted by a scheduled Cloudflare Worker (cron trigger, runs daily at 02:00 UTC). Compliance reports on the Enterprise plan are never deleted unless the organization requests it.
