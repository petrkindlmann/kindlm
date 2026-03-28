# KindLM v1.0 Research Synthesis

> Synthesized: 2026-03-27
> Sources: STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## 1. Stack Recommendation

**Keep everything.** The current stack (TypeScript, Turborepo, tsup, Vitest, Changesets, Hono on CF Workers, D1) is aligned with the 2025 standard and matches what promptfoo and Braintrust use. The gaps are operational, not architectural. **Add:** npm provenance to release workflow, Dependabot/Renovate for deps, Husky + lint-staged for pre-commit, Knip for dead code, UptimeRobot for free monitoring, Sentry for Workers error tracking. **Skip:** Homebrew (wait for 500+ weekly downloads), Biome (ESLint 9 is fine), Drizzle (not worth the migration cost now), Docker/native binaries, OTel export.

---

## 2. Table Stakes for v1.0

Solo devs will not adopt unless all of these work flawlessly:

- `npx @kindlm/cli init` produces a working `kindlm.yaml` on a clean machine
- `kindlm test` runs suites, prints colored pass/fail, exits 0 or 1 correctly
- OpenAI + Anthropic + Ollama providers connect and return structured responses
- tool_called, tool_not_called, tool_order, schema, judge, no_pii, keywords assertions all pass/fail correctly
- JUnit XML output works in GitHub Actions without configuration
- `--gate` threshold works for CI pass/fail gating
- Multiple runs aggregate correctly (mean/p50/p95)
- Result caching prevents duplicate LLM calls during iteration
- `--dry-run` validates config without requiring API keys
- README has a copy-pasteable quick start and terminal screenshot
- Config file discovery walks up directories (like `.git`)
- All errors go to stderr, test output to stdout

---

## 3. KindLM's Unique Angle

KindLM is the only CLI tool with first-class declarative tool call assertions (tool_called, tool_not_called, tool_order with arg matching) and EU AI Act Annex IV compliance report generation. No competitor -- not promptfoo, Braintrust, LangSmith, or Arize Phoenix -- offers either natively. The positioning is: "Test what your agent DOES, not what it SAYS."

---

## 4. Critical Ship Blockers

Ordered by blast radius. Total effort: 2-4 days.

1. **Decide: fix Cloud API or ship CLI-only.** The API is broken in production. Shipping broken cloud is worse than shipping no cloud. If cloud ships, the full path (OAuth -> upload -> dashboard) must work E2E. If not, remove all cloud references from CLI output and README. (1-5 days)
2. **Verify `npx` first-run on clean machine.** Check shebang, dist/ included in `files`, executable permissions, ESM resolution. Run `npm pack && npx ./kindlm-cli-*.tgz init` in CI. (2 hours)
3. **Synchronize core + cli versions to 1.0.0.** Currently core@0.2.1 and cli@0.4.1. Changesets `linked` config must bump both together. Publish order: core first, then cli. (1 hour)
4. **Test exit code contract.** Integration tests for: all pass (0), some fail (1), config error (1), provider unreachable (1). Add global unhandled rejection handler. (2 hours)
5. **Add Worker startup secret validation.** OAuth crashes if `GITHUB_CLIENT_ID` is undefined. Check all required secrets at Worker init, fail fast. (1 hour)
6. **Hard-code OAuth callback URL.** Dynamic construction from `c.req.url` breaks behind Cloudflare proxy. Use `https://api.kindlm.com/auth/github/callback` for production. (30 min)
7. **Create D1 baseline migration.** Copy `schema.sql` to `migrations/0001_initial_schema.sql` with `IF NOT EXISTS`. Apply to staging, then production. (30 min)
8. **Add dashboard `_redirects` and `_headers`.** Without `/* /index.html 200`, all deep links 404. Without cache headers, stale dashboards persist after deploys. (15 min)
9. **Create Stripe Products/Prices in dashboard.** Inline `price_data` breaks the Customer Portal. Use Price IDs from environment variables. (2 hours)
10. **Write the README.** One-sentence pitch, terminal GIF, `npx @kindlm/cli init && kindlm test`, assertion types list, "Why not promptfoo?" link. (4 hours)
11. **Add `--dry-run` mode.** Without it, users must enter API keys to evaluate the tool. Too much activation energy. (2 hours)
12. **Set up uptime monitoring.** UptimeRobot free tier, `GET /health` every 5 minutes, email alert on failure. (15 min)

---

## 5. Watch Out For

Ranked by likelihood x impact:

| # | Pitfall | Likelihood | Impact | Why It Hurts |
|---|---------|-----------|--------|-------------|
| 1 | **Cloud API broken at launch** | Certain (current state) | Critical | Users try cloud, it fails, trust destroyed permanently. Ship CLI-only or fix completely. |
| 2 | **D1 queries silently misbehave** | High | High | 50+ raw SQL queries in queries.ts, no RETURNING/datetime/LIMIT testing against real D1. Rate limiting writes to D1 on every request (serialized writes bottleneck). |
| 3 | **OAuth callback URL mismatch** | Medium | Critical | Dynamic URL construction + CF proxy = login completely broken for all users. One-line fix but easy to miss. |
| 4 | **Token accumulation / no expiry** | High | Medium | Every login creates a permanent token. No cleanup, no cap. Tokens table grows unbounded. Set 90-day expiry, delete old login-* tokens. |
| 5 | **Stale dashboard after deploy** | High | Medium | CF Pages caches `index.html`. Users see old app after deploy. Add `_headers` with `no-cache` for index.html, immutable for hashed assets. |

---

## 6. Deployment Order

Deploy in this exact sequence. Each step has a verification gate.

| Step | Action | Verify |
|------|--------|--------|
| **A1** | Set Worker secrets (prod + staging) | `npx wrangler secret list` shows all 3 |
| **A2** | Create `migrations/0001_initial_schema.sql`, apply to staging then prod | `SELECT 1` succeeds via `wrangler d1 execute` |
| **A3** | Deploy API to staging | `curl -sf https://staging-api.kindlm.com/health` returns `{"status":"ok"}` |
| **A4** | Run expanded smoke tests (health, 401, OAuth redirect, CORS, upload shape) | All return expected status codes |
| **A5** | Deploy API to production | `curl -sf https://api.kindlm.com/health` returns `{"status":"ok"}` |
| **B1** | Add `_redirects` + `_headers` to dashboard, build with `NEXT_PUBLIC_API_URL=https://api.kindlm.com` | `out/` contains `_redirects`, `_headers`, `index.html` |
| **B2** | Deploy dashboard to CF Pages | `cloud.kindlm.com/projects/test123` loads SPA (not 404) |
| **B3** | Test OAuth E2E in browser (dashboard login + CLI token flow) | Land on `/projects` with valid session; `kindlm login` works |
| **C1** | Build and deploy marketing site | `kindlm.com` loads |
| **C2** | Set up UptimeRobot on `/health` | Monitor shows green |
| **D1** | Publish `1.0.0-rc.0` via `npx changeset pre enter rc` | `npx @kindlm/cli@1.0.0-rc.0 init` works on clean machine |
| **D2** | Verify E2E: init -> test -> upload -> dashboard view | Results visible in dashboard |
| **D3** | Publish `1.0.0` stable | `npx @kindlm/cli@latest --version` returns `1.0.0` |
