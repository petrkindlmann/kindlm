# KindLM v1.0 Launch Pitfalls

Research date: 2026-03-27
Scope: CLI npm publish, Cloudflare Workers/D1 production, GitHub OAuth, Next.js static export on CF Pages, Stripe billing, open-source launch strategy.

---

## 1. CLI Tools Published to npm

### 1.1 Broken `npx` First Run

**What goes wrong:** The `npx @kindlm/cli init` experience fails on first contact. Common causes: missing shebang line in bin entry, incorrect `files` field omitting dist/, ESM/CJS resolution conflicts, or missing `#!/usr/bin/env node` in the built output.

**Warning signs in KindLM:**
- `bin` points to `./dist/kindlm.js` -- must verify tsup outputs this file with executable permissions and shebang
- `@kindlm/core` dependency uses `"*"` workspace protocol -- npm publish resolves this to the current version at publish time, but if core is not published first, CLI install fails
- No `engines` field in package.json to warn users on unsupported Node versions

**Prevention:**
- Add a CI step that runs `npm pack && npx ./kindlm-cli-*.tgz init` in a clean directory to verify the publish artifact works
- Pin `engines.node` to `>=20` (you use ESM features that break on 18)
- Add `publishConfig.access: "public"` for scoped packages
- Verify publish order: core must publish before cli (changesets handles this, but verify)
- Test on Windows -- path separators, shell differences, and `chalk` terminal detection all behave differently

**Phase:** Pre-v1.0 (ship blocker)

### 1.2 Version Lock Between Core and CLI

**What goes wrong:** User has `@kindlm/core@0.2.1` cached in node_modules but installs `@kindlm/cli@1.0.0` which expects core@1.0.0. The workspace `"*"` resolves at publish time but if versions drift, users get cryptic runtime errors.

**Warning signs in KindLM:**
- Core is at 0.2.1, CLI at 0.4.1 -- these need to be synchronized for v1.0.0

**Prevention:**
- Use changesets with fixed versioning group so core+cli always bump together
- Add a runtime version check: CLI logs warning if core version does not match expected range
- Publish both packages atomically in a single CI release job

**Phase:** Pre-v1.0 (ship blocker)

### 1.3 Config File Discovery Failures

**What goes wrong:** `kindlm test` cannot find `kindlm.yaml` because it resolves relative to CWD, but users run from subdirectories, monorepo roots, or CI runners with unexpected working directories.

**Warning signs in KindLM:**
- Config parser likely walks up from CWD -- verify behavior when kindlm.yaml is in parent directory
- `system_prompt_file: ./prompts/refund.md` -- relative file resolution is fragile in monorepos

**Prevention:**
- Implement upward directory walk (like `.git` discovery) with clear error: "No kindlm.yaml found in /path or any parent directory"
- Resolve relative paths in config against the config file location, not CWD
- Log the resolved config path when `--verbose` is passed

**Phase:** Pre-v1.0

### 1.4 Exit Code Contract Violations

**What goes wrong:** CI pipelines depend on exit code 0/1 semantics. Common mistakes: swallowing errors that should exit 1, throwing unhandled rejections (exit code varies by Node version), or printing errors to stdout instead of stderr.

**Warning signs in KindLM:**
- Need to verify that provider connection failures, config errors, and partial test failures all produce the correct exit code
- Unhandled promise rejections in the test runner could crash with exit code 1 for the wrong reason (no useful error message)

**Prevention:**
- Integration test that asserts exact exit codes for: all pass (0), some fail (1), config error (1), provider unreachable (1)
- Global unhandled rejection handler that logs the error and exits 1 cleanly
- All errors to stderr, all test output to stdout (so `kindlm test | jq` works with JSON reporter)

**Phase:** Pre-v1.0 (ship blocker)

### 1.5 Peer Dependency and Bundling Conflicts

**What goes wrong:** `ajv`, `zod`, and `yaml` ship in core's dependencies. If a user's project also depends on different versions of these, npm hoisting can cause version conflicts. Especially problematic with Zod (v3 vs v4 transition happening now).

