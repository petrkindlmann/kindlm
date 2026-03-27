# Architecture Research: Shipping KindLM v1.0

Date: 2026-03-27
Scope: End-to-end deployment, monitoring, D1 migrations, CF Pages routing, OAuth debugging
Context: Solo developer, TypeScript monorepo, Cloudflare ecosystem

---

## 1. End-to-End Deployment Verification (CLI -> API -> Dashboard)

### Current State

The codebase has five deployable surfaces:

| Surface | Technology | Deploy Target | Status |
|---------|-----------|---------------|--------|
| `@kindlm/core` | TypeScript library | npm registry | Published (v0.2.1) |
| `@kindlm/cli` | Node.js CLI | npm registry | Published (v0.4.1) |
| `@kindlm/cloud` | Hono on CF Workers | `api.kindlm.com` | Broken |
| `@kindlm/dashboard` | Next.js static export | CF Pages (`cloud.kindlm.com`) | Not deployed |
| `kindlm-site` | Next.js static | CF Pages (`kindlm.com`) | Not deployed |

### Data Flow: CLI Upload Path

```
kindlm test                    # Runs tests locally, writes .kindlm/last-run.json
  |
kindlm upload -p my-project    # Reads last-run, resolves git/CI info
  |
  v
CloudClient (cli/src/cloud/client.ts)
  |-- GET  /v1/projects            --> find existing project
  |-- POST /v1/projects            --> or create new one
  |-- GET  /v1/projects/:id/suites --> find existing suite
  |-- POST /v1/projects/:id/suites --> or create new one
  |-- POST /v1/projects/:id/runs   --> create run (status: running)
  |-- POST /v1/runs/:id/results    --> batch insert results (50/batch)
  |-- PATCH /v1/runs/:id           --> finalize (status: completed, metrics)
  v
Dashboard SWR fetcher (dashboard/lib/api.ts)
  |-- GET /v1/projects             --> project list
  |-- GET /v1/projects/:id/runs    --> run history
  |-- GET /v1/runs/:id/results     --> test results
```

### Data Flow: OAuth Login (Dashboard)

```
User clicks "Sign in with GitHub" on cloud.kindlm.com/login
  |
  v
GET api.kindlm.com/auth/github?redirect_uri=https://cloud.kindlm.com/login/callback
  |-- Builds HMAC-signed state (nonce|redirect_uri.HMAC)
  |-- Redirects to github.com/login/oauth/authorize
  v
GitHub callback -> GET api.kindlm.com/auth/github/callback?code=xxx&state=yyy
  |-- Verifies HMAC state (CSRF protection)
  |-- Exchanges code for GitHub access token
  |-- Fetches GitHub user info + email
  |-- Creates/finds user + org in D1
  |-- Generates klm_xxx API token, stores SHA-256 hash
  |-- Encrypts token, stores as 30-second auth_code in D1
  |-- Redirects to cloud.kindlm.com/login/callback?code=zzz
  v
Dashboard /login/callback page (client-side)
  |-- POST api.kindlm.com/auth/exchange {code: zzz}
  |-- Receives plaintext token
  |-- Stores in klm_token cookie (30 days, Secure, SameSite=Lax)
  |-- Redirects to /projects
```

### Verification Strategy: Staged Smoke Tests

The existing `deploy-cloud.yml` already has the right structure: test -> deploy staging -> smoke test -> deploy production. But the smoke tests are too shallow (just health check + 401 check). For v1.0, expand to verify the actual data path.

**Recommended smoke test sequence after staging deploy:**

```bash
# 1. Health check (already exists)
curl -sf https://staging-api.kindlm.com/health | jq .status

# 2. Auth endpoint exists (already exists)
curl -s -o /dev/null -w "%{http_code}" https://staging-api.kindlm.com/v1/auth/tokens
# Expected: 401

# 3. OAuth redirect works (NEW)
curl -s -o /dev/null -w "%{http_code}" \
  "https://staging-api.kindlm.com/auth/github?redirect_uri=https://cloud.kindlm.com/login/callback"
# Expected: 302 (redirect to github.com)

# 4. CORS headers present (NEW)
curl -s -I -X OPTIONS https://staging-api.kindlm.com/v1/projects \
  -H "Origin: https://cloud.kindlm.com" \
  -H "Access-Control-Request-Method: GET" | grep -i "access-control"
# Expected: access-control-allow-origin: https://cloud.kindlm.com

# 5. Root endpoint (NEW)
curl -sf https://staging-api.kindlm.com/ | jq .name
# Expected: "KindLM API"
```

