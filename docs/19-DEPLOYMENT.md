# KindLM — Deployment Runbook

---

## 1. Overview

KindLM has two deployment targets:

| Component | Target | Trigger | Frequency |
|-----------|--------|---------|-----------|
| `@kindlm/cli` + `@kindlm/core` | npm registry | Git tag `v*` | On release (1–4× per month) |
| `@kindlm/cloud` | Cloudflare Workers | Push to `main` | On merge (continuous) |

---

## 2. CLI / Core — npm Publishing

### Prerequisites

- npm account with 2FA enabled, member of `@kindlm` org
- `NPM_TOKEN` secret in GitHub Actions (automation token)
- Provenance attestation enabled (sigstore)

### Release process

**Step 1: Version bump**

```bash
# From repo root
# Bumps version in all packages, creates git tag
npx changeset version   # If using changesets
# OR manually:
npm version patch -w packages/core -w packages/cli
git tag v1.2.3
```

**Step 2: Push tag**

```bash
git push origin main --tags
```

**Step 3: CI publishes automatically**

The `release.yml` workflow triggers on tag push:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

permissions:
  contents: write
  id-token: write  # Required for npm provenance

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx turbo test
      - run: npx turbo lint
      - run: npx turbo typecheck

  publish:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      
      - run: npm ci
      - run: npx turbo build
      
      # Publish core first (cli depends on it)
      - run: npm publish -w packages/core --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      
      - run: npm publish -w packages/cli --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  github-release:
    needs: publish
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

**Step 4: Verify**

```bash
# Check npm
npm info @kindlm/cli version
npm info @kindlm/core version

# Check provenance
npm audit signatures @kindlm/cli

# Test install
npx @kindlm/cli --version
```

### Rollback (npm)

npm doesn't support true rollback. If a broken version is published:

```bash
# Deprecate broken version (users get warning on install)
npm deprecate @kindlm/cli@1.2.3 "Critical bug — use 1.2.4"

# Unpublish within 72 hours (if critical)
npm unpublish @kindlm/cli@1.2.3

# Publish fix immediately
npm version patch -w packages/core -w packages/cli
git tag v1.2.4
git push origin main --tags
```

---

## 3. Cloud — Cloudflare Workers Deployment

### Prerequisites

- Cloudflare account with Workers plan
- `wrangler.toml` configured in `packages/cloud/`
- Secrets set via `wrangler secret put`:
  - `GITHUB_CLIENT_ID` — GitHub OAuth App ID
  - `GITHUB_CLIENT_SECRET` — GitHub OAuth App secret
  - `STRIPE_SECRET_KEY` — Stripe API key (Phase 3)
  - `SIGNING_KEY` — Ed25519 private key for report signing (Enterprise)

### Infrastructure

```
┌─────────────────────────────────────────┐
│              Cloudflare Edge             │
│                                         │
│  ┌──────────┐  ┌────┐  ┌────────────┐  │
│  │  Worker   │──│ D1 │  │     KV     │  │
│  │ (Hono)   │  │    │  │ Rate limits│  │
│  └──────────┘  └────┘  └────────────┘  │
│       │                                  │
│  ┌──────────┐                           │
│  │  Cron    │  Retention cleanup         │
│  │  Trigger │  (daily at 02:00 UTC)     │
│  └──────────┘                           │
└─────────────────────────────────────────┘
```

### `wrangler.toml`

```toml
name = "kindlm-cloud"
main = "src/index.ts"
compatibility_date = "2026-02-01"
node_compat = true

[triggers]
crons = ["0 2 * * *"]  # Daily retention cleanup

[[d1_databases]]
binding = "DB"
database_name = "kindlm-prod"
database_id = "<generated-by-wrangler>"

[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "<generated-by-wrangler>"

[env.staging]
name = "kindlm-cloud-staging"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "kindlm-staging"
database_id = "<generated-by-wrangler>"

[[env.staging.kv_namespaces]]
binding = "RATE_LIMITS"
id = "<generated-by-wrangler>"
```

### Deployment flow

**Continuous deployment** on push to `main`:

```yaml
# .github/workflows/deploy-cloud.yml
name: Deploy Cloud
on:
  push:
    branches: [main]
    paths:
      - 'packages/cloud/**'
      - 'packages/core/**'  # Cloud imports core

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx turbo test --filter=@kindlm/cloud

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx turbo build --filter=@kindlm/cloud
      - run: npx wrangler deploy --env staging
        working-directory: packages/cloud
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}

  smoke-test:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - run: |
          # Health check
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://staging-api.kindlm.com/v1/health)
          if [ "$STATUS" != "200" ]; then
            echo "Health check failed: $STATUS"
            exit 1
          fi
          
          # Auth endpoint responds
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://staging-api.kindlm.com/v1/auth/verify)
          if [ "$STATUS" != "401" ]; then
            echo "Auth check failed: expected 401, got $STATUS"
            exit 1
          fi

  deploy-production:
    needs: smoke-test
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx turbo build --filter=@kindlm/cloud
      - run: npx wrangler deploy
        working-directory: packages/cloud
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

### Database migrations

D1 migrations are SQL files in `packages/cloud/migrations/`:

```
migrations/
├── 0001_initial.sql
├── 0002_add_audit_log.sql
└── 0003_add_stripe_fields.sql
```

Applied via Wrangler before deployment:

```bash
# In deploy step, before wrangler deploy:
npx wrangler d1 migrations apply kindlm-prod
```

**Migration rules:**
- Migrations are forward-only (no down migrations)
- Every migration is idempotent (`CREATE TABLE IF NOT EXISTS`)
- Never delete columns in production — mark deprecated, remove after 2 releases
- Test migrations against staging D1 first

### Rollback (Cloud)

Cloudflare Workers supports instant rollback:

```bash
# List recent deployments
npx wrangler deployments list