**Warning signs in KindLM:**
- `ajv@^8.17.0` -- major version locked, should be fine
- `zod@^3.24.0` -- Zod v4 released 2025-06; if users have Zod v4, the `^3.24.0` range is fine (won't resolve to v4)
- `pdfkit@^0.15.0` in CLI dependencies -- this is a large dependency that inflates install size for users who never use PDF export

**Prevention:**
- Make `pdfkit` an optional/peer dependency or lazy-import it only when `--compliance --pdf` is passed
- Run `npm pack --dry-run` and check the tarball size -- CLI packages over 5MB get complaints
- Add `bundleDependencies` or bundle via tsup to avoid version conflicts for core utils

**Phase:** v1.0 optimization

---

## 2. Cloudflare Workers in Production

### 2.1 D1 Is Not Postgres

**What goes wrong:** D1 is SQLite under the hood. Developers write queries expecting Postgres semantics and hit silent data corruption or unexpected behavior:
- No `RETURNING *` support in older D1 versions (KindLM uses `RETURNING token` in auth_codes -- verify this works)
- No `ALTER TABLE ADD COLUMN ... DEFAULT` with expressions (only literal defaults)
- No concurrent write transactions -- D1 serializes writes per database
- `datetime('now')` returns UTC text, not a timestamp type -- comparison operators work on string ordering
- Maximum 1MB response size per query result

**Warning signs in KindLM:**
- `queries.ts` at 1529 LOC with 50+ raw SQL queries -- any one could silently misbehave
- Rate limit table uses D1 for what is fundamentally a cache/counter workload -- high write frequency on a serialized-write database
- `DELETE FROM auth_codes WHERE code = ? AND expires_at > datetime('now') RETURNING token` -- this atomic delete-and-return pattern must be verified on D1 specifically
- No query timeout handling -- D1 queries that take >30s will kill the Worker

**Prevention:**
- Test every query in `queries.ts` against a real D1 database (not just SQLite mocks)
- Add explicit `LIMIT` clauses to all list queries to prevent 1MB response overflow
- Consider moving rate limiting to Workers KV or in-memory (rate_limits table will be a write hotspot)
- Add a migration testing script that applies all 10 migrations to a fresh D1 database and verifies schema

**Phase:** Pre-v1.0 (ship blocker for rate limiting, P1 for others)

### 2.2 Worker Memory and CPU Limits

**What goes wrong:** Cloudflare Workers have hard limits: 128MB memory, 30s CPU time (paid plan), 10ms CPU time (free plan). The webhook handler parses large JSON bodies. The billing webhook does crypto operations. Baseline comparison loads full result sets.

**Warning signs in KindLM:**
- Stripe webhook handler imports raw body as string, then JSON-parses it -- doubling memory for large payloads
- HMAC signature verification uses `crypto.subtle` which is async but still consumes CPU
- `getRunsByOrgId()` could return hundreds of runs with full compliance reports (TEXT column) -- each compliance report could be 50KB+

**Prevention:**
- Add `LIMIT 100` default to all list endpoints, implement cursor pagination
- Strip large TEXT columns (compliance_report, raw_response) from list queries -- only load on detail endpoints
- Set `wrangler.toml` `usage_model = "bundled"` for the paid plan to get 50ms CPU time
- Monitor Worker CPU time in Cloudflare dashboard after launch

**Phase:** Pre-v1.0 (pagination), v1.1 (monitoring)

### 2.3 D1 Cold Start and Availability

**What goes wrong:** D1 databases occasionally return 500 errors during cold starts or during Cloudflare infrastructure updates. The error is not a standard SQL error -- it's a binding failure. If your error handling assumes all errors are SQL errors, the user gets an unhelpful message.

**Warning signs in KindLM:**
- Rate limit middleware catches errors and returns 503 (good), but other routes may not handle D1 connection failures gracefully
- No health check endpoint -- impossible to distinguish "API is down" from "D1 is cold"

**Prevention:**
- Add `/health` endpoint that does a trivial D1 query (`SELECT 1`) and returns status
- Wrap all D1 calls in a try/catch that returns a structured error, not a raw 500
- Add retry logic for D1 binding failures (exponential backoff, max 2 retries)
- Consider Cloudflare's "D1 read replication" (if available) for read-heavy endpoints

**Phase:** Pre-v1.0 (health check), v1.1 (retry logic)

### 2.4 Wrangler Secrets and Environment Drift

**What goes wrong:** Secrets set via `wrangler secret put` are per-environment. Easy to forget setting a secret in staging vs production. The code runs but the secret is `undefined`, and the error is a runtime crash, not a deployment failure.

**Warning signs in KindLM:**
- wrangler.toml comments list 4 secrets (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
- `billing.ts` handles missing STRIPE_SECRET_KEY gracefully (returns 501) -- good pattern
- `oauth.ts` does NOT check if GITHUB_CLIENT_ID is set before redirecting -- will crash with undefined in URL

**Prevention:**
- Add startup validation: check all required secrets at Worker initialization, fail fast with clear error
- Create a deployment checklist script: `wrangler secret list` and verify all expected secrets exist
- Use `wrangler.toml` `[vars]` for non-secret config to make it visible in version control

**Phase:** Pre-v1.0 (ship blocker)

### 2.5 Cron Trigger Reliability

**What goes wrong:** The `0 2 * * *` cron for retention cleanup runs as a Worker invocation. If it fails, there is no built-in retry. Stale data accumulates silently. If the cleanup query is expensive, it may timeout.

**Warning signs in KindLM:**
- No visible cron handler code in the files reviewed -- need to verify the `scheduled` event handler exists
- Retention cleanup may need to paginate deletes (deleting 10K rows in one D1 query could timeout)

**Prevention:**
- Implement the `scheduled` event handler with chunked deletes (delete 500 rows per iteration)
- Log cron execution results to an audit table or external service
- Add an admin endpoint to manually trigger cleanup for debugging

**Phase:** v1.0

---

## 3. GitHub OAuth in Production

### 3.1 OAuth App vs GitHub App

**What goes wrong:** GitHub OAuth Apps have different security properties than GitHub Apps. OAuth Apps get broader access by default and cannot be installed per-repository. If KindLM only needs `read:user` and `user:email`, an OAuth App works, but upgrading to a GitHub App later changes the entire auth flow.

**Warning signs in KindLM:**
- Scope is `read:user user:email` -- minimal, good
- OAuth App is fine for v1.0 since KindLM does not need repo access

**Prevention:**
- Document the OAuth App vs GitHub App decision
- If you ever need repo access (e.g., auto-detect kindlm.yaml in repos), plan the migration to GitHub App early

**Phase:** Documented decision, no action needed for v1.0

### 3.2 Callback URL Mismatch

**What goes wrong:** The GitHub OAuth callback URL must exactly match what's registered in GitHub. Common failures:
- HTTP vs HTTPS mismatch
- Trailing slash differences
- Different domain in development vs production
- GitHub caches the callback URL -- changes take effect slowly

**Warning signs in KindLM:**
- `redirectUri` is dynamically constructed from `c.req.url` -- this means the callback URL depends on the incoming request URL
- If Cloudflare proxying changes the `Host` header or protocol, the redirect URI won't match GitHub's registered callback

**Prevention:**
- Hard-code the callback URL for production: `https://api.kindlm.com/auth/github/callback`
- Allow override via environment variable for staging/local development
- Register both production and staging callback URLs in GitHub OAuth settings
- Test the full OAuth flow end-to-end with real GitHub credentials before launch

**Phase:** Pre-v1.0 (ship blocker)

### 3.3 Token Accumulation

**What goes wrong:** Every OAuth login creates a new token (`login-YYYY-MM-DD`). If a user logs in daily, they accumulate 365 tokens per year. There's no cleanup. The tokens table grows unbounded. Token listing becomes slow.

**Warning signs in KindLM:**
- `createToken()` is called on every OAuth callback with name `login-{date}`
- `expires_at` is `null` for login tokens -- they live forever
- No cap on tokens per org

**Prevention:**
- Set a default `expires_at` of 90 days for login-generated tokens
- Delete or revoke previous `login-*` tokens when creating a new one (keep only last 5)
- Add a token cleanup job to the daily cron
- Show token count on the settings/tokens dashboard page

**Phase:** Pre-v1.0 (expiry), v1.1 (cleanup)

### 3.4 CSRF State Parameter Timing

**What goes wrong:** The state parameter is HMAC-signed but not stored server-side. This means there's no way to prevent state replay -- an attacker who captures a valid state can reuse it until the HMAC key changes. The state is also not time-bounded.

**Warning signs in KindLM:**
- State is `nonce|redirect_uri.signature` -- nonce is random but not stored in DB for single-use verification
- No timestamp in the state -- a captured state URL can be replayed indefinitely

**Prevention:**
- Add a timestamp to the state: `{timestamp}|{nonce}|{redirect_uri}.{signature}`
- Reject states older than 10 minutes in the callback handler
- Alternatively, store the nonce in a short-lived D1 row (like auth_codes) for true single-use
- This is defense-in-depth; the HMAC already prevents forgery, so the replay window is the main concern

**Phase:** v1.0 (add timestamp check)

### 3.5 Email Privacy and Missing Emails

**What goes wrong:** Some GitHub users have no public email and have not granted `user:email` scope properly. The fallback to `/user/emails` endpoint can also fail if the user has no verified email. The `email` field ends up null in the database.

**Warning signs in KindLM:**
- Code already handles null email with fallback to `/user/emails` -- good
- But: billing, team invites, and compliance reports may assume email is non-null downstream

**Prevention:**
- Audit all code paths that use `user.email` -- add null checks or require email on first login
- Consider prompting users to add an email in the dashboard if it's missing
- Document that email is optional in the user type definition

**Phase:** v1.0

---

## 4. Next.js Static Export on Cloudflare Pages

### 4.1 Dynamic Routes Don't Work with Static Export (by default)

**What goes wrong:** Next.js `output: "export"` generates static HTML at build time. Dynamic routes like `[projectId]` require `generateStaticParams()` to enumerate all possible paths. Without it, these pages are not generated as individual HTML files.

**Warning signs in KindLM:**
- Dashboard has deeply nested dynamic routes: `projects/[projectId]/runs/[runId]/compare`
- NO `generateStaticParams` found anywhere in the codebase
- The `_redirects` file (`/* /index.html 200`) acts as a catch-all SPA fallback
- This means ALL routes serve `index.html` and rely on client-side routing via Next.js App Router

**Current state:** This actually works for a fully client-rendered SPA because:
- All data fetching happens client-side via `useParams` + `useEffect` + API calls
- The `_redirects` ensures Cloudflare Pages returns 200 (not 404) for all paths
- Next.js App Router handles client-side routing from the single `index.html`

**But the risks are:**
- SEO is impossible for dashboard pages (not a concern for a dashboard, but would matter for marketing pages)
- Initial page load always serves the full app bundle, then client-side routes to the right page
- Deep linking works via `_redirects` but if Cloudflare Pages changes redirect behavior, it breaks
- `output: "export"` with App Router is officially supported but poorly documented for SPA patterns

**Prevention:**
- Verify the static export build produces the expected output: `next build` should create `out/index.html` plus static assets
- Test deep linking: navigate directly to `cloud.kindlm.com/projects/abc/runs/def` -- it must load and route correctly
- Add a build verification step in CI that checks for `_redirects` in the output directory
- Consider hash-based routing (`#/projects/abc`) as a fallback if `_redirects` proves unreliable -- but this is worse UX

**Phase:** Pre-v1.0 (verify build + deep linking work)

### 4.2 API URL Configuration at Build Time

**What goes wrong:** `NEXT_PUBLIC_API_URL` is set at build time via `env` in `next.config.mjs`. If you deploy the same build to staging and production, they'll both point to the same API. This is a common Next.js static export footgun.

**Warning signs in KindLM:**
- `NEXT_PUBLIC_API_URL` defaults to `https://api.kindlm.com` -- hard-coded for production
- No way to override at runtime in a static export

**Prevention:**
- For now, accept separate builds for staging and production (set env var at build time)
- Long term: use a runtime config file (`/config.json`) that the SPA fetches on load, or detect the hostname and switch API URL client-side
- Document the build-time env var requirement in deployment docs

**Phase:** v1.0 (document), v1.1 (runtime config)

### 4.3 Cloudflare Pages Build Failures

**What goes wrong:** Cloudflare Pages has a build step with limited Node.js version support and build timeouts. Next.js static export can fail if:
- Build exceeds 20-minute timeout
- Node.js version mismatch (Pages defaults to older Node)
- Out-of-memory during build (especially with many pages)

**Prevention:**
- Set `NODE_VERSION=20` in CF Pages environment variables
- Build locally and deploy the `out/` directory directly via `wrangler pages deploy ./out` (skip CF Pages build)
- Add the deploy command to CI rather than relying on CF Pages auto-build

**Phase:** Pre-v1.0

### 4.4 Asset Caching and Cache Invalidation

**What goes wrong:** Cloudflare Pages aggressively caches static assets. When you deploy a new version, old JS bundles may be served from edge cache. Next.js handles this with content-hashed filenames, but if your `_redirects` or `index.html` is cached, users get stale app shells.

**Prevention:**
- Verify Next.js static export uses content-hashed JS/CSS filenames (it does by default)
- Set `Cache-Control: no-cache` for `index.html` via Cloudflare Page Rules or `_headers` file
- Add `_headers` file to `public/`:
  ```
  /index.html
    Cache-Control: no-cache, no-store, must-revalidate
  /*.js
    Cache-Control: public, max-age=31536000, immutable
  /*.css
    Cache-Control: public, max-age=31536000, immutable
  ```

**Phase:** Pre-v1.0

---

## 5. Stripe Billing Integration

### 5.1 Webhook Event Ordering and Idempotency

**What goes wrong:** Stripe sends webhook events asynchronously and does not guarantee order. You might receive `customer.subscription.updated` before `checkout.session.completed`. If your code assumes a billing record already exists when processing the update, it fails silently.

**Warning signs in KindLM:**
- `checkout.session.completed` creates the billing record via `upsertBilling`
- `customer.subscription.updated` also uses `upsertBilling` -- if this arrives first and the billing record does not exist, the upsert will create it without the full context from checkout
- `resolveOrgId()` falls back to `metadata.org_id` if no billing record exists -- this is the right pattern but the plan metadata on the subscription update may be missing

**Prevention:**
- Make all webhook handlers fully idempotent -- processing the same event twice must produce the same result
- Use `upsertBilling` (already done -- good) but verify it handles partial data gracefully
- Add the Stripe event ID to an `idempotency_keys`-like table to detect duplicates
- Log all webhook events with their types for debugging (add a webhook_events audit table)
- Test with Stripe CLI: `stripe listen --forward-to localhost:8787/v1/billing/webhook`

**Phase:** Pre-v1.0

### 5.2 Plan Downgrade Race Conditions

**What goes wrong:** User is on Team plan. They downgrade in Stripe. Stripe sends `customer.subscription.updated` with the new plan. But between the webhook firing and KindLM processing it, the user creates 6 projects (Team allows 5, Free allows 1). Now they're on Free with 6 projects.

**Warning signs in KindLM:**
- Plan gates check `auth.org.plan` at request time
- Plan is updated asynchronously via webhook
- No "grace period" logic or data reconciliation on downgrade

**Prevention:**
- On downgrade: don't delete existing data, but prevent new resource creation beyond the new plan limits
- Add a `plan_effective_at` timestamp so you know when the plan actually changed
- Send the user an email/notification when their plan changes
- Add a "soft limit" approach: show warnings but don't break existing workflows immediately

**Phase:** v1.0 (soft limits), v1.1 (notifications)

### 5.3 Stripe Price IDs vs Inline Prices

**What goes wrong:** The checkout session creates prices inline (`price_data`) rather than using pre-created Price IDs from the Stripe dashboard. This means:
- You cannot use Stripe's built-in price management
- Changing the price requires a code deployment
- The Customer Portal may not show the correct plan details
- Stripe revenue reporting may be inconsistent

**Warning signs in KindLM:**
- `line_items[0][price_data][product_data][name]` and `unit_amount` are hard-coded
- Customer Portal session is created but portal must be configured in Stripe dashboard with matching products

**Prevention:**
- Create Products and Prices in Stripe dashboard
- Use Price IDs (`price_xxxxx`) instead of inline `price_data`
- Store Price IDs as environment variables or in a config
- Configure the Customer Portal in Stripe dashboard to allow plan changes and cancellation

**Phase:** Pre-v1.0 (ship blocker -- portal won't work correctly with inline prices)

### 5.4 Missing Webhook Events

**What goes wrong:** The webhook handler only processes 3 events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Missing events that matter:
- `invoice.payment_failed` -- user's card declined, subscription at risk
- `customer.subscription.paused` -- Stripe can pause subscriptions
- `invoice.paid` -- confirmation of renewal

**Prevention:**
- Add handling for `invoice.payment_failed` -- set a `billing_status: "past_due"` flag, show warning in dashboard
- Add handling for `customer.subscription.paused` -- treat as downgrade to free
- Log unhandled event types for monitoring (catch-all at bottom of switch)
- Subscribe to only the events you handle in the Stripe dashboard webhook configuration

**Phase:** v1.0

### 5.5 Test Mode vs Live Mode Confusion

**What goes wrong:** Stripe test mode and live mode use completely separate data. If you configure test mode webhook secrets in production, all live webhooks fail silently. If you test with live keys, you charge real credit cards.

**Prevention:**
- Never store live Stripe keys in wrangler.toml `[vars]` -- always use `wrangler secret put`
- Add a startup log that indicates which Stripe mode is active (check if key starts with `sk_test_` vs `sk_live_`)
- Use separate webhook endpoints for test and live if possible
- Verify webhook secret matches the mode of the Stripe key

**Phase:** Pre-v1.0

---

## 6. Open-Source Project Launch

### 6.1 The README is the Product

**What goes wrong:** Developers evaluate tools in 30 seconds. If the README doesn't answer "what does this do, how do I try it, and why should I care" in the first screenful, they leave. Common mistakes:
- Leading with architecture/philosophy instead of the problem
- No copy-pasteable quick start
- Screenshots of output missing
- No comparison with alternatives

**What worked for promptfoo/Braintrust:**
- promptfoo: README leads with a GIF of terminal output, then `npx promptfoo@latest init`
- Braintrust: Focuses on the eval loop with a code example in the first 10 lines
- Both show output immediately -- developers want to see what they get

**Prevention:**
- README structure: 1) One-sentence pitch, 2) Terminal screenshot/GIF, 3) `npx @kindlm/cli init && kindlm test`, 4) What it checks (assertion types), 5) Why not promptfoo
- Record an `asciinema` or `vhs` terminal recording of the happy path
- Add a `examples/` directory with a working kindlm.yaml + mock responses for zero-API-key trial