**Why not full E2E in CI:** Creating a real GitHub OAuth token in CI is not practical (requires browser interaction). Instead, use a pre-provisioned staging API token stored as a GitHub Actions secret (`STAGING_API_TOKEN`). This lets you test the authenticated upload path:

```bash
# 6. Authenticated flow with staging token (NEW)
curl -sf https://staging-api.kindlm.com/v1/projects \
  -H "Authorization: Bearer $STAGING_API_TOKEN" | jq .projects

# 7. Create + cleanup test project (NEW)
PROJECT_ID=$(curl -sf -X POST https://staging-api.kindlm.com/v1/projects \
  -H "Authorization: Bearer $STAGING_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"smoke-test-'$GITHUB_SHA'"}' | jq -r .id)

curl -sf -X DELETE "https://staging-api.kindlm.com/v1/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $STAGING_API_TOKEN"
```

### Build Order for Production Deploy

The dependency graph determines deploy order. This is the correct sequence:

```
1. npm ci                               # Install all workspace deps
2. turbo run build                       # Builds core -> cli -> cloud (topological)
   core: tsup bundles to dist/
   cli: tsup bundles to dist/ (depends on core)
   cloud: tsc --noEmit only (Wrangler does its own bundling)
   dashboard: next build + next export to out/
   site: next build to out/
3. Deploy cloud (wrangler deploy)        # FIRST - API must be up before dashboard
4. Deploy dashboard (wrangler pages)     # SECOND - depends on API being live
5. Deploy site (wrangler pages)          # THIRD - independent, marketing only
6. Publish npm packages (changesets)     # LAST - only on version bump
```

**Critical insight:** The dashboard deploy workflow currently deploys independently when `packages/dashboard/**` changes. This is wrong for v1.0 launch day. If the API deploys first and the dashboard references a new API field that doesn't exist in the old dashboard build, users see errors. Solution: add a `deploy-all.yml` workflow for release tags that deploys in the correct order:

```yaml
# .github/workflows/deploy-release.yml (recommended)
name: Deploy Release
on:
  push:
    tags: ["v*"]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx turbo run build

  deploy-cloud:
    needs: build
    # ... wrangler deploy for Workers

  deploy-dashboard:
    needs: deploy-cloud
    # ... wrangler pages deploy for dashboard

  deploy-site:
    needs: build
    # ... wrangler pages deploy for marketing site
```

---

## 2. Cloud API Health Monitoring for Small Teams

### The Solo Developer Monitoring Stack

For a Cloudflare Workers product with zero SRE headcount, here is what actually works:

#### Tier 1: Free, built-in (use immediately)

**Cloudflare Analytics (Workers tab)**
- Request count, error rate, CPU time, duration percentiles
- Available in the Cloudflare dashboard for the `kindlm-api` Worker
- No setup required. Check daily during launch week.

**Cloudflare Workers Logs**
- `wrangler tail --format json` streams live logs
- The `/health` endpoint already exists and checks D1 reachability
- Add `console.error()` breadcrumbs in the global error handler (already done in `index.ts:28-31`)

**D1 Analytics (Cloudflare dashboard)**
- Query count, rows read, rows written, database size
- Available per-database. Monitor `kindlm-prod` weekly.

#### Tier 2: Cheap external monitors (add before v1.0 launch)

**UptimeRobot (free tier: 50 monitors, 5-min intervals)**
- Monitor: `GET https://api.kindlm.com/health` every 5 minutes
- Alert: Email + Slack webhook on failure
- Add keyword check for `"status":"ok"` in response body
- This covers: Worker crashes, D1 unreachable, Cloudflare outages

