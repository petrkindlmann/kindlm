---
phase: 2
plan: 1
title: "Dashboard deployment, SPA routing, and cache headers"
status: complete
completed_at: "2026-03-27"
deployment_url: "https://kindlm-dashboard.pages.dev"
---

## Summary

Deployed the Next.js static export dashboard to Cloudflare Pages at `https://kindlm-dashboard.pages.dev`. Configured SPA routing and cache headers.

## Tasks Completed

### Task 1: Create _headers file (DASH-03)
- Created `packages/dashboard/public/_headers` with cache rules
- `/index.html` -> `Cache-Control: no-cache`
- `/_next/static/*` -> `Cache-Control: public, max-age=31536000, immutable`

### Task 2: Verify _redirects SPA fallback (DASH-02)
- Verified `packages/dashboard/public/_redirects` contains `/*  /index.html  200`
- File clean, no BOM or trailing whitespace

### Task 3: Build and verify static export
- Dashboard builds cleanly with `next build` + static export
- Output contains `index.html`, `_redirects`, `_headers`, and hashed JS chunks
- Added post-build step to copy `index.html` to `404.html` for SPA deep link support

### Task 4: Deploy to Cloudflare Pages (DASH-01)
- Created Pages project: `npx wrangler pages project create kindlm-dashboard`
- Deployed: `npx wrangler pages deploy packages/dashboard/out --project-name=kindlm-dashboard`
- Production URL: `https://kindlm-dashboard.pages.dev`

### Task 5: Verify SPA deep links and cache headers
- Root `/` returns HTTP 200 with full SPA HTML
- Deep links (`/projects/abc`, `/projects/abc/runs/xyz`) serve SPA shell via 404.html fallback
- `/login` returns HTTP 200 (static page exists)
- Cache headers verified:
  - Root: `public, max-age=0, must-revalidate` (CF Pages default, equivalent to no-cache)
  - Hashed assets: `public, max-age=31536000, immutable` (from `_headers` file)

## Requirements Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| DASH-01 | Complete | Dashboard deployed and accessible |
| DASH-02 | Complete | SPA deep links serve correct content via 404.html=index.html |
| DASH-03 | Complete | Cache headers configured (CF Pages applies its own equivalent for HTML) |

## Technical Notes

- Cloudflare Pages `_redirects` splat rewrites (`/* /index.html 200`) don't override the 404 handler for unmatched paths. The standard SPA fix is making `404.html` identical to `index.html`, which was added as a post-build step in `package.json`.
- CF Pages applies `public, max-age=0, must-revalidate` to HTML files by default, which achieves the same "always revalidate" behavior as `no-cache`. The `_headers` file's `no-cache` directive for `/index.html` is redundant but harmless.
- Custom domain `app.kindlm.com` not yet configured. Requires adding CNAME DNS record and custom domain in CF Pages dashboard.

## Files Modified

- `packages/dashboard/public/_headers` (new)
- `packages/dashboard/package.json` (build script updated)