**Phase:** Pre-v1.0 (ship blocker)

### 6.2 The Zero-Config Trial Must Work Without API Keys

**What goes wrong:** Your tool requires an OpenAI/Anthropic API key to do anything. Most developers won't enter their API key to evaluate a tool they found 30 seconds ago. The activation energy is too high.

**What competitors do:**
- promptfoo: Supports local model providers (Ollama) and has a `--no-cache` mode for quick iteration
- Braintrust: Offers a hosted eval endpoint that works without user API keys

**Warning signs in KindLM:**
- `kindlm init` creates a config, but `kindlm test` requires a real provider to run
- No mock/dry-run mode

**Prevention:**
- Add `kindlm test --dry-run` that validates config, shows what would run, and exits 0
- Add `kindlm test --mock` that generates fake provider responses for demonstration
- Ship an `examples/` directory with pre-recorded results so users can see output format
- Support Ollama out of the box for users who want to test locally without API keys
- Consider: a free hosted provider endpoint for the first 10 test runs (acquisition tool)

**Phase:** Pre-v1.0 (dry-run), v1.0 (mock mode), v1.1 (hosted trial)

### 6.3 Differentiation from promptfoo

**What goes wrong:** promptfoo is the incumbent. "Why not promptfoo?" is the first question every potential user asks. If you don't have a clear, honest answer, developers assume you're a worse version of the same thing.