**Why not Betterstack/Grafana Cloud/Checkly:** Overkill for a solo dev pre-revenue. UptimeRobot's free tier is sufficient until you have paying team-tier customers. Upgrade when monthly recurring revenue exceeds $500.

#### Tier 3: Error tracking (add in first week post-launch)

**Sentry for Cloudflare Workers**
- Official `@sentry/cloudflare` package supports Workers runtime
- Captures unhandled errors with stack traces, request context, user info
- Free tier: 5K errors/month (more than enough pre-scale)

Integration point in `packages/cloud/src/index.ts`:

```typescript
import * as Sentry from "@sentry/cloudflare";

export default Sentry.withSentry(
  (env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  }),
  {
    fetch: app.fetch,
    scheduled: handleScheduled,
  },
);
```

Set `SENTRY_DSN` via `wrangler secret put SENTRY_DSN`.

#### What NOT to build

- Custom metrics dashboard: Cloudflare's built-in analytics are sufficient for v1
- Custom log aggregation: `wrangler tail` + Sentry covers it
- Custom alerting: UptimeRobot handles this
- APM/tracing: Not needed until you have performance complaints from users

### Health Endpoint Enhancement

The current `/health` endpoint is good but should include a version identifier for debugging:

```typescript
app.get("/health", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({
      status: "ok",
      version: "1.0.0",  // or read from package.json at build time
      environment: c.env.ENVIRONMENT,
    });
  } catch {
    return c.json({ status: "degraded", error: "Database unreachable" }, 503);
  }
});
```

### Scheduled Health Self-Check

The existing cron trigger (`0 2 * * *`) runs retention cleanup. Add a lightweight self-check:

```typescript
async function handleScheduled(event, env, ctx) {
  // ... existing retention cleanup ...

  // Self-check: verify D1 is responsive
  try {
    const start = Date.now();
    await env.DB.prepare("SELECT COUNT(*) as c FROM orgs").first();
    const latencyMs = Date.now() - start;
    if (latencyMs > 5000) {
      console.error(`D1 slow query: ${latencyMs}ms`);
    }
  } catch (error) {
    console.error("D1 health check failed in scheduled handler:", error);
  }
}
```

---

## 3. Database Migration Strategy for Cloudflare D1 in Production

### Current State

- `packages/cloud/src/db/schema.sql` is a single monolithic file (337 lines, 16 tables)
- `packages/cloud/src/db/migrations/` exists but contains only `.gitkeep`
- Deploy workflow references `wrangler d1 migrations apply` but there are no migration files
- `wrangler.toml` references `kindlm-prod` (7fcb217f...) and `kindlm-staging` (8f1a40fe...)

### The D1 Migration Problem

D1 uses Wrangler's built-in migration system:

```bash
# Create a migration
npx wrangler d1 migrations create kindlm-prod "add_user_preferences"
# Creates: migrations/0001_add_user_preferences.sql

# Apply migrations (remote)
npx wrangler d1 migrations apply kindlm-prod --remote

# List applied migrations
npx wrangler d1 migrations list kindlm-prod --remote
```

Wrangler tracks applied migrations in a `d1_migrations` table automatically. Each migration runs exactly once.

### Recommended Migration Strategy

#### Initial Bootstrap (for v1.0 launch)

Since the database is either empty or has been manually created with `schema.sql`, the first step is to create a baseline migration:

```
packages/cloud/
  migrations/
    0001_initial_schema.sql    # Full CREATE TABLE IF NOT EXISTS from schema.sql
  wrangler.toml                # Already configured with d1_databases binding
```

The `CREATE TABLE IF NOT EXISTS` pattern is safe for bootstrapping: it works whether tables exist or not.

```bash
# Bootstrap production
cd packages/cloud
npx wrangler d1 migrations apply kindlm-prod --remote

# Bootstrap staging
npx wrangler d1 migrations apply kindlm-staging --env staging --remote
```

#### Ongoing Migrations (post-launch)

Every schema change gets a numbered migration file:

