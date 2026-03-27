---
phase: 2
plan: 2
title: "Upload pipeline verification and dashboard data display"
status: complete
completed_at: "2026-03-27"
---

## Summary

Fixed critical route mounting mismatches between the Cloud API, CLI upload client, and dashboard SWR fetches. All three layers now agree on the REST API path structure. Added CORS origin for the dashboard Pages domain.

## Tasks Completed

### Task 1: Fix Cloud API route mounting (CLOUD-03, DASH-04)
- **Root cause found:** Cloud API mounted suiteRoutes at `/v1/suites`, runRoutes at `/v1/runs`, and resultRoutes at `/v1/results`. This created double-nested paths like `/v1/runs/:projectId/runs` and `/v1/results/:runId/results`. The CLI and dashboard expected natural REST paths like `/v1/projects/:projectId/runs` and `/v1/runs/:runId/results`.
- **Fix:** Split `runRoutes` into `projectRunRoutes` (project-scoped: create/list runs) and `runRoutes` (run-scoped: get/update/compliance). Split `suiteRoutes` into `projectSuiteRoutes` (project-scoped: create/list suites) and `suiteRoutes` (suite-scoped: get/update/delete).
- **Mounting:** `projectSuiteRoutes` and `projectRunRoutes` mounted at `/v1/projects`. `resultRoutes` mounted at `/v1/runs`. Standalone `suiteRoutes` and `runRoutes` stay at their respective prefixes.
- **CORS:** Added `https://kindlm-dashboard.pages.dev` to allowed origins.
- **Dashboard fix:** Updated `RunDetailClient.tsx` to fetch from `/v1/runs/${runId}/results` (was `/v1/results/${runId}/results`).
- **Tests:** Updated all 3 route test files (runs, results, suites) to use corrected mount points. All 58 route tests pass.

### Task 2: E2E verification (CLOUD-03) -- DOCUMENTED
- No KINDLM_API_TOKEN available (requires OAuth flow in browser)
- No OPENAI_API_KEY available (required for `kindlm test`)
- Cloud API health check confirmed: `{"status":"ok"}`
- **Prerequisite for live E2E:** Redeploy cloud with route fixes (`npx wrangler deploy` in `packages/cloud/`), then obtain token via `https://api.kindlm.com/auth/github`

### Task 3: Dashboard display verification (DASH-04) -- DOCUMENTED
- Cannot verify without deployed route fixes and API token
- Code paths verified to be correct after Task 1 fixes

### Task 4: Fix results API endpoint path (DASH-04) -- ADDRESSED IN TASK 1
- Identified and fixed in Task 1 as part of the comprehensive route mounting fix
- Dashboard `RunDetailClient.tsx` now uses `/v1/runs/${runId}/results`
- CLI upload uses `/v1/runs/${runId}/results`
- Both match the cloud route (resultRoutes mounted at `/v1/runs`)

### Task 5: E2E timing verification (CLOUD-03, DASH-04) -- DOCUMENTED
- Architecture analysis confirms sub-10-second timing:
  - CLI upload is synchronous (all API calls complete before "Uploaded successfully" prints)
  - SWR fetches fresh data on page mount
  - D1 is strongly consistent for reads-after-writes
- Live verification requires deployed route fixes + token

## Requirements Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| CLOUD-03 | Code complete | Route mismatches fixed; live E2E requires redeployment + token |
| DASH-04 | Code complete | Dashboard fetch URLs aligned with cloud routes; needs redeployment to verify |

## Manual Verification Steps (post-deployment)

1. **Redeploy Cloud API:** `cd packages/cloud && npx wrangler deploy`
2. **Obtain token:** Open `https://api.kindlm.com/auth/github` in browser, complete OAuth, copy `klm_` token
3. **Run E2E:**
   ```bash
   mkdir -p /tmp/kindlm-e2e && cd /tmp/kindlm-e2e
   # Create minimal kindlm.yaml (see plan Task 2)
   OPENAI_API_KEY=sk-... npx @kindlm/cli test
   KINDLM_API_TOKEN=klm_... npx @kindlm/cli upload -p "e2e-upload-test"
   ```
4. **Verify dashboard:** Open `https://kindlm-dashboard.pages.dev/projects`, confirm project and run appear
5. **Redeploy dashboard:** `NEXT_PUBLIC_API_URL=https://api.kindlm.com npx turbo run build --filter=@kindlm/dashboard && npx wrangler pages deploy packages/dashboard/out --project-name=kindlm-dashboard`

## Files Modified

- `packages/cloud/src/routes/runs.ts` (split into projectRunRoutes + runRoutes)
- `packages/cloud/src/routes/suites.ts` (split into projectSuiteRoutes + suiteRoutes)
- `packages/cloud/src/index.ts` (new route mounting + CORS origin)
- `packages/cloud/src/routes/runs.test.ts` (updated mount points + URLs)
- `packages/cloud/src/routes/results.test.ts` (updated mount point + URLs)
- `packages/cloud/src/routes/suites.test.ts` (updated mount point + URLs)
- `packages/dashboard/app/projects/[projectId]/runs/[runId]/RunDetailClient.tsx` (fixed results fetch URL)