**KindLM's actual differentiators:**
1. Tool call assertions (tool_called, tool_not_called, tool_order) -- promptfoo added this but it's not their focus
2. EU AI Act compliance reports -- unique in the market
3. Agent behavior focus (not just text quality) -- promptfoo is LLM-eval-first
4. Paid cloud dashboard -- promptfoo's cloud is also paid, but less mature

**Prevention:**
- Create a `docs/vs-promptfoo.md` comparison page with honest pros/cons
- Lead marketing with "test what your agent DOES, not what it SAYS"
- The compliance angle is unique -- lead with it for EU-market companies
- Don't try to be "promptfoo but better" -- be "the agent testing tool" vs "the LLM eval tool"

**Phase:** Pre-v1.0 (messaging), v1.0 (comparison page)

### 6.4 Launch Venue Matters More Than Product Quality

**What goes wrong:** Building in private for months, then posting on Hacker News with zero social proof. The post gets 3 upvotes and dies. No one sees it. You never recover the launch momentum.

**What worked for successful dev tools:**
- promptfoo: GitHub-first, built community through issues and contributions before any marketing
- Braintrust: Y Combinator launch with built-in audience
- Zod: Purely organic -- one tweet, then word of mouth from TypeScript community

**Prevention:**
- Pre-launch (now): Write 2-3 blog posts about agent testing problems (not about KindLM) to build topical authority
- Launch day: Hacker News Show HN + Twitter/X thread + r/MachineLearning + relevant Discord channels
- Seed the GitHub repo with a few stars (ask friends/network) before the public launch
- Have 3-5 beta users who can comment on the HN post with real usage experience
- Follow up within 48 hours of launch with fast bug fixes -- early adopters are forgiving but only if you're responsive