```
migrations/
  0001_initial_schema.sql          # Baseline (all tables)
  0002_add_user_preferences.sql    # ALTER TABLE users ADD COLUMN preferences TEXT
  0003_add_run_tags.sql            # ALTER TABLE runs ADD COLUMN tags TEXT
```

**D1 migration rules:**

1. **Never modify an applied migration.** Once deployed, it is immutable.
2. **Always use IF NOT EXISTS / IF EXISTS.** D1 doesn't support transactional DDL; if a migration partially fails, you need idempotent statements.
3. **No DROP COLUMN.** SQLite (which D1 is built on) added `ALTER TABLE DROP COLUMN` in 3.35.0, but D1 support is not guaranteed. Use column-ignore patterns instead.
4. **Test migrations on staging first.** The deploy-cloud.yml workflow already applies migrations to staging before production.
5. **One concern per migration.** Don't mix table creation with index creation with data backfill.

#### Data Migrations

For data transforms (not schema changes), use a separate migration that reads+writes:

```sql
-- 0004_backfill_run_tags.sql
UPDATE runs SET tags = '[]' WHERE tags IS NULL;
```

**Warning about D1 limits:**
- Max 1M rows per query result
- 128MB database size on Workers Paid plan (not Hobby)
- Batch writes limited to 10K rows per transaction
- For large backfills, use multiple statements with LIMIT

#### Migration Testing

The CONCERNS.md notes that migration tests are missing. The minimum viable approach:

```typescript
// packages/cloud/src/db/migrations.test.ts
import { readFileSync, readdirSync } from "fs";

test("migration files are sequential", () => {
  const dir = "migrations";
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  files.forEach((file, i) => {
    const num = parseInt(file.split("_")[0], 10);
    expect(num).toBe(i + 1);
  });
});

test("migration SQL is syntactically valid", () => {
  // Use better-sqlite3 or sql.js to execute migrations against in-memory DB
  const files = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();
  // Execute each in order against a fresh in-memory SQLite
});
```

#### Rollback Strategy

D1 has no built-in rollback. Options:

1. **Forward-only migrations** (recommended): If a migration breaks something, write a new migration to fix it. This is the standard approach for SQLite-based systems.

2. **Backup before deploy**: `wrangler d1 export kindlm-prod --remote > backup.sql` before applying migrations. Not automated in the current workflow but should be added:

```yaml
# In deploy-cloud.yml, before migration step:
- name: Backup D1 (production)
  run: npx wrangler d1 export kindlm-prod --remote --output=backup-${{ github.sha }}.sql
  working-directory: packages/cloud
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

3. **Time Travel**: D1 supports point-in-time recovery (Workers Paid plan). Cloudflare retains 30 days of bookmarks. Restore via dashboard or API if a migration corrupts data.

---

## 4. Static Site + SPA Routing on Cloudflare Pages

### Current Setup

**Dashboard** (`packages/dashboard/`):
- Next.js 15 with `output: "export"` (static HTML/CSS/JS)
- Deploy target: CF Pages project `kindlm-dashboard` at `cloud.kindlm.com`
- Build output: `packages/dashboard/out/`

**Marketing site** (`site/`):
- Next.js 14 (separate, not in monorepo workspaces)
- Deploy target: CF Pages project `kindlm-site` at `kindlm.com`
- Build output: `site/out/`

### The SPA Routing Problem

Static export generates individual HTML files:
```
out/
  index.html              # /
  login.html              # /login
  login/callback.html     # /login/callback
  projects.html           # /projects
  projects/
    [projectId].html      # PROBLEM: dynamic routes don't work
  settings.html
  settings/members.html
  ...
