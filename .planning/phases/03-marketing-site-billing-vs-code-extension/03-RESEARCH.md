# Phase 3 Research: Marketing Site, Billing & VS Code Extension

**Date:** 2026-03-27
**Requirements:** SITE-01, SITE-02, SITE-03, BILL-01, BILL-02, BILL-03, REL-04

---

## SITE-01: Marketing site deployed to CF Pages at kindlm.com

### What exists and works
- Full Next.js 14 marketing site in `site/` with static export (`output: "export"` in `next.config.mjs`).
- Landing page (`site/components/LandingPage.tsx`) is complete: hero, animated terminal demo, feature sections (tool calls, judge, drift), compliance CTA, footer, provider logos.
- `site/out/` directory exists with a full static build (index.html, all docs pages, blog pages, assets).
- SEO metadata complete: OpenGraph, Twitter card, robots, sitemap.xml, og.png.
- Blog section with 7 articles under `site/content/blog/`.

### What's missing or broken
- **No wrangler config for the site.** There is no `site/wrangler.toml`, `site/wrangler.jsonc`, or any CF Pages deployment config. The site has never been deployed.
- **No `_headers` file** for CF Pages cache control (`no-cache` on index.html, `immutable` on hashed assets).
- **No `_redirects` file.** The static export generates individual HTML files for each route (e.g., `docs/getting-started.html`), so SPA-style `_redirects` is not needed for static export. However, any routes not pre-rendered will 404.
- **No custom domain DNS configured** for `kindlm.com` pointing to CF Pages.

### Specific changes needed
1. Create `site/wrangler.jsonc` or use `npx wrangler pages project create kindlm-site` + `npx wrangler pages deploy ./out --project-name=kindlm-site`.
2. Add `site/public/_headers` with:
   ```
   /index.html
     Cache-Control: no-cache
   /_next/static/*
     Cache-Control: public, max-age=31536000, immutable
   ```
3. Configure DNS: A record for `kindlm.com` -> `192.0.2.1` (proxied) via Cloudflare API, then add custom domain in CF Pages project settings.
4. Add `www.kindlm.com` CNAME -> `kindlm.com` (proxied).

---

## SITE-02: Docs pages render correctly with navigation

### What exists and works
- Docs infrastructure is complete and functional:
  - `site/lib/docs.ts` maps 24 doc files from `docs/` directory to URL slugs with ordered navigation groups.
  - `site/app/docs/layout.tsx` renders top nav + sidebar + content area.
  - `site/components/DocsSidebar.tsx` has mobile-responsive sidebar with grouped navigation, active state highlighting, and GitHub link.
  - `site/app/docs/[slug]/page.tsx` renders individual doc pages with prev/next navigation.
  - `site/app/docs/page.tsx` redirects `/docs` to `/docs/getting-started`.
  - `site/components/Markdown.tsx` uses react-markdown with GFM, slug anchors, and syntax highlighting.
- All 24 doc pages are pre-rendered in `site/out/docs/` as individual HTML files.
- Navigation groups: Getting Started (5), Core Concepts (5), Guides (4), Infrastructure (5), Reference (2), Other (4).

### What's missing or broken
- **No prose styling for code blocks.** The Markdown component wraps content in `<div className="prose">` but there's no `highlight.js` CSS imported, so syntax highlighting from `rehype-highlight` won't render colored.
- **No 404 page for invalid doc slugs in production.** The `notFound()` call in `[slug]/page.tsx` works at build time (skips unknown slugs) but the static export needs a `404.html` -- which does exist in `site/out/404.html`, so this is covered.

### Specific changes needed
1. Import a highlight.js theme CSS (e.g., `github-dark` or `atom-one-dark`) in `site/app/globals.css` or the Markdown component for syntax-highlighted code blocks.
2. Verify all 24 docs render after deployment by spot-checking a few URLs.

---

## SITE-03: README terminal screenshot/GIF showing test output

### What exists and works
- The landing page has an **animated terminal component** (`site/components/landing/Terminal.tsx`) that shows a realistic `kindlm test` output with:
  - Typewriter-style line-by-line reveal with timing delays.
  - Color-coded output: green for pass, red for fail, orange for sub-errors, blue for stats.
  - IntersectionObserver-based trigger (starts when scrolled into view).
  - `prefers-reduced-motion` support (shows all lines instantly).
  - Proper aria-label for accessibility.
- This is a live animated component, not a static screenshot or GIF.

### What's missing or broken
- **No static screenshot/GIF for the GitHub README.** The animated Terminal component only works on the marketing site. The GitHub README (`docs/00-README.md` or the root README if one exists) needs a static image or GIF that can render on GitHub/npm.
- The requirement says "README terminal screenshot/GIF" -- the marketing site has the animated version, but there's no `site/public/terminal.png` or `terminal.gif` for embedding in markdown.