# Rollback to previous deployment
npx wrangler rollback
```

**Database rollback is NOT automatic.** If a migration needs reversal:
1. Write a new forward migration that reverses the change
2. Apply it as a new migration
3. Deploy

---

## 4. D1 Database Setup

### Initial setup

```bash
# Create production database
npx wrangler d1 create kindlm-prod

# Create staging database
npx wrangler d1 create kindlm-staging

# Apply migrations
npx wrangler d1 migrations apply kindlm-prod
npx wrangler d1 migrations apply kindlm-staging
```

### Initial migration (`0001_initial.sql`)

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  github_org TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  github_id INTEGER NOT NULL UNIQUE,
  github_login TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, name)
);

CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  git_commit TEXT,
  git_branch TEXT,
  ci_provider TEXT,
  total_tests INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  pass_rate REAL NOT NULL,
  duration_ms INTEGER NOT NULL,
  report_json TEXT NOT NULL,
  compliance_markdown TEXT,
  compliance_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS baselines (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  suite_name TEXT,
  label TEXT NOT NULL,
  run_id TEXT NOT NULL REFERENCES test_runs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  event TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runs_project ON test_runs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_org ON test_runs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_branch ON test_runs(project_id, git_branch, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(org_id, event, created_at DESC);
```

---

## 5. Secrets Management

### GitHub Actions secrets

| Secret | Used by | Rotation |
|--------|---------|----------|
| `NPM_TOKEN` | Release workflow | Annually or on compromise |
| `CF_API_TOKEN` | Cloud deploy workflow | Annually or on compromise |
| `E2E_OPENAI_KEY` | Nightly E2E tests | On demand |
| `E2E_ANTHROPIC_KEY` | Nightly E2E tests | On demand |

### Cloudflare Workers secrets

```bash
# Set secrets (never in wrangler.toml)
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put STRIPE_SECRET_KEY      # Phase 3
npx wrangler secret put SIGNING_PRIVATE_KEY     # Enterprise
```

### Local development

```bash
# packages/cloud/.dev.vars (gitignored)
GITHUB_CLIENT_ID=your_dev_app_id
GITHUB_CLIENT_SECRET=your_dev_app_secret
```

---

## 6. Monitoring & Alerting

### Health checks

| Endpoint | Expected | Check Frequency |
|----------|----------|----------------|
| `GET /v1/health` | 200 `{"status":"ok"}` | Every 1 minute |
| `POST /v1/auth/verify` (no token) | 401 | Every 5 minutes |

Monitored via Cloudflare Health Checks (free) or UptimeRobot.

### Metrics to track

| Metric | Source | Alert Threshold |
|--------|--------|----------------|
| Worker invocations | Cloudflare Analytics | > 10,000/hr (unexpected spike) |
| Error rate (5xx) | Cloudflare Analytics | > 1% of requests |
| D1 query latency | Worker logs | p95 > 200ms |
| Upload payload size | Worker logs | Approaching 5MB limit frequently |
| Rate limit hits | KV counter | > 50% of users hitting limits |

### Alerting

Phase 1 (MVP): Cloudflare email alerts for worker errors.

Phase 2 (Cloud): 
- Slack webhook for 5xx errors, deployment failures
- Weekly email digest of usage metrics

Phase 3 (Enterprise):
- PagerDuty/Opsgenie integration for SLA-bound customers
- Real-time Grafana dashboard

---

## 7. Domain & DNS

```
kindlm.com          → Landing page (Vercel / Cloudflare Pages)
cloud.kindlm.com    → Dashboard (Cloudflare Pages)
api.kindlm.com      → Cloud API (Cloudflare Worker custom domain)
docs.kindlm.com     → Documentation (Cloudflare Pages or Mintlify)
```

All domains on Cloudflare DNS for unified management. SSL certificates auto-provisioned by Cloudflare.

---

## 8. Pre-Deployment Checklist

### Before every CLI release:

- [ ] All tests pass (`npx turbo test`)
- [ ] Lint passes (`npx turbo lint`)
- [ ] Type check passes (`npx turbo typecheck`)
- [ ] Version bumped in all affected packages
- [ ] CHANGELOG updated
- [ ] `npx @kindlm/cli --version` outputs correct version (build locally first)
- [ ] `npx @kindlm/cli test` works against test fixture
- [ ] No `npm audit` critical/high vulnerabilities

### Before every Cloud deployment:

- [ ] All tests pass (including cloud integration tests)
- [ ] Migrations tested on staging
- [ ] Staging deployment smoke tested
- [ ] No breaking API changes without version bump
- [ ] Rate limit configuration correct for all plans
- [ ] Health check passes after deploy

---

## 9. Disaster Recovery

| Scenario | Recovery |
|----------|----------|
| D1 data loss | D1 has automatic backups. Restore via Cloudflare dashboard. RPO: ~24 hours. |
| Worker crashes on deploy | `npx wrangler rollback` — instant, < 1 minute |
| npm package compromised | `npm unpublish` within 72 hours, publish patched version, security advisory |
| API token breach | Revoke all tokens for affected org, force re-authentication |
| Cloudflare outage | CLI works fully offline. Cloud dashboard unavailable. Status page notification. |
| GitHub OAuth outage | Existing tokens still work. New logins blocked. Status page notification. |