```

The dashboard uses dynamic routes like `/projects/[projectId]/runs/[runId]`. With static export, Next.js generates placeholder pages but **client-side routing must handle the dynamic segments**. If a user navigates directly to `cloud.kindlm.com/projects/abc123/runs/xyz789`, CF Pages returns 404 because no `projects/abc123/runs/xyz789.html` exists.

### Solution: CF Pages `_redirects` File

Cloudflare Pages supports a `_redirects` file for SPA fallback routing:

```
# packages/dashboard/public/_redirects
/projects/*  /projects/[projectId].html  200
/settings/*  /settings.html  200
/billing/*   /billing.html  200

# Catch-all for any unmatched routes -> SPA entry point
/*  /index.html  200
```

However, the `200` rewrite syntax in CF Pages `_redirects` has a limit of **100 rules** (free plan) or **2000 rules** (paid). For the dashboard, a single catch-all at the bottom is sufficient since Next.js handles client-side routing.

**Simpler approach -- single catch-all `_redirects`:**

```
# packages/dashboard/public/_redirects
/*  /index.html  200
```

This sends every 404 to `index.html`, where Next.js client-side router takes over. The AuthGuard component (`components/AuthGuard.tsx`) already handles unauthenticated access by redirecting to `/login`.

**Caveat:** This means API routes or static assets that genuinely don't exist will also return `index.html` instead of 404. Since the dashboard only calls `api.kindlm.com` (different domain), this is acceptable.

### Alternative: `_headers` and `_routes.json`

CF Pages also supports `_routes.json` for more granular control:

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/assets/*", "/_next/*"]
}
```

For the dashboard, this is unnecessary because static assets are served from `/_next/static/` which CF Pages handles automatically before the catch-all fires.

### Marketing Site Routing

The marketing site (`site/`) has simpler routing:
- `/` (landing page)
- `/docs` (docs index)
- `/docs/[slug]` (individual doc pages)
- `/not-found` (custom 404)

For the site, generate all doc pages at build time (static params) and use a simple `_redirects`:

```
# site/public/_redirects
/docs/*  /docs/[slug].html  200
```

Or if doc slugs are known at build time (they should be, from frontmatter files), Next.js static export generates them as real HTML files and no redirect rules are needed.

### Implementation Checklist

1. Create `packages/dashboard/public/_redirects` with `/*  /index.html  200`
2. Verify `next.config.mjs` has `trailingSlash: false` (default) -- CF Pages expects exact filenames
3. Test locally: `cd packages/dashboard && npm run build && npx wrangler pages dev out`
4. Deploy: `npx wrangler pages deploy out --project-name=kindlm-dashboard`
5. Set custom domain: `cloud.kindlm.com` -> Pages project in CF dashboard

---

## 5. OAuth Flow Testing and Debugging in Production

### Architecture of the OAuth Flow

The KindLM OAuth flow has three parties:

```
Browser (cloud.kindlm.com)  <-->  API (api.kindlm.com)  <-->  GitHub (github.com)
```

There are two distinct flows:

**Flow A: Dashboard login** (browser-based, involves redirect_uri)
1. Dashboard redirects to `api.kindlm.com/auth/github?redirect_uri=...`
2. API redirects to GitHub OAuth
3. GitHub calls back to API with code
4. API creates auth_code (30s TTL, encrypted), redirects to dashboard
5. Dashboard POSTs to `/auth/exchange` with auth_code
6. Dashboard receives plaintext token, stores in cookie

**Flow B: CLI login** (no redirect_uri)
1. CLI opens browser to `api.kindlm.com/auth/github` (no redirect_uri)
2. Same GitHub OAuth flow
3. API renders HTML page with plaintext token
4. User copies token, pastes into terminal

### Common OAuth Failures and How to Debug Them

#### Problem 1: "Invalid state -- possible CSRF attack"

**Cause:** The HMAC-signed state parameter doesn't verify. This happens when:
- `GITHUB_CLIENT_SECRET` is different between the redirect and callback (e.g., secret was rotated mid-flow)
- State was URL-encoded differently by GitHub's redirect
- Browser modified the state parameter (extensions, corporate proxies)

**Debug approach:**
```bash
# 1. Check that the secret is set
npx wrangler secret list

# 2. Manually test the redirect URL to see what state looks like
curl -v "https://api.kindlm.com/auth/github" 2>&1 | grep Location

# 3. Check if GitHub is returning the state unchanged
# (Copy the state from the Location header, compare with callback URL)
```

**Fix:** Log the state verification failure reason (currently returns generic error). Add:
```typescript
if (!valid) {
  console.error("State verification failed", {
    stateValueLength: stateValue.length,
    stateSigLength: stateSig.length,
    // Never log the actual values
  });
  return c.json({ error: "Invalid state" }, 400);
}
```

#### Problem 2: "GitHub OAuth error: redirect_uri_mismatch"

**Cause:** The callback URL doesn't match the one registered in the GitHub OAuth App settings.

**Debug:**
1. Go to GitHub > Settings > Developer Settings > OAuth Apps > KindLM
2. Check "Authorization callback URL" matches exactly: `https://api.kindlm.com/auth/github/callback`
3. The current code builds the callback URL dynamically: `new URL("/auth/github/callback", c.req.url)`. If `c.req.url` uses `http://` (Worker behind proxy), the generated URL won't match.

**Fix:** Hardcode the callback URL based on environment:
```typescript
const callbackUrl = c.env.ENVIRONMENT === "production"
  ? "https://api.kindlm.com/auth/github/callback"
  : "https://staging-api.kindlm.com/auth/github/callback";
```

#### Problem 3: Token exchange returns "Invalid or expired code"

**Cause:** The 30-second auth_code TTL expired, or the code was already consumed (atomic DELETE in exchange endpoint).

**Debug:**
```bash
# Check if codes exist in D1
npx wrangler d1 execute kindlm-prod --remote \
  --command="SELECT code, expires_at FROM auth_codes ORDER BY created_at DESC LIMIT 5"
```

**Common scenario:** Dashboard is slow to load the callback page (network, JS bundle parse time). By the time the POST to `/auth/exchange` fires, 30 seconds have passed.

**Fix:** Increase `AUTH_CODE_TTL_SECONDS` from 30 to 120 for production. The security tradeoff is minimal since the code is single-use (atomic DELETE).

#### Problem 4: Dashboard CORS error on `/auth/exchange`

**Cause:** The exchange endpoint is under `/auth/*` which has rate limiting but no explicit CORS. The global CORS middleware uses `*` pattern but the origins list must include the dashboard URL.

**Current code** (correct):
```typescript
const origins = ["https://cloud.kindlm.com", "https://kindlm.com"];
if (c.env.ENVIRONMENT !== "production") {
  origins.push("http://localhost:3000", "http://localhost:3001");
}
```

**Debug:**
```bash
# Test CORS preflight
curl -v -X OPTIONS "https://api.kindlm.com/auth/exchange" \
  -H "Origin: https://cloud.kindlm.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" 2>&1 | grep -i "access-control"
```

### Production OAuth Testing Checklist

Before declaring OAuth "working in production":

```bash
# 1. Verify GitHub OAuth App settings
# - Client ID matches GITHUB_CLIENT_ID secret
# - Callback URL: https://api.kindlm.com/auth/github/callback
# - Homepage URL: https://kindlm.com

# 2. Verify Worker secrets are set
npx wrangler secret list
# Should show: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SIGNING_KEY_SECRET

# 3. Test OAuth redirect (no auth needed)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}" \
  "https://api.kindlm.com/auth/github?redirect_uri=https://cloud.kindlm.com/login/callback"
# Expected: 302 https://github.com/login/oauth/authorize?...

# 4. Manually complete OAuth in browser
# - Open: https://api.kindlm.com/auth/github?redirect_uri=https://cloud.kindlm.com/login/callback
# - Authorize the app on GitHub
# - Should redirect to cloud.kindlm.com/login/callback?code=xxx
# - Dashboard should exchange code and land on /projects

# 5. Test CLI flow
# - Open: https://api.kindlm.com/auth/github (no redirect_uri)
# - Authorize the app on GitHub
# - Should show HTML page with klm_xxx token

# 6. Verify token works
TOKEN=klm_xxx  # from step 4 or 5
curl -sf "https://api.kindlm.com/v1/projects" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### OAuth Debug Mode for Development

When developing locally, use two terminals:

```bash
# Terminal 1: Run the API locally
cd packages/cloud
npx wrangler dev --local

# Terminal 2: Run the dashboard locally
cd packages/dashboard
NEXT_PUBLIC_API_URL=http://localhost:8787 npm run dev
```

For local OAuth, create a **separate** GitHub OAuth App with callback URL `http://localhost:8787/auth/github/callback`. Set the local secrets:

```bash
# Create .dev.vars in packages/cloud/
echo 'GITHUB_CLIENT_ID=your_local_app_client_id' > packages/cloud/.dev.vars
echo 'GITHUB_CLIENT_SECRET=your_local_app_client_secret' >> packages/cloud/.dev.vars
echo 'SIGNING_KEY_SECRET=local-dev-signing-key-32chars!' >> packages/cloud/.dev.vars
echo 'ENVIRONMENT=development' >> packages/cloud/.dev.vars
```

**Important:** `.dev.vars` is already in `.gitignore` (standard Wrangler pattern). Verify this.

---

## 6. Component Boundaries & Data Flow Summary

### Package Dependency Graph

```
                   @kindlm/core (npm: business logic)
                     /         \
                    v           v (types only)
         @kindlm/cli          @kindlm/cloud
         (npm: CLI)            (CF Workers: API)
                                    |
                                    v (HTTP: api.kindlm.com)
                             @kindlm/dashboard
                             (CF Pages: SPA)
                                    |
                                    v (links to)
                              kindlm-site
                              (CF Pages: marketing)
```

### Cloudflare Resource Map

| Resource | Type | Name | ID |
|----------|------|------|----|
| API (prod) | Worker | `kindlm-api` | -- |
| API (staging) | Worker | `kindlm-api-staging` | -- |
| DB (prod) | D1 | `kindlm-prod` | `7fcb217f-d830-4199-955b-a6341bc79fff` |
| DB (staging) | D1 | `kindlm-staging` | `8f1a40fe-1d79-400c-91c5-5b28fb60638d` |
| Dashboard | Pages | `kindlm-dashboard` | -- (to be created) |
| Marketing | Pages | `kindlm-site` | -- (to be created) |

### Secrets Required

```bash
# Worker secrets (production)
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SIGNING_KEY_SECRET
# wrangler secret put STRIPE_SECRET_KEY        # Phase 3
# wrangler secret put STRIPE_WEBHOOK_SECRET    # Phase 3
# wrangler secret put SENTRY_DSN               # Post-launch

# Worker secrets (staging)
wrangler secret put GITHUB_CLIENT_ID --env staging
wrangler secret put GITHUB_CLIENT_SECRET --env staging
wrangler secret put SIGNING_KEY_SECRET --env staging

# GitHub Actions secrets
# CF_API_TOKEN         - Cloudflare API token with Workers + Pages + D1 permissions
# STAGING_API_TOKEN    - Pre-provisioned klm_xxx token for staging smoke tests
```

### DNS Records Needed

```
api.kindlm.com     -> Worker route (already in wrangler.toml)
cloud.kindlm.com   -> CF Pages custom domain (dashboard)
kindlm.com         -> CF Pages custom domain (marketing site)
www.kindlm.com     -> CNAME to kindlm.com (redirect)
```

---

## 7. Production Launch Build Order (Step by Step)

This is the exact sequence for going from current state (broken API, nothing deployed) to v1.0 production:

### Phase A: Infrastructure Setup (one-time)

```bash
# 1. Create CF Pages projects
npx wrangler pages project create kindlm-dashboard
npx wrangler pages project create kindlm-site

# 2. Set Worker secrets (production)
cd packages/cloud
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SIGNING_KEY_SECRET

# 3. Set Worker secrets (staging)
npx wrangler secret put GITHUB_CLIENT_ID --env staging
npx wrangler secret put GITHUB_CLIENT_SECRET --env staging
npx wrangler secret put SIGNING_KEY_SECRET --env staging

# 4. Create baseline migration file
cp packages/cloud/src/db/schema.sql packages/cloud/migrations/0001_initial_schema.sql

# 5. Apply migrations to staging
npx wrangler d1 migrations apply kindlm-staging --env staging --remote

# 6. Apply migrations to production
npx wrangler d1 migrations apply kindlm-prod --remote
```

### Phase B: Deploy & Verify API

```bash
# 7. Deploy API to staging
npx wrangler deploy --env staging

# 8. Verify staging
curl -sf https://staging-api.kindlm.com/health
curl -s -o /dev/null -w "%{http_code}" https://staging-api.kindlm.com/v1/projects
# Expected: 401

# 9. Deploy API to production
npx wrangler deploy

# 10. Verify production
curl -sf https://api.kindlm.com/health
```

### Phase C: Deploy Dashboard

```bash
# 11. Add SPA routing fallback
echo '/*  /index.html  200' > packages/dashboard/public/_redirects

# 12. Build dashboard
cd packages/dashboard
NEXT_PUBLIC_API_URL=https://api.kindlm.com npm run build

# 13. Deploy to CF Pages
npx wrangler pages deploy out --project-name=kindlm-dashboard

# 14. Set custom domain in CF dashboard
# cloud.kindlm.com -> kindlm-dashboard Pages project
```

### Phase D: Deploy Marketing Site

```bash
# 15. Build marketing site
cd site
npm run build

# 16. Deploy to CF Pages
npx wrangler pages deploy out --project-name=kindlm-site

# 17. Set custom domain in CF dashboard
# kindlm.com -> kindlm-site Pages project
```

### Phase E: OAuth Verification

```bash
# 18. Test OAuth flow end-to-end (manual, in browser)
# Open: https://api.kindlm.com/auth/github?redirect_uri=https://cloud.kindlm.com/login/callback
# Complete GitHub auth
# Verify landing on cloud.kindlm.com/projects with valid session

# 19. Test CLI login flow (manual)
# Open: https://api.kindlm.com/auth/github
# Copy token, run: kindlm login --token klm_xxx

# 20. Test full upload flow
kindlm test          # Run local tests
kindlm upload        # Upload to cloud
# Verify results visible in dashboard
```

### Phase F: Monitoring Setup

```bash
# 21. Set up UptimeRobot
# Monitor: GET https://api.kindlm.com/health (5-min interval)
# Alert: Email to thepetr@gmail.com

# 22. Set up Sentry (optional, recommended)
# Create project at sentry.io for Cloudflare Workers
npx wrangler secret put SENTRY_DSN
```

---

## 8. Known Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| D1 migration fails mid-apply | Low | High (broken schema) | Use IF NOT EXISTS everywhere; backup before deploy |
| OAuth state mismatch after deploy | Medium | Medium (login fails) | Test OAuth immediately after each API deploy |
| Dashboard 404 on deep links | High (certain without fix) | High (broken UX) | Add `_redirects` file before first deploy |
| CORS blocked on new domain | Medium | High (dashboard broken) | Verify origins list in cloud `index.ts` includes production domains |
| GitHub OAuth App callback URL mismatch | Medium | High (all logins fail) | Document exact callback URL; test before launch |
| Auth code 30s TTL too short | Medium | Medium (slow networks fail) | Increase to 120s |
| Staging API token leaked in CI logs | Low | Medium | Use GitHub Actions secrets, never echo token |
| D1 5GB limit hit | Low (months away) | High | Monitor via CF dashboard; implement data retention (already has daily cron) |

---

## 9. Open Questions for Implementation

1. **GitHub OAuth App:** Is there already a registered OAuth App, or does one need to be created? Need the Client ID and Client Secret.

2. **CF Pages projects:** Have `kindlm-dashboard` and `kindlm-site` been created yet, or is this first deploy?

3. **DNS:** Is `kindlm.com` already managed in Cloudflare? The Worker route in `wrangler.toml` references `zone_name: kindlm.com`, implying it is.

4. **Staging subdomain:** `deploy-cloud.yml` references `staging-api.kindlm.com` but there's no staging route in `wrangler.toml`. Need to add a Worker route or use the `*.workers.dev` URL instead.

5. **Marketing site structure:** The `site/` directory is not in the npm workspaces array (`packages/*`). Is this intentional? The deploy workflow uses `cd site && npm ci` (separate install), which is correct for isolation but means it can't share dependencies with the monorepo.