### Specific changes needed
1. Capture a screenshot or GIF of the terminal animation (either manually or via a tool like `vhs`/`svg-term`).
2. Save as `site/public/terminal.png` (or `.gif`) and reference it in the root README and docs/00-README.md.
3. Alternative: use an SVG-based terminal recording (e.g., via `svg-term-cli` or `asciinema`) that renders on GitHub.

---

## BILL-01: Stripe Products/Prices created (not inline price_data)

### What exists and works
- Billing routes exist in `packages/cloud/src/routes/billing.ts` with:
  - `GET /` -- returns current plan and billing info.
  - `POST /checkout` -- creates Stripe Checkout session.
  - `POST /portal` -- creates Stripe Customer Portal session.
  - Stripe webhook handler with HMAC-SHA256 signature verification, timestamp replay protection, and constant-time comparison.
- Webhook handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Redirect URL validation (only allows `https://cloud.kindlm.com`).
- Comprehensive test coverage in `billing.test.ts` (6 tests).

### What's missing or broken
- **CRITICAL: The checkout route uses inline `price_data` instead of pre-created Stripe Price IDs.** Lines 108-111 of `billing.ts`:
  ```typescript
  "line_items[0][price_data][currency]": "usd",
  "line_items[0][price_data][product_data][name]": planInfo.name,
  "line_items[0][price_data][unit_amount]": planKey === "team" ? "4900" : "29900",
  "line_items[0][price_data][recurring][interval]": "month",
  ```
  This creates a new anonymous Price object on every checkout. Problems:
  - **Customer Portal will not work** -- the Portal needs pre-created Products/Prices to display subscription management UI.
  - **Stripe dashboard analytics** won't aggregate revenue by product.
  - **Price changes** require code deploys instead of Stripe dashboard updates.

### Specific changes needed
1. Create Stripe Products and Prices in the Stripe dashboard (or via API):
   - Product: "KindLM Team" with Price: $49/month (recurring)
   - Product: "KindLM Enterprise" with Price: $299/month (recurring)
   - Add `plan: "team"` / `plan: "enterprise"` to Price metadata.
2. Add Price IDs as Worker secrets: `STRIPE_TEAM_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`.
3. Refactor `POST /checkout` to use `line_items[0][price]` instead of `line_items[0][price_data]`:
   ```typescript
   "line_items[0][price]": c.env.STRIPE_TEAM_PRICE_ID,  // or enterprise
   "line_items[0][quantity]": "1",
   ```
4. Update `PLAN_PRICES` map to include Price ID references.
5. Update billing tests.

---

## BILL-02: Checkout flow tested: free -> team upgrade works

### What exists and works
- The checkout route logic is complete: creates/reuses Stripe customer, creates Checkout session, returns URL.
- Webhook processes `checkout.session.completed` and updates org plan in D1.
- Test coverage exists for: 501 when Stripe not configured, billing info retrieval with/without data.

### What's missing or broken
- **No integration test for the full checkout -> webhook -> plan update flow.** The existing tests verify individual endpoints but don't test the E2E sequence.
- **No test Stripe environment configured.** `STRIPE_SECRET_KEY` is checked at runtime; there's no documented setup for Stripe test mode keys.
- **Checkout test returns 501** in tests because the mock app doesn't set `STRIPE_SECRET_KEY` in env bindings. There's no test that actually exercises the checkout creation path with a mocked Stripe API.

### Specific changes needed
1. Add integration test: mock Stripe API responses for customer creation + checkout session creation, verify the full flow returns a checkout URL.
2. Add integration test: send a valid webhook for `checkout.session.completed`, verify D1 gets updated with the new plan.
3. Document Stripe test mode setup: which keys to set, how to use Stripe CLI for local webhook testing (`stripe listen --forward-to localhost:8787/stripe/webhook`).
4. After BILL-01 fix (Price IDs), update the checkout test to verify the Price ID is sent instead of price_data.

---

## BILL-03: Webhook handles subscription create/update/delete correctly

### What exists and works
- All three webhook event types are handled:
  - `checkout.session.completed` -- creates billing record, updates org plan.
  - `customer.subscription.updated` -- updates period end, extracts plan from subscription items, syncs org plan.
  - `customer.subscription.deleted` -- resets plan to "free".
- Org lookup by `stripe_customer_id` (not just metadata) for security.
- Fallback to `metadata.org_id` for initial checkout (before billing record exists).
- HMAC signature verification with Web Crypto API (Workers-compatible).
- Timestamp replay protection (5-minute window).
- Test coverage: 5 webhook tests (missing sig, invalid sig, checkout completed, sub updated, sub deleted).