**Phase:** Pre-v1.0 (blog posts, beta users), launch day (coordinated posts)

### 6.5 Documentation Gaps Kill Adoption

**What goes wrong:** Developer tries the tool, likes it, then hits a wall. "How do I test tool call arguments with nested objects?" No docs. They search GitHub issues. Nothing. They abandon the tool.

**Warning signs in KindLM:**
- CONCERNS.md lists 5 documentation gaps (API spec, provider guide, SAML setup, schema diagram, assertion guide)
- Drift and judge assertions are "underdocumented"

**Prevention:**
- Minimum viable docs for v1.0:
  1. Getting started guide (install, init, first test, CI integration)
  2. Config reference (every YAML field explained)
  3. Assertion types reference (every assertion type with examples)
  4. Provider setup guide (OpenAI, Anthropic, Ollama)
  5. CI integration guide (GitHub Actions, GitLab CI)
- Use the `docs/` directory, not a separate docs site -- keep it in the repo for now
- Add `@example` JSDoc comments to all public types so editor hover shows usage

**Phase:** Pre-v1.0 (getting started + config ref + assertion ref), v1.0 (remaining)

---

## 7. Pitfalls Specific to KindLM's Current State

### 7.1 Cloud API is Broken in Production

**What it is:** PROJECT.md states "Cloud API deployed but currently broken." This means `kindlm upload` fails in production. Even if the CLI is perfect, users who try the cloud feature will have a broken experience.

