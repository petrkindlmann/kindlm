# Plan 03-02 Summary: Stripe Billing Fixes and Checkout Verification

## Status: Code Tasks Complete — Manual Prerequisites Pending

## What Was Done

### Task 1: Bindings interface updated
`packages/cloud/src/types.ts` — Added `STRIPE_TEAM_PRICE_ID?: string` and `STRIPE_ENTERPRISE_PRICE_ID?: string` to the `Bindings` interface.

### Task 2: Checkout route refactored (BILL-01)
`packages/cloud/src/routes/billing.ts` — Replaced inline `price_data` with pre-created Stripe Price IDs:
- `PLAN_PRICES` constant replaced with `PLAN_KEYS` (maps plan name → env key)
- Checkout session now uses `line_items[0][price]` with `c.env[planInfo.envKey]`
- Returns 501 with error `"Price not configured for {plan} plan. Set {envKey} worker secret."` when Price ID env var is absent
- No `price_data` remains in the file

### Task 3: Integration tests added (BILL-02)
`packages/cloud/src/routes/billing.test.ts` — Two new tests:
- `POST /checkout creates session with Price ID (not price_data)` — mocks Stripe API, verifies `line_items[0][price]` in request body and checkout URL returned
- `POST /checkout returns 501 when Price ID not configured` — verifies error message contains `STRIPE_TEAM_PRICE_ID`

### Task 4: Webhook test added (BILL-03)
`packages/cloud/src/routes/billing.test.ts` — New test:
- `subscription.updated syncs org plan via D1 UPDATE` — verifies D1 `UPDATE orgs SET plan` query is called when webhook fires with Price metadata

### Task 5: All tests pass
- `npx vitest run packages/cloud/src/routes/billing.test.ts` — 13/13 pass
- `npx turbo run typecheck --filter=@kindlm/cloud` — clean
- `npx turbo run test --filter=@kindlm/cloud` — 255/255 pass
- `npm run test` — all packages pass (FULL TURBO cache)

## Commit
`afaeb6b` — feat(cloud): replace inline price_data with Stripe Price IDs (BILL-01/02/03)

## Manual Prerequisites Still Required

The following steps require human action in the Stripe Dashboard before the Worker can process real checkout sessions:

### Step 1: Create Stripe Products and Prices (Stripe Dashboard)
1. Log in to [Stripe Dashboard](https://dashboard.stripe.com) — use **test mode** first.
2. Go to **Products** > **Add product**.
3. Create **KindLM Team**:
   - Price: $49.00 / month (recurring)
   - Add metadata key `plan` = `team` on the Price object
   - Copy the Price ID (`price_...`)
4. Create **KindLM Enterprise**:
   - Price: $299.00 / month (recurring)
   - Add metadata key `plan` = `enterprise` on the Price object
   - Copy the Price ID (`price_...`)

### Step 2: Set Worker Secrets
```bash
npx wrangler secret put STRIPE_TEAM_PRICE_ID
# Paste: price_xxxxx (from step 1)

npx wrangler secret put STRIPE_ENTERPRISE_PRICE_ID
# Paste: price_xxxxx (from step 1)
```

### Step 3: Configure Customer Portal (Stripe Dashboard)
1. Go to **Settings** > **Billing** > **Customer portal**.
2. Add both KindLM Team and KindLM Enterprise products.
3. Enable "Allow customers to switch plans" and "Allow customers to cancel subscriptions".
4. Save the portal configuration.

## Verification Checklist
- [x] `billing.ts` does NOT contain `price_data`
- [x] `billing.ts` uses `line_items[0][price]` with env var Price IDs
- [x] `types.ts` Bindings has `STRIPE_TEAM_PRICE_ID?` and `STRIPE_ENTERPRISE_PRICE_ID?`
- [x] Checkout returns 501 with descriptive error when Price ID missing
- [x] Integration test verifies Price ID sent (not price_data)
- [x] Webhook test verifies `subscription.updated` syncs org plan via D1
- [x] All tests pass
- [x] Full monorepo typecheck passes
- [ ] Stripe Products/Prices created in dashboard (manual)
- [ ] Worker secrets `STRIPE_TEAM_PRICE_ID` and `STRIPE_ENTERPRISE_PRICE_ID` set (manual)
- [ ] Customer Portal configured with both products (manual)
