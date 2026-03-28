---
status: passed
phase: 03-marketing-site-billing-vs-code-extension
source: [03-VERIFICATION.md]
started: 2026-03-28T03:55:00Z
updated: 2026-03-28T03:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SITE-01: Connect kindlm.com custom domain to Cloudflare Pages
expected: kindlm.com loads the marketing site (not a 404 or the pages.dev URL)
result: approved

Steps:
1. Go to Cloudflare Dashboard > Pages > kindlm-site > Custom domains
2. Click "Add custom domain"
3. Enter `kindlm.com`
4. Cloudflare will verify DNS automatically (DNS records already set)
5. Wait for SSL certificate provisioning (usually 1-2 min)

### 2. BILL-01: Create Stripe Products and set Worker secrets
expected: STRIPE_TEAM_PRICE_ID and STRIPE_ENTERPRISE_PRICE_ID worker secrets are set; billing checkout works
result: approved

Steps:
1. Log in to Stripe Dashboard (test mode first)
2. Products > Add product > "KindLM Team" > Price: $49/month recurring, metadata: `plan=team`
3. Products > Add product > "KindLM Enterprise" > Price: $299/month recurring, metadata: `plan=enterprise`
4. Copy both Price IDs (starts with `price_`)
5. `npx wrangler secret put STRIPE_TEAM_PRICE_ID` (paste price ID)
6. `npx wrangler secret put STRIPE_ENTERPRISE_PRICE_ID` (paste price ID)
7. Settings > Billing > Customer portal > add both products, enable plan switch + cancel

### 3. REL-04: Publish VS Code extension to marketplace
expected: Extension installable via `code --install-extension kindlm.kindlm`
result: approved

Steps:
1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with Microsoft account
3. Create publisher ID: `kindlm`, display name: `KindLM`
4. Go to https://dev.azure.com > user icon > Personal Access Tokens
5. Create PAT: name=vscode-marketplace-publish, org=All, scope=Marketplace>Manage
6. `cd packages/vscode && npx vsce publish -p <YOUR_PAT>`
7. Verify at https://marketplace.visualstudio.com/items?itemName=kindlm.kindlm

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
