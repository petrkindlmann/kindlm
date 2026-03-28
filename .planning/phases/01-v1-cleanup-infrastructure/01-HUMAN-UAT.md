---
status: partial
phase: 01-v1-cleanup-infrastructure
source: [01-VERIFICATION.md]
started: 2026-03-28T09:20:00Z
updated: 2026-03-28T09:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. CLEAN-01: Publish VS Code extension to marketplace
expected: Extension installable via `code --install-extension kindlm.kindlm`
result: [pending]

Steps:
1. Go to https://marketplace.visualstudio.com/manage
2. Create publisher ID `kindlm` if not exists
3. Create PAT at https://dev.azure.com → Personal Access Tokens (scope: Marketplace > Manage)
4. `cd packages/vscode && npx vsce publish -p <PAT>`
5. Verify: `code --install-extension kindlm.kindlm`

### 2. CLEAN-02: Create Stripe Products and set Worker secrets
expected: Stripe checkout creates session with real Price IDs
result: [pending]

Steps:
1. Stripe Dashboard → Products → "KindLM Team" $49/mo → copy price_id
2. Stripe Dashboard → Products → "KindLM Enterprise" $299/mo → copy price_id
3. `cd packages/cloud && npx wrangler secret put STRIPE_TEAM_PRICE_ID`
4. `cd packages/cloud && npx wrangler secret put STRIPE_ENTERPRISE_PRICE_ID`
5. Stripe Dashboard → Webhooks → add `https://api.kindlm.com/billing/webhook`
6. Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
