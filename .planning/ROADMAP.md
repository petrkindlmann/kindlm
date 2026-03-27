# KindLM v1.0 Roadmap

**Phases:** 4
**Requirements:** 28 mapped
**Granularity:** Coarse
**Estimated effort:** 2-4 days (per research synthesis)

---

## Phase 1: CLI Verification & Cloud API

**Goal:** Prove the core CLI works end-to-end against real LLMs, and get the Cloud API deployed and responding so all downstream phases (dashboard, billing, upload) have a working backend.

**Requirements:** CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLOUD-01, CLOUD-02, CLOUD-04, CLOUD-05, CLOUD-06, CLOUD-07

**UI hint:** no

**Success criteria:**
1. `npx @kindlm/cli init` produces a valid `kindlm.yaml` on a clean machine (no prior install)
2. `kindlm test` against a real OpenAI API key runs assertions and exits 0 on pass, 1 on fail or config error
3. `curl -sf https://api.kindlm.com/health` returns `{"status":"ok"}` and GitHub OAuth login flow completes in browser
4. `kindlm validate` rejects invalid YAML without requiring any API keys; all errors go to stderr, test output to stdout

**Plans:** (filled during planning)

---

## Phase 2: Dashboard & Upload Pipeline

**Goal:** Deploy the dashboard, connect it to the live Cloud API, and verify the full upload pipeline so users can see test results in a browser after running `kindlm upload`.

**Requirements:** CLOUD-03, DASH-01, DASH-02, DASH-03, DASH-04

**UI hint:** yes

**Success criteria:**
1. Dashboard loads at app.kindlm.com; deep links like `/projects/abc` resolve correctly (no 404)
2. `kindlm upload` sends test results to the Cloud API and they appear in the dashboard within 10 seconds
3. `index.html` served with `Cache-Control: no-cache`; hashed JS/CSS assets served with `immutable`

**Plans:** (filled during planning)

---

## Phase 3: Marketing Site, Billing & VS Code Extension

**Goal:** Deploy the public-facing marketing site, verify Stripe billing works end-to-end, and publish the VS Code extension so the product is fully accessible to new users.

**Requirements:** SITE-01, SITE-02, SITE-03, BILL-01, BILL-02, BILL-03, REL-04

**UI hint:** yes

**Success criteria:**
1. `kindlm.com` loads the marketing site with working docs navigation and a README terminal screenshot/GIF
2. A test user can upgrade from free to team plan via Stripe Checkout, and the webhook correctly updates their plan in D1
3. The VS Code extension is installable from the marketplace and provides YAML intellisense for `kindlm.yaml`

**Plans:** (filled during planning)

---

## Phase 4: Release & Monitoring

**Goal:** Cut the v1.0.0 release with synchronized versions, npm provenance, GitHub Release, and uptime monitoring so the product is production-grade and continuously observed.

**Requirements:** REL-01, REL-02, REL-03, MON-01, MON-02

**UI hint:** no

**Success criteria:**
1. `npx @kindlm/cli@latest --version` returns `1.0.0`; `@kindlm/core` also at `1.0.0`; both published with npm provenance
2. GitHub Release exists with a changeset-generated changelog
3. UptimeRobot (or equivalent) monitors `api.kindlm.com/health` every 5 minutes with email alerts on failure
4. Full E2E verified: `kindlm init` -> `kindlm test` -> `kindlm upload` -> results visible in dashboard

**Plans:** (filled during planning)

---

## Requirement Coverage Matrix

| Requirement | Phase | Category |
|-------------|-------|----------|
| CLI-01 | 1 | CLI Verification |
| CLI-02 | 1 | CLI Verification |
| CLI-03 | 1 | CLI Verification |
| CLI-04 | 1 | CLI Verification |
| CLI-05 | 1 | CLI Verification |
| CLOUD-01 | 1 | Cloud API |
| CLOUD-02 | 1 | Cloud API |
| CLOUD-03 | 2 | Upload Pipeline |
| CLOUD-04 | 1 | Cloud API |
| CLOUD-05 | 1 | Cloud API |
| CLOUD-06 | 1 | Cloud API |
| CLOUD-07 | 1 | Cloud API |
| DASH-01 | 2 | Dashboard |
| DASH-02 | 2 | Dashboard |
| DASH-03 | 2 | Dashboard |
| DASH-04 | 2 | Dashboard |
| SITE-01 | 3 | Marketing Site |
| SITE-02 | 3 | Marketing Site |
| SITE-03 | 3 | Marketing Site |
| BILL-01 | 3 | Billing |
| BILL-02 | 3 | Billing |
| BILL-03 | 3 | Billing |
| REL-01 | 4 | Release |
| REL-02 | 4 | Release |
| REL-03 | 4 | Release |
| REL-04 | 3 | Release |
| MON-01 | 4 | Monitoring |
| MON-02 | 4 | Monitoring |

**Coverage:** 28/28 requirements mapped (100%)

---
*Created: 2026-03-27*