**Impact:** If the README mentions cloud features and they don't work, you lose trust permanently. First impressions are not recoverable.

**Prevention:**
- Option A: Fix the Cloud API before launch (E2E: OAuth, upload, dashboard view)
- Option B: Remove all cloud references from v1.0 CLI and README, launch CLI-only, add cloud in v1.1
- Option B is safer -- shipping a broken cloud is worse than shipping no cloud

**Phase:** Pre-v1.0 (decision required)

### 7.2 SAML Signature Verification is Incomplete

**What it is:** CONCERNS.md P0 item. SAML assertions are accepted without cryptographic verification. Anyone can forge a SAML assertion.

**Impact:** This is only relevant for Enterprise customers using SSO. There are zero Enterprise customers at launch.

**Prevention:**
- Gate SAML/SSO behind Enterprise plan (already done)
- Do NOT launch SAML as "available" -- mark it as "coming soon" or "beta"
- Implement proper XML signature verification before any Enterprise customer onboards
- This is not a v1.0 ship blocker as long as SAML is not marketed as production-ready

**Phase:** Pre-Enterprise (not a v1.0 blocker if properly gated)

### 7.3 Rate Limiting Uses D1 (Write-Heavy Antipattern)

**What it is:** Every API request writes to the `rate_limits` table in D1. D1 serializes writes per database. Under load, this becomes a bottleneck that slows down all API operations, not just the rate-limited ones.

