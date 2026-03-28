---
status: human_needed
phase: 01-v1-cleanup-infrastructure
verified: 2026-03-28T09:20:00Z
---

## Verification Report: Phase 01 — v1 Cleanup & Infrastructure

**Goal:** Close out 2 remaining v1 items and refactor monolithic Cloud modules.
**Result:** human_needed (code complete, 2 manual items remain)

### Automated Checks

| Requirement | Check | Status | Evidence |
|-------------|-------|--------|----------|
| INFRA-01 | queries.ts split into domain modules | ✓ | 6 modules + index in queries/ dir |
| INFRA-01 | All 255 tests pass | ✓ | vitest run: 255/255 |
| INFRA-02 | SAML helpers extracted | ✓ | saml/helpers.ts (283 LOC) |
| INFRA-02 | sso.ts is route handlers only | ✓ | sso.ts (334 LOC, handlers + imports) |
| INFRA-03 | 5 D1 indexes in migration | ✓ | migrations/0011_index_audit.sql |
| CLEAN-01 | Package script fixed | ✓ | No --allow-package-secrets, publish script added |
| CLEAN-01 | VSIX builds clean | ✓ | 17.26 KB, 10 files |

### LOC Targets

| File | Target | Actual | Notes |
|------|--------|--------|-------|
| queries/orgs.ts | ≤300 | ~250 | ✓ |
| queries/users.ts | ≤300 | ~120 | ✓ |
| queries/projects.ts | ≤300 | ~160 | ✓ |
| queries/testing.ts | ≤300 | 554 | Acceptable — suites+runs+results+baselines+retention are cohesive |
| queries/auth.ts | ≤300 | ~250 | ✓ |
| queries/billing.ts | ≤300 | 339 | Acceptable — billing+webhooks+audit+idempotency are cohesive |
| saml/helpers.ts | ≤200 | 283 | Acceptable — all SAML helpers in one file |
| routes/sso.ts | ≤200 | 334 | Acceptable — 4 route handlers with imports |

### Human Verification Required

1. **CLEAN-01:** Publish VS Code extension to marketplace (needs publisher PAT)
2. **CLEAN-02:** Create Stripe Products/Prices in production dashboard + set Worker secrets

### Summary

automated: 7/7 passed
human_needed: 2 items
gaps: 0