### What's missing or broken
- **`subscription.updated` plan extraction is fragile.** It reads from `items.data[0].price.metadata.plan` -- this requires the Stripe Price to have `plan` in its metadata. With the current inline `price_data` approach, no metadata is set on the Price, so this path is dead code. Once BILL-01 is fixed (pre-created Prices with metadata), this will work.
- **No idempotency handling.** Stripe can send the same webhook multiple times. The upsert logic is naturally idempotent for plan updates, but there's no deduplication by event ID.
- **`checkout.session.completed` accesses `obj.subscription` via type assertion** (`(obj as { subscription?: string }).subscription`) -- fragile but functional.

### Specific changes needed
1. After BILL-01 (pre-created Prices with `plan` metadata), the `subscription.updated` path will work correctly. Verify with a test.
2. Consider adding webhook event ID logging for debugging (not blocking for v1).
3. The existing webhook handler is functionally correct once BILL-01 is fixed. No structural changes needed.

---

## REL-04: VS Code extension published to marketplace

### What exists and works
- Full extension in `packages/vscode/` with:
  - **Diagnostics:** Validates version, suites, provider format, assertion types, temperature range, threshold range.
  - **Completions:** Context-aware autocomplete for fields, assertion types, providers (`site/components` confirms these via `completions.ts`).
  - **Hover docs:** Inline documentation for KindLM fields (via `hover.ts`).
  - **JSON Schema:** Bundled `schemas/kindlm.schema.json` for YAML extension integration.
  - **Snippets:** 4 starter snippets (suite, test, assert-tool, assert-judge).
- Build works: `esbuild` bundles to `dist/extension.js`.
- Pre-built VSIX exists: `packages/vscode/kindlm-0.1.0.vsix`.
- `package.json` has publisher: `"kindlm"`, correct activation events, contributes section.
- Comprehensive README with features, quick start, example config.
- `.vscodeignore` properly excludes src/node_modules.

### What's missing or broken
- **Publisher "kindlm" may not exist on the VS Code Marketplace.** Publishing requires creating a publisher via https://marketplace.visualstudio.com/manage and obtaining a Personal Access Token (PAT) from Azure DevOps.
- **No `icon` field in package.json.** Marketplace listings without an icon look unprofessional.
- **No `galleryBanner` or `badges` in package.json** (nice-to-have).
- **No CI step for extension publishing.** The VSIX is built locally but there's no automated release pipeline.
- **`vsce` is not a listed dependency** -- the package script uses `npx vsce package` which works but `@vscode/vsce` should be in devDependencies for reproducibility.
- **No `CHANGELOG.md`** in the extension directory (marketplace shows this tab).

### Specific changes needed
1. Create publisher "kindlm" at https://marketplace.visualstudio.com/manage (requires Microsoft account).
2. Generate a PAT from Azure DevOps with Marketplace > Manage scope.
3. Add `icon` field to `package.json` pointing to a 128x128 or 256x256 PNG icon.
4. Add `@vscode/vsce` to devDependencies.
5. Publish: `npx vsce login kindlm` then `npx vsce publish` (or `npx vsce publish -p <PAT>`).
6. Add a `CHANGELOG.md` with initial 0.1.0 entry.
7. Verify the VSIX installs correctly: `code --install-extension kindlm-0.1.0.vsix` and test with a sample `kindlm.yaml`.

---

## Summary: Effort Estimate

| Requirement | Status | Effort | Blocking? |
|-------------|--------|--------|-----------|
| SITE-01 | Site built, not deployed | 1-2 hours (deploy + DNS) | Yes |
| SITE-02 | Docs complete, missing highlight CSS | 30 min | No |
| SITE-03 | Animated terminal exists, no static image | 1 hour | No |
| BILL-01 | Uses inline price_data (broken) | 2 hours (Stripe setup + code fix) | Yes |
| BILL-02 | No E2E checkout test | 2 hours | No |
| BILL-03 | Works once BILL-01 is fixed | 30 min verification | No |
| REL-04 | Extension built, not published | 1-2 hours (publisher + publish) | Yes |

**Total estimate:** 8-10 hours

**Critical path:** BILL-01 (Stripe Price IDs) must be done before BILL-02 and BILL-03 can be verified. SITE-01 (deployment) gates SITE-02 verification.

---

## Recommended Plan Structure

**Plan 03-01: Marketing Site Deployment**
- SITE-01: Deploy to CF Pages, configure DNS
- SITE-02: Fix highlight CSS, verify docs navigation
- SITE-03: Capture terminal screenshot for README

**Plan 03-02: Stripe Billing Fix & Verification**
- BILL-01: Create Stripe Products/Prices, refactor checkout to use Price IDs
- BILL-02: Add checkout flow integration test
- BILL-03: Verify webhook handles all events correctly with pre-created Prices

**Plan 03-03: VS Code Extension Publishing**
- REL-04: Create publisher, add icon, publish to marketplace