**Impact:** At 10 requests/second, you're doing 10 D1 writes/second just for rate limiting. D1 handles this fine. At 100 requests/second (modest for a real API), the write serialization could add 100ms+ latency to every request.

**Prevention:**
- Short term: This is fine for launch -- you won't have 100 req/s on day one
- Medium term: Move rate limiting to Cloudflare's built-in rate limiting (Workers Unbound) or in-memory counters with periodic D1 sync
- Long term: Use Cloudflare Durable Objects for per-org rate limiting

**Phase:** v1.1 (won't be a problem at launch scale)

### 7.4 No Observability

**What it is:** No error tracking, no metrics, no alerting. When something breaks in production, you find out from user bug reports, not from your monitoring.

**Impact:** Every production issue becomes a "user reports it in GitHub Issues" situation. Response time is hours instead of minutes.

**Prevention:**
- Add Sentry for Workers (`@sentry/cloudflare` package) -- 15 minutes of work
- Add a simple `/metrics` endpoint that returns request counts, error counts, D1 latency
- Set up a free Uptime Robot monitor on `https://api.kindlm.com/health`
- Log webhook processing results (success/failure/event type) for Stripe debugging

**Phase:** Pre-v1.0 (health endpoint + uptime monitor), v1.0 (Sentry), v1.1 (metrics)

---

## 8. Lessons from Similar Launches

### 8.1 promptfoo Early Issues

**What went wrong:**
- Initial versions had no caching -- every test run re-called the LLM, making iteration expensive
- Provider interface changed frequently, breaking user configs between minor versions
- No structured output validation (added later) -- users had to write custom JavaScript assertions

**Lessons for KindLM:**
- Ship with response caching from day one (even just a local file cache)
- Freeze the ProviderAdapter interface before v1.0 -- breaking changes after 1.0 require a major version
- The assertion type system is KindLM's strength -- make sure every assertion has clear error messages when it fails

### 8.2 Braintrust Early Issues

**What went wrong:**
- Tight coupling to their cloud platform -- couldn't use the eval library without a Braintrust account
- Complex setup for simple use cases (needed to create a project, configure API keys, install SDK)
- Pricing confusion -- free tier limits unclear

**Lessons for KindLM:**
- CLI must be 100% usable without a Cloud account -- this is the open-core contract
- `kindlm init && kindlm test` must work with zero cloud configuration
- Free tier limits must be crystal clear in the README and dashboard

### 8.3 General Developer Tool Launch Patterns

**Common death spiral:**
1. Launch with too many features, half-broken
2. First users hit bugs in non-core features
3. GitHub Issues fill with bug reports, not feature requests
4. Maintainer burns out fixing edge cases instead of improving core
5. Users leave, repo stalls

**Prevention:**
- Launch with the minimum feature set that works perfectly
- It's better to ship 4 assertion types that work flawlessly than 11 that sometimes break
- Disable features you haven't tested E2E rather than shipping them broken
- First 30 days after launch: fix bugs immediately (within hours), respond to every issue within 24 hours

---

## Summary: Pre-v1.0 Ship Blockers

| # | Pitfall | Effort | Risk if Ignored |
|---|---------|--------|----------------|
| 1 | Verify `npx` first-run experience | 2 hours | Users can't install |
| 2 | Synchronize core+cli versions for 1.0.0 | 1 hour | Broken dependency |
| 3 | Test exit code contract | 2 hours | CI pipelines break |
| 4 | Verify D1 queries work in production | 4 hours | Data corruption |
| 5 | Add startup secret validation in Worker | 1 hour | Cryptic runtime crashes |
| 6 | Fix or remove Cloud API references | 1-5 days | Broken first impression |
| 7 | Hard-code OAuth callback URL | 30 min | Login completely broken |
| 8 | Verify dashboard deep linking on CF Pages | 1 hour | 404s on dashboard navigation |
| 9 | Create Stripe Products/Prices (not inline) | 2 hours | Portal doesn't work |
| 10 | Write README with quick start + terminal output | 4 hours | No one tries the tool |
| 11 | Add `--dry-run` mode | 2 hours | High activation energy |
| 12 | Add `_headers` for cache control | 15 min | Stale dashboard after deploy |
| 13 | Add `/health` endpoint | 30 min | Can't diagnose outages |
| 14 | Set up uptime monitoring | 15 min | Find bugs from user reports |

**Total estimated effort for ship blockers: 2-4 days**

---

## Phase Assignment Summary

| Phase | Pitfalls to Address |
|-------|-------------------|
| **Pre-v1.0 (now)** | 1.1, 1.2, 1.4, 2.1 (rate limiting), 2.4, 3.2, 4.1, 4.4, 5.1, 5.3, 5.5, 6.1, 6.2, 6.5, 7.1, 7.4 (health+uptime) |
| **v1.0** | 1.3, 2.3, 2.5, 3.3 (expiry), 3.4, 3.5, 5.2, 5.4, 6.3, 6.5 (remaining docs) |
| **v1.1** | 1.5, 2.2 (monitoring), 2.3 (retry), 4.2, 7.3, 7.4 (Sentry+metrics) |
| **Pre-Enterprise** | 7.2 (SAML verification) |
| **Ongoing** | 6.4 (community building), 8.3 (rapid bug response) |
