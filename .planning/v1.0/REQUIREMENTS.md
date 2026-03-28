# Requirements: KindLM v1.0

**Defined:** 2026-03-27
**Core Value:** The CLI must reliably test AI agent behavior end-to-end so developers trust it in CI pipelines.

## v1 Requirements

### CLI Verification

- [ ] **CLI-01**: `npx @kindlm/cli init` works on a clean machine (correct shebang, dist included, ESM resolution)
- [ ] **CLI-02**: `kindlm test` against real OpenAI API passes E2E (config → provider call → assertions → exit code 0)
- [ ] **CLI-03**: Exit code contract verified: all pass (0), any fail (1), config error (1), provider unreachable (1)
- [ ] **CLI-04**: `kindlm validate` catches invalid config without requiring API keys
- [ ] **CLI-05**: stderr/stdout separation: errors to stderr, test output to stdout

### Cloud API

- [ ] **CLOUD-01**: Cloud API deployed and responding at api.kindlm.com (`GET /health` returns 200)
- [ ] **CLOUD-02**: GitHub OAuth login flow works E2E (login → callback → token → dashboard)
- [ ] **CLOUD-03**: `kindlm upload` successfully sends results to cloud and they appear in dashboard
- [ ] **CLOUD-04**: Worker secrets configured (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, STRIPE keys)
- [ ] **CLOUD-05**: Worker validates required secrets at startup, fails fast if missing
- [ ] **CLOUD-06**: OAuth callback URL hard-coded per environment (not dynamically constructed)
- [ ] **CLOUD-07**: Token expiry set (90 days) with cleanup of old tokens

### Dashboard

- [ ] **DASH-01**: Dashboard deployed to Cloudflare Pages at app.kindlm.com (or similar)
- [ ] **DASH-02**: SPA deep links work (CF Pages `_redirects` with `/* /index.html 200`)
- [ ] **DASH-03**: Cache headers set: `no-cache` for index.html, immutable for hashed assets
- [ ] **DASH-04**: Dashboard shows uploaded test runs with pass/fail/assertion details

### Marketing Site

- [x] **SITE-01**: Marketing site deployed to Cloudflare Pages at kindlm.com
- [x] **SITE-02**: Docs pages render correctly with navigation
- [x] **SITE-03**: README terminal screenshot/GIF showing test output

### Billing

- [ ] **BILL-01**: Stripe Products/Prices created in Stripe dashboard (not inline price_data)
- [ ] **BILL-02**: Checkout flow tested: free → team upgrade works
- [ ] **BILL-03**: Webhook handles subscription create/update/delete correctly

### Release

- [ ] **REL-01**: Core and CLI versions synchronized to 1.0.0 via Changesets
- [ ] **REL-02**: npm provenance enabled in release workflow (NPM_CONFIG_PROVENANCE=true)
- [ ] **REL-03**: GitHub Release created with changelog
- [ ] **REL-04**: VS Code extension published to marketplace

### Monitoring

- [ ] **MON-01**: Health check endpoint on Cloud API (`GET /health`)
- [ ] **MON-02**: UptimeRobot (or similar) monitoring api.kindlm.com every 5 minutes

## v2 Requirements

### CLI Enhancements

- **CLI-V2-01**: `--dry-run` mode validates config and prints test plan without API calls
- **CLI-V2-02**: `--watch` mode re-runs tests on kindlm.yaml change
- **CLI-V2-03**: Result caching to avoid duplicate LLM calls during iteration
- **CLI-V2-04**: GitHub Action that posts test results as PR comment
- **CLI-V2-05**: Generic HTTP provider adapter for custom APIs

### Enterprise

- **ENT-01**: SAML signature verification with proper XML parser (not regex)
- **ENT-02**: Signed compliance PDF reports
- **ENT-03**: Audit log API
- **ENT-04**: Automatic token rotation

### Infrastructure

- **INFRA-01**: Refactor queries.ts (1529 LOC) into domain modules
- **INFRA-02**: Refactor sso.ts (596 LOC) — separate SAML logic from route handlers
- **INFRA-03**: D1 index audit for query performance
- **INFRA-04**: Sentry error tracking for Workers

## Out of Scope

| Feature | Reason |
|---------|--------|
| GitHub org transfer (petrkindlmann → kindlm) | Nice-to-have, not blocking launch |
| Additional providers (Bedrock, Azure) | No demand signal, enterprise-only |
| Red teaming / adversarial testing | Different product category (promptfoo's focus) |
| Prompt management / versioning | Different product category (Humanloop's focus) |
| Production observability / tracing | Different product category (LangSmith/Arize focus) |
| Self-hosted Cloud deployment | Enterprise-only, v2 |
| Mobile / native clients | Web-only for v1 |
| Homebrew distribution | Wait for 500+ weekly npm downloads |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | 1 — CLI Verification & Cloud API | Pending |
| CLI-02 | 1 — CLI Verification & Cloud API | Pending |
| CLI-03 | 1 — CLI Verification & Cloud API | Pending |
| CLI-04 | 1 — CLI Verification & Cloud API | Pending |
| CLI-05 | 1 — CLI Verification & Cloud API | Pending |
| CLOUD-01 | 1 — CLI Verification & Cloud API | Pending |
| CLOUD-02 | 1 — CLI Verification & Cloud API | Pending |
| CLOUD-03 | 2 — Dashboard & Upload Pipeline | Pending |
| CLOUD-04 | 1 — CLI Verification & Cloud API | Pending |
| CLOUD-05 | 1 — CLI Verification & Cloud API | Pending |
| CLOUD-06 | 1 — CLI Verification & Cloud API | Pending |
| CLOUD-07 | 1 — CLI Verification & Cloud API | Pending |
| DASH-01 | 2 — Dashboard & Upload Pipeline | Pending |
| DASH-02 | 2 — Dashboard & Upload Pipeline | Pending |
| DASH-03 | 2 — Dashboard & Upload Pipeline | Pending |
| DASH-04 | 2 — Dashboard & Upload Pipeline | Pending |
| SITE-01 | 3 — Marketing Site, Billing & VS Code Extension | Complete |
| SITE-02 | 3 — Marketing Site, Billing & VS Code Extension | Complete |
| SITE-03 | 3 — Marketing Site, Billing & VS Code Extension | Complete |
| BILL-01 | 3 — Marketing Site, Billing & VS Code Extension | Pending |
| BILL-02 | 3 — Marketing Site, Billing & VS Code Extension | Pending |
| BILL-03 | 3 — Marketing Site, Billing & VS Code Extension | Pending |
| REL-01 | 4 — Release & Monitoring | Pending |
| REL-02 | 4 — Release & Monitoring | Pending |
| REL-03 | 4 — Release & Monitoring | Pending |
| REL-04 | 3 — Marketing Site, Billing & VS Code Extension | Pending |
| MON-01 | 4 — Release & Monitoring | Pending |
| MON-02 | 4 — Release & Monitoring | Pending |
