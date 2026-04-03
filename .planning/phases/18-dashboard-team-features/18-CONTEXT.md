# Phase 18: Dashboard Team Features - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver run history with filtering, trend charts (pass rate + cost over time), run-to-run comparison, and test detail drill-down in the existing Next.js dashboard. Also add two new Cloud API endpoints: trends aggregation and run comparison.

This phase does NOT add new dashboard pages beyond what's needed (no settings changes, no new auth flows, no real-time features).

</domain>

<decisions>
## Implementation Decisions

### Run History Filtering
- **D-01:** Inline filter bar above the existing RunTable — branch dropdown, suite dropdown, date range picker. No sidebar or modal.
- **D-02:** Filters persist in URL query params (branch, suite, dateFrom, dateTo) for shareable links and browser navigation.
- **D-03:** Cloud API `GET /v1/projects/:id/runs` extended with optional `branch`, `suite`, `dateFrom`, `dateTo` query params.

### Trend Charts
- **D-04:** Use `recharts` library (add as dashboard dependency). Required by DASH-03.
- **D-05:** Single chart with dual Y-axes — pass rate (left, 0-100%) and cost (right, USD). Two lines on one chart, not separate charts.
- **D-06:** Default view: last 30 runs. Cloud API provides day-bucketed aggregation via new `GET /v1/projects/:id/runs/trends` endpoint.
- **D-07:** All chart components wrapped in `dynamic(() => import(), { ssr: false })` per DASH-07.

### Run Comparison
- **D-08:** Users select two runs via checkboxes in the run history table. A "Compare" button appears when exactly 2 runs are selected.
- **D-09:** Extend existing `ComparisonView` component to work with arbitrary run pairs (currently baseline-only). New route: `/projects/[projectId]/runs/compare?runA=X&runB=Y`.
- **D-10:** Cloud API: new `GET /v1/runs/:id/compare/:otherId` endpoint returns per-test status diffs between two arbitrary runs.

### Test Detail Drill-Down
- **D-11:** Expandable rows in `ResultGrid` — clicking a test result row expands inline to show assertion outcomes, tool calls JSON, and model response.
- **D-12:** Model response truncated to ~500 chars with "Show full response" toggle. Tool calls shown as formatted JSON.
- **D-13:** No separate page for test detail — inline expansion keeps navigation simple and avoids extra routing.

### Claude's Discretion
- Chart color scheme (as long as it's accessible and consistent with stone palette)
- Loading skeleton design for chart components
- Exact filter bar layout/spacing
- Empty state messaging for filtered results with no matches

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Dashboard (existing code to understand/extend)
- `packages/dashboard/app/projects/[projectId]/runs/RunsPageClient.tsx` — Current runs page with pagination (extend with filters + trend chart)
- `packages/dashboard/app/projects/[projectId]/runs/[runId]/RunDetailClient.tsx` — Current run detail page
- `packages/dashboard/app/projects/[projectId]/runs/[runId]/compare/CompareClient.tsx` — Current baseline comparison page (adapt for run-to-run)
- `packages/dashboard/components/RunTable.tsx` — Run list table (add checkbox column + filter bar)
- `packages/dashboard/components/ComparisonView.tsx` — Diff table component (extend for arbitrary run pairs)
- `packages/dashboard/components/ResultGrid.tsx` — Test results table (add expandable rows)
- `packages/dashboard/components/RunDetail.tsx` — Run detail with metrics (reference for patterns)
- `packages/dashboard/lib/api.ts` — API client, types, SWR fetcher (add new types + endpoints)

### Cloud API (existing routes to extend)
- `packages/cloud/src/routes/runs.ts` — Runs CRUD (add filter params to list, add trends endpoint)
- `packages/cloud/src/routes/compare.ts` — Baseline comparison (reference for run-to-run comparison)
- `packages/cloud/src/db/queries.ts` — D1 query helpers (add trends aggregation + run comparison queries)
- `packages/cloud/src/validation.ts` — Zod request validation (add validation for new params)

### Requirements
- `.planning/REQUIREMENTS.md` — DASH-01 through DASH-10 requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RunTable` component: table with Status/Pass Rate/Tests/Branch/Commit/Date columns — extend with checkbox column and filter bar
- `ComparisonView` component: full diff table with regression/improvement/unchanged/new/removed status coloring — adapt from baseline-only to any two runs
- `ResultGrid` component: test results table with assertion mini-bar visualization — extend with expandable detail rows
- `MetricCard` component: consistent metric display — reuse for trend summary cards
- `Badge` component: status badges (passed/failed/running) — reuse as-is
- `EmptyState` component: empty state with CTA — reuse for empty filtered results
- `apiClient` + `fetcher` + SWR pattern: established data fetching pattern — follow for new endpoints

### Established Patterns
- Tailwind with stone color palette, rounded-xl borders, divide-y for table rows
- `"use client"` components with `Suspense` fallback for loading states
- SWR for client-side data fetching with typed fetcher
- Pagination via URL query params (page number)
- Static export build (`next build` + `cp out/index.html out/404.html`)

### Integration Points
- Run history page (`RunsPageClient.tsx`) — primary integration point for filters and trend chart
- Cloud API Hono router (`index.ts`) — mount new routes
- D1 database — new SQL queries for trends aggregation and run comparison
- `lib/api.ts` — new TypeScript interfaces for trends data and comparison response

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing dashboard patterns and stone color palette.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 18-dashboard-team-features*
*Context gathered: 2026-04-03*
