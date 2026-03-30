---
phase: 01-deploy-everything
plan: 03
subsystem: infra
tags: [sentry, stripe, vscode, github-actions, cloudflare-workers, secrets]

# Dependency graph
requires:
  - phase: 01-deploy-everything/01-02
    provides: Cloud Worker deployed to api.kindlm.com, D1 migrations applied
provides:
  - SENTRY_DSN Worker secret configured for kindlm-api (error monitoring active)
  - VS Code extension published to VS Code Marketplace
  - Stripe test-mode products created (Team $49/mo, Enterprise $299/mo)
  - 4 Stripe Worker secrets set (STRIPE_SECRET_KEY, STRIPE_TEAM_PRICE_ID, STRIPE_ENTERPRISE_PRICE_ID, STRIPE_WEBHOOK_SECRET)
  - Stripe webhook endpoint configured at https://api.kindlm.com/v1/billing/webhook
  - CF_API_TOKEN GitHub Actions secret: PENDING (requires user action)
affects: [future-cloud-ops, billing, monitoring, vscode-users]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stripe test-mode first: verify billing flow with test keys before switching to live sk_live_ key"

key-files:
  created: []
  modified: []

key-decisions:
  - "Stripe test mode products created (prod_UF8B35R8JF90DU / prod_UF8BGSvhSoo5PP) — live mode requires sk_live_ key which restricted key lacked permissions for"
  - "CF_API_TOKEN left PENDING — non-blocking; Deploy Cloud workflow will fail until user creates token with Workers Edit permissions and sets gh secret"

patterns-established:
  - "Worker secrets set via wrangler secret put — not in wrangler.toml (never commit secrets)"

requirements-completed: [OPS-06, OPS-07, OPS-08]

# Metrics
duration: human-driven (checkpoint tasks)
completed: 2026-03-30
---

# Phase 01 Plan 03: Manual Deployment Steps Summary

**Sentry monitoring, VS Code extension, and Stripe billing wired up for KindLM Cloud — final manual credential steps for production readiness.**

## Performance

- **Duration:** Human-driven checkpoint (no code tasks)
- **Completed:** 2026-03-30
- **Tasks:** 3 of 4 complete (CF_API_TOKEN pending user action)
- **Files modified:** 0 (all changes were external secrets/deployments)

## Accomplishments

- SENTRY_DSN confirmed set as Worker secret for kindlm-api (error monitoring active)
- VS Code extension published to VS Code Marketplace (user confirmed)
- Stripe test-mode products created with all 4 Worker secrets set and webhook endpoint configured at https://api.kindlm.com/v1/billing/webhook
- CF_API_TOKEN left as non-blocking pending item — GitHub Actions Deploy Cloud workflow will need this to run automated deploys

## Task Results

| Task | Name | Status | Notes |
|------|------|--------|-------|
| 1 | CF_API_TOKEN GitHub Actions secret | PENDING | Requires Cloudflare API token with Workers Edit permissions; set via `gh secret set CF_API_TOKEN` |
| 2 | SENTRY_DSN Worker secret | DONE | Confirmed via `npx wrangler secret list` |
| 3 | VS Code extension published | DONE | User confirmed published to Marketplace |
| 4 | Stripe products + secrets | DONE | Test-mode products created; live mode pending sk_live_ key |

## Stripe Configuration Details

- **Team product:** prod_UF8B35R8JF90DU / price_1TGdvERGR6Y16FutjG0hLUUJ ($49/mo)
- **Enterprise product:** prod_UF8BGSvhSoo5PP / price_1TGdvERGR6Y16FutALdAWKk0 ($299/mo)
- **Webhook:** we_1TGdxGRGR6Y16Fut → https://api.kindlm.com/v1/billing/webhook
- **Worker secrets set:** STRIPE_SECRET_KEY, STRIPE_TEAM_PRICE_ID, STRIPE_ENTERPRISE_PRICE_ID, STRIPE_WEBHOOK_SECRET

## Deviations from Plan

### Non-blocking Deferrals

**1. [Pending - Non-blocking] CF_API_TOKEN not yet set**
- **Found during:** Task 1
- **Issue:** User needs to create Cloudflare API token with Workers Edit permissions at https://dash.cloudflare.com/profile/api-tokens, then run: `gh secret set CF_API_TOKEN -b "token" -R petrkindlmann/kindlm`
- **Impact:** Deploy Cloud GitHub Actions workflow will fail until this is set
- **Blocked by:** Requires user browser action on Cloudflare dashboard

**2. [Pending - Non-blocking] Stripe live-mode products not created**
- **Found during:** Task 4
- **Issue:** Live mode products require `sk_live_` key; restricted key lacked permissions
- **Impact:** Billing only works in test mode until user creates live products with live key
- **Next step:** Use Stripe dashboard directly or full live key to create live-mode counterparts

## Known Stubs

None — this plan had no code changes. All deliverables are external secrets/deployments.

## Self-Check: PASSED

- SUMMARY.md created at correct path
- No code files created/modified (plan was entirely external actions)
- Requirements OPS-06 (Sentry), OPS-07 (VS Code), OPS-08 (Stripe) addressed
