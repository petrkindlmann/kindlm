# KindLM v2 Roadmap

**Phases:** 4
**Requirements:** 15 mapped
**Estimated effort:** 3-5 days

---

## Phase 1: v1 Cleanup & Infrastructure

**Goal:** Close out the 2 remaining v1 items and refactor the monolithic Cloud modules so the codebase is clean before adding new features.

**Requirements:** CLEAN-01, CLEAN-02, INFRA-01, INFRA-02, INFRA-03

**UI hint:** no

**Success criteria:**
1. VS Code extension installable from marketplace (`code --install-extension kindlm.kindlm`)
2. Stripe checkout works with real Products/Prices (test purchase completes)
3. queries.ts split into ≤300 LOC domain modules with no behavior change (255 tests still pass)
4. sso.ts split into SAML logic + route handler (≤200 LOC each)
5. D1 indexes verified or added for all query patterns

**Plans:** (filled during planning)

---

## Phase 2: CLI Enhancements

**Goal:** Ship the 5 CLI improvements that make the developer experience significantly better — dry-run, watch, caching, GitHub Action, and HTTP provider.

**Requirements:** CLI-V2-01, CLI-V2-02, CLI-V2-03, CLI-V2-04, CLI-V2-05

**UI hint:** no

**Success criteria:**
1. `kindlm test --dry-run` prints test plan and exits 0 without any API calls
2. `kindlm test --watch` re-runs on kindlm.yaml change (file watcher + debounce)
3. Repeated `kindlm test` with same config uses cached LLM responses (cache hit logged)
4. GitHub Action posts test summary as PR comment with pass/fail badge
5. `provider: http` in kindlm.yaml sends requests to arbitrary HTTP endpoints

**Plans:** (filled during planning)

---

## Phase 3: Enterprise Features

**Goal:** Make KindLM enterprise-ready with proper SAML, signed compliance reports, audit logging, and token rotation.

**Requirements:** ENT-01, ENT-02, ENT-03, ENT-04

**UI hint:** no

**Success criteria:**
1. SAML SSO login with XML signature verification using a proper parser (not regex)
2. Compliance PDF reports are cryptographically signed (verifiable)
3. `GET /v1/audit-log` returns paginated audit events for enterprise orgs
4. Tokens auto-rotate after configurable expiry with refresh flow

**Plans:** (filled during planning)

---

## Phase 4: Observability & Polish

**Goal:** Add Sentry error tracking and do a final quality pass before cutting v2.0.0.

**Requirements:** INFRA-04

**UI hint:** no

**Success criteria:**
1. Sentry captures unhandled errors in Cloud Workers with source maps
2. v2.0.0 released to npm with all v2 features

**Plans:** (filled during planning)

---

## Requirement Coverage Matrix

| Requirement | Phase | Category |
|-------------|-------|----------|
| CLEAN-01 | 1 | v1 Cleanup |
| CLEAN-02 | 1 | v1 Cleanup |
| INFRA-01 | 1 | Infrastructure |
| INFRA-02 | 1 | Infrastructure |
| INFRA-03 | 1 | Infrastructure |
| CLI-V2-01 | 2 | CLI |
| CLI-V2-02 | 2 | CLI |
| CLI-V2-03 | 2 | CLI |
| CLI-V2-04 | 2 | CLI |
| CLI-V2-05 | 2 | CLI |
| ENT-01 | 3 | Enterprise |
| ENT-02 | 3 | Enterprise |
| ENT-03 | 3 | Enterprise |
| ENT-04 | 3 | Enterprise |
| INFRA-04 | 4 | Observability |

**Coverage:** 15/15 requirements mapped (100%)

---
*Created: 2026-03-28*
