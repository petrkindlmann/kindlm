---
phase: 18
plan: "01"
subsystem: cloud-api
tags: [api, dashboard, d1, filters, trends, comparison]
dependency_graph:
  requires: []
  provides:
    - "GET /v1/projects/:id/runs with branch/dateFrom/dateTo filter params"
    - "GET /v1/projects/:id/runs/trends day-bucketed pass rate and cost"
    - "GET /v1/compare/:runId/compare/:otherId run-to-run diff endpoint"
    - "TrendPoint and RunComparisonData types in dashboard api.ts"
    - "D1 migration 0014 for response_text and tool_calls_json columns"
  affects:
    - packages/cloud/src/routes/runs.ts
    - packages/cloud/src/routes/compare.ts
    - packages/cloud/src/db/queries/testing.ts
    - packages/cloud/src/types.ts
    - packages/dashboard/lib/api.ts
tech_stack:
  added: []
  patterns:
    - "Hono subroute ordering — specific /trends route defined before /:runId wildcard"
    - "D1 ALTER TABLE migration for nullable columns"
key_files:
  created:
    - packages/cloud/migrations/0014_result_detail_columns.sql
  modified:
    - packages/cloud/src/types.ts
    - packages/cloud/src/db/queries/testing.ts
    - packages/cloud/src/routes/runs.ts
    - packages/cloud/src/routes/compare.ts
    - packages/cloud/src/validation.ts
    - packages/dashboard/lib/api.ts
decisions:
  - "Trends route registered before list runs route to prevent Hono from matching 'trends' as a runId path parameter"
  - "getRunTrends uses strftime('%Y-%m-%d', created_at) for UTC day bucketing — D1/SQLite datetime is UTC by default"
  - "Run-to-run compare treats runA (first param) as baseline, runB (second param) as current — consistent with existing baseline compare semantics"
metrics:
  duration: "8 minutes"
  completed: "2026-04-03"
  tasks: 2
  files_changed: 9
requirements:
  - DASH-02
  - DASH-03
  - DASH-04
  - DASH-06
  - DASH-08
  - DASH-09
  - DASH-10
---

# Phase 18 Plan 01: Cloud API Filters, Trends, and Run Comparison Summary

Extended Cloud API with filtered run listing, day-bucketed trend aggregation, and arbitrary run-to-run comparison — plus the D1 migration and dashboard types needed by plans 02 and 03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | D1 migration, types, filter queries, dashboard types | 9ddf310 | 7 files |
| 2 | Trends route, filter params on list runs, run-to-run compare | 8520e26 | 2 files |

## What Was Built

### D1 Migration (0014)
Two nullable columns added to the `results` table: `response_text TEXT` and `tool_calls_json TEXT`. These are ALTER TABLE migrations compatible with existing rows.

### Cloud Type Extensions
`TestResult` interface in `packages/cloud/src/types.ts` gains `responseText: string | null` and `toolCallsJson: string | null`.

### Query Functions
- `listRuns` extended to accept `branch`, `dateFrom`, `dateTo` optional filter parameters — each appends a WHERE clause only when provided.
- `getRunTrends(projectId, limit)` added — groups completed runs by UTC day using SQLite `strftime`, returns `avgPassRate`, `totalCostUsd`, `runCount` per day, ordered DESC with configurable limit (1–90).
- `createResults` updated to accept and INSERT `responseText` and `toolCallsJson` per result row.

### Cloud Routes
- `GET /v1/projects/:projectId/runs` now reads `branch`, `dateFrom`, `dateTo` query params and passes them through to `listRuns`.
- `GET /v1/projects/:projectId/runs/trends` is a new route — registered **before** the list route to avoid Hono wildcard collision. Returns `{ trends: TrendPoint[] }`.
- `GET /v1/compare/:runId/compare/:otherId` is a new route — performs auth checks on both runs (must be in same org), computes per-test diffs using the same regression/improvement/unchanged/new/removed logic as the baseline compare route, and returns `{ summary, diffs }`.

### Validation
`resultItem` Zod schema gains `responseText` and `toolCallsJson` as optional nullable string fields (max 100,000 chars each).

### Dashboard Types
`packages/dashboard/lib/api.ts` gains:
- `TrendPoint` — matches the shape returned by the trends endpoint
- `RunComparisonData` — matches the shape returned by the run-to-run compare endpoint (reuses `ResultDiff`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixtures missing new required fields**
- **Found during:** Task 1 typecheck
- **Issue:** `compare.test.ts` and `results.test.ts` had `TestResult` fixtures without `responseText`/`toolCallsJson` — TypeScript error TS2739 and TS2322
- **Fix:** Added `responseText: null, toolCallsJson: null` to both test fixtures
- **Files modified:** `packages/cloud/src/routes/compare.test.ts`, `packages/cloud/src/routes/results.test.ts`
- **Commit:** 9ddf310

## Known Stubs

None — all new fields are nullable and correctly wired from DB through types to routes.

## Self-Check: PASSED

- [x] `packages/cloud/migrations/0014_result_detail_columns.sql` exists
- [x] `packages/cloud/src/types.ts` — `responseText: string | null` present
- [x] `packages/cloud/src/db/queries/testing.ts` — `getRunTrends` exported
- [x] `packages/cloud/src/routes/runs.ts` — trends route and branch/dateFrom/dateTo params present
- [x] `packages/cloud/src/routes/compare.ts` — `otherId` param present
- [x] `packages/dashboard/lib/api.ts` — `TrendPoint` and `RunComparisonData` present
- [x] `npx tsc --noEmit` passes in cloud and dashboard packages
- [x] Commits 9ddf310 and 8520e26 exist
