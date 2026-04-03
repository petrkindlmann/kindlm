# Phase 18: Dashboard Team Features - Research

**Researched:** 2026-04-03
**Domain:** Next.js 15 dashboard + Recharts + Cloudflare Workers (Hono/D1) API extensions
**Confidence:** HIGH

## Summary

This phase extends the existing KindLM Next.js dashboard with run history filtering, trend charts, run-to-run comparison, and test detail drill-down. The codebase is well-structured and all required extension points exist. No new pages are needed for detail drill-down (inline expansion) but one new route is needed for run comparison.

On the Cloud API side, two new endpoints must be added: `GET /v1/projects/:id/runs/trends` (day-bucketed aggregation) and `GET /v1/runs/:id/compare/:otherId` (arbitrary run pair diff). Both follow patterns already established in `runs.ts` and `compare.ts`.

Recharts 3.8.1 is the current stable version. It must be added as a dashboard dependency. All chart components must use `next/dynamic` with `ssr: false` because the dashboard is a static export (`output: "export"`) — SSR-incompatible SVG/DOM APIs inside recharts will crash the build without it.

**Primary recommendation:** Follow the established SWR + fetcher pattern for data fetching, extend existing components rather than replacing them, and wrap all recharts components in `dynamic(() => import(...), { ssr: false })`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Inline filter bar above the existing RunTable — branch dropdown, suite dropdown, date range picker. No sidebar or modal.
- **D-02:** Filters persist in URL query params (branch, suite, dateFrom, dateTo) for shareable links and browser navigation.
- **D-03:** Cloud API `GET /v1/projects/:id/runs` extended with optional `branch`, `suite`, `dateFrom`, `dateTo` query params.
- **D-04:** Use `recharts` library (add as dashboard dependency). Required by DASH-03.
- **D-05:** Single chart with dual Y-axes — pass rate (left, 0-100%) and cost (right, USD). Two lines on one chart, not separate charts.
- **D-06:** Default view: last 30 runs. Cloud API provides day-bucketed aggregation via new `GET /v1/projects/:id/runs/trends` endpoint.
- **D-07:** All chart components wrapped in `dynamic(() => import(), { ssr: false })` per DASH-07.
- **D-08:** Users select two runs via checkboxes in the run history table. A "Compare" button appears when exactly 2 runs are selected.
- **D-09:** Extend existing `ComparisonView` component to work with arbitrary run pairs (currently baseline-only). New route: `/projects/[projectId]/runs/compare?runA=X&runB=Y`.
- **D-10:** Cloud API: new `GET /v1/runs/:id/compare/:otherId` endpoint returns per-test status diffs between two arbitrary runs.
- **D-11:** Expandable rows in `ResultGrid` — clicking a test result row expands inline to show assertion outcomes, tool calls JSON, and model response.
- **D-12:** Model response truncated to ~500 chars with "Show full response" toggle. Tool calls shown as formatted JSON.
- **D-13:** No separate page for test detail — inline expansion keeps navigation simple and avoids extra routing.

### Claude's Discretion
- Chart color scheme (as long as it's accessible and consistent with stone palette)
- Loading skeleton design for chart components
- Exact filter bar layout/spacing
- Empty state messaging for filtered results with no matches

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DASH-01 | Run history page shows paginated list of runs with pass rate, duration, git branch, commit, date | `RunTable` already has most columns; `duration_ms` is available via `finishedAt - startedAt`; pagination exists in `RunsPageClient.tsx` |
| DASH-02 | Run history supports filtering by branch, suite name, and date range | Cloud `listRuns` query needs branch/dateFrom/dateTo params added; suite filter exists as `suiteId`; URL param pattern established |
| DASH-03 | Trend chart shows pass rate over time as a line chart (recharts, last 30 runs by default) | Recharts 3.8.1 available; new `/v1/projects/:id/runs/trends` endpoint needed; must use `dynamic` with `ssr: false` |
| DASH-04 | Trend chart shows cost over time as a secondary line | `costEstimateUsd` field on `Run` type; dual Y-axis via recharts `YAxis yAxisId` prop |
| DASH-05 | Run comparison page shows side-by-side diff of two runs highlighting which tests changed status | `ComparisonView` component handles diff display; new `/v1/runs/:id/compare/:otherId` endpoint; new compare route in dashboard |
| DASH-06 | Test detail drill-down shows assertion results, tool calls, and model response for a specific test | `assertionScores` JSON string already on `TestResult`; need to store/expose `responseText` and `toolCallsJson` fields — check if already in DB |
| DASH-07 | All chart components use `dynamic(() => import(), { ssr: false })` to prevent SSR crashes | Static export build (`output: "export"`) confirmed — SSR protection required; `next/dynamic` is the standard pattern |
| DASH-08 | Dashboard API returns UTC timestamps; date bucketing happens client-side with user's timezone | All timestamps in D1 are ISO strings (UTC); client-side `new Date()` / `Intl.DateTimeFormat` for bucketing |
| DASH-09 | Cloud API supports `GET /v1/projects/:id/runs/trends` endpoint with day-bucketed aggregation | New D1 query; SQL `strftime('%Y-%m-%d', created_at)` for day grouping; AVG(pass_rate), SUM(cost_estimate_usd) per day |
| DASH-10 | Cloud API supports `GET /v1/runs/:id/compare/:otherId` endpoint for run comparison data | Extend compare.ts pattern; load results for both run IDs, apply same diff logic as baseline compare |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 | Line/area charts, dual Y-axis | Locked in D-04; React-native SVG charts; 24k stars; works with static export |
| next/dynamic | built-in (Next.js 15.2) | Client-only chart loading | Required for `ssr: false` in static export builds |
| swr | 2.2.x | Data fetching + caching | Already used across all dashboard pages |
| hono | existing | Cloud API router | Already in use; add new routes following existing pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| useSearchParams / useRouter | built-in (Next.js) | URL query param filter state | Filter bar state management per D-02 |

**Installation (dashboard only):**
```bash
cd packages/dashboard && npm install recharts
```

**Version verification:** recharts@3.8.1 confirmed via `npm view recharts version` on 2026-04-03.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
packages/dashboard/
├── app/projects/[projectId]/runs/
│   ├── RunsPageClient.tsx         # EXTEND: add filter bar + trend chart + checkboxes
│   └── compare/
│       └── page.tsx               # NEW: /projects/[projectId]/runs/compare?runA=X&runB=Y
│       └── ComparePageClient.tsx  # NEW: loads both run IDs, shows ComparisonView
├── components/
│   ├── RunTable.tsx               # EXTEND: checkbox column + duration column
│   ├── RunFilterBar.tsx           # NEW: branch/suite/dateRange dropdowns
│   ├── TrendChart.tsx             # NEW: recharts LineChart (client-only via dynamic)
│   ├── ComparisonView.tsx         # EXTEND: accept arbitrary runA/runB (not baseline-only)
│   └── ResultGrid.tsx             # EXTEND: expandable rows with inline detail
└── lib/
    └── api.ts                     # EXTEND: TrendPoint, RunComparisonData types + fetcher paths

packages/cloud/src/
├── routes/
│   ├── runs.ts                    # EXTEND: filter params on list; add trends sub-route
│   └── compare.ts                 # EXTEND: add /:runId/compare/:otherId route
├── db/queries/testing.ts          # EXTEND: listRunsFiltered, getTrends, compareRuns queries
└── validation.ts                  # EXTEND: trends + compare query param schemas
```

### Pattern 1: Dynamic chart import (no-SSR)

**What:** Wrap recharts components in `next/dynamic` to prevent static export build crash.

**When to use:** Every file that imports any recharts component.

```typescript
// packages/dashboard/components/TrendChart.tsx
"use client";
import dynamic from "next/dynamic";

const TrendChartInner = dynamic(() => import("./TrendChartInner"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-stone-100" />,
});

export default function TrendChart(props: TrendChartProps) {
  return <TrendChartInner {...props} />;
}
```

The inner component holds all recharts imports. The outer wrapper is what pages import.

### Pattern 2: Filter state in URL params (established pattern)

**What:** Read/write filters via `useSearchParams` + `useRouter.push`. Same pattern as existing page param.

```typescript
// Inside RunsPageClient RunsContent()
const branch = searchParams.get("branch") ?? undefined;
const suite = searchParams.get("suite") ?? undefined;
const dateFrom = searchParams.get("dateFrom") ?? undefined;
const dateTo = searchParams.get("dateTo") ?? undefined;

// Build SWR key with all active filters
const query = new URLSearchParams({ limit: String(PER_PAGE), offset: String(offset) });
if (branch) query.set("branch", branch);
if (suite) query.set("suite", suite);
if (dateFrom) query.set("dateFrom", dateFrom);
if (dateTo) query.set("dateTo", dateTo);

const { data } = useSWR(`/v1/projects/${projectId}/runs?${query}`, fetcher);
```

### Pattern 3: Checkbox selection for run comparison

**What:** Local component state for selected run IDs; "Compare" button rendered when exactly 2 are selected.

```typescript
const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());

// In RunTable: add checkbox column
// compare button:
{selectedRunIds.size === 2 && (
  <button onClick={() => router.push(
    `/projects/${projectId}/runs/compare?runA=${[...selectedRunIds][0]}&runB=${[...selectedRunIds][1]}`
  )}>
    Compare selected
  </button>
)}
```

### Pattern 4: Expandable ResultGrid rows

**What:** Local state tracks which row IDs are expanded; expanded row renders assertion detail inline.

```typescript
const [expandedId, setExpandedId] = useState<string | null>(null);

// In tbody: after each result row, render a conditional expansion row
{expandedId === result.id && (
  <tr>
    <td colSpan={6} className="bg-stone-50 px-4 py-4">
      <ResultDetailExpanded result={result} />
    </td>
  </tr>
)}
```

### Pattern 5: Cloud API trends query (D1 SQL)

**What:** Day-bucketed aggregation using SQLite `strftime`.

```sql
SELECT
  strftime('%Y-%m-%d', created_at) AS day,
  AVG(pass_rate) AS avg_pass_rate,
  SUM(cost_estimate_usd) AS total_cost_usd,
  COUNT(*) AS run_count
FROM runs
WHERE project_id = ?
  AND status = 'completed'
  AND created_at >= datetime('now', '-90 days')
ORDER BY day DESC
LIMIT 30
```

Returns rows ordered oldest-first on the client by reversing the array.

### Pattern 6: Arbitrary run comparison endpoint

**What:** New `GET /v1/runs/:runId/compare/:otherId` — same diff logic as baseline compare but both run IDs are explicit parameters.

```typescript
// In compare.ts — add alongside existing /:runId/compare route
compareRoutes.get("/:runId/compare/:otherId", async (c) => {
  const runId = c.req.param("runId");
  const otherId = c.req.param("otherId");
  // auth check on both runs (same org)
  // load results for both, apply identical diff logic
  // return { summary, diffs } (no baseline field needed)
});
```

### Anti-Patterns to Avoid

- **Importing recharts at module top level in a page component:** causes static export build to fail with "ReferenceError: window is not defined". Always use `next/dynamic` wrapper.
- **Storing filter state in useState (not URL params):** breaks browser back-navigation and shareability. D-02 locks this.
- **Fetching trends data with the full run list:** trends endpoint is a separate aggregation query, not derived from the paginated list response.
- **Putting response text / tool calls JSON in the `TestResult` type returned by the list endpoint:** these are potentially large; keep them in the existing `assertionScores` field for summary data, and check what's already stored before adding new columns.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Line charts with dual Y-axis | Custom SVG chart | recharts `LineChart` + dual `YAxis` | recharts handles SVG, responsive container, tooltips, legends |
| Date formatting/bucketing | Custom strftime | `Intl.DateTimeFormat` + `new Date()` | DASH-08 mandates client-side bucketing with user timezone |
| Diff computation (run comparison) | New diff algorithm | Copy existing logic from `compare.ts` | Logic is identical; duplicate with minimal adaptation |
| Checkbox multi-select pattern | Complex state machine | `useState<Set<string>>` | Simple local state is sufficient; no need for external state |

---

## Critical Finding: TestResult responseText / toolCallsJson Fields

DASH-06 requires showing model response text and tool calls in the expanded row. The `TestResult` DB schema and TypeScript type must be checked:

- `assertionScores` is stored as JSON string — this covers assertion detail.
- `failureMessages` is stored as JSON string — covers failure reasons.
- **`responseText` (model response) and `toolCallsJson` (raw tool calls) columns:** these fields do NOT exist in the current `TestResult` schema in `testing.ts` or `api.ts`. The D1 `test_results` table (from CLAUDE.md) shows `assertions_json`, `response_text`, and `tool_calls_json` columns, but the current `mapTestResult` function in `testing.ts` does NOT map `response_text` or `tool_calls_json`.

**Action required (Wave 0):**
1. Confirm the D1 `test_results` table actually has `response_text` and `tool_calls_json` columns (from the schema in CLAUDE.md — HIGH confidence they exist).
2. Add `responseText` and `toolCallsJson` to `mapTestResult` in `testing.ts`.
3. Add these fields to the `TestResult` type in `packages/cloud/src/types.ts` and `packages/dashboard/lib/api.ts`.
4. Include them in the `listResults` query result.

This is a prerequisite for DASH-06 and must be in Wave 1 (or a Wave 0 setup task).

---

## Common Pitfalls

### Pitfall 1: Recharts SSR crash in static export
**What goes wrong:** `ReferenceError: window is not defined` or `document is not defined` during `next build`.
**Why it happens:** Static export renders all components server-side during build. Recharts touches DOM APIs at module evaluation time.
**How to avoid:** Every recharts import must be behind `dynamic(() => import(...), { ssr: false })`. The `loading` prop provides the skeleton.
**Warning signs:** Build succeeds in dev (`next dev`) but fails during `next build`.

### Pitfall 2: SWR key collisions with pagination + filters
**What goes wrong:** Changing a filter while on page 2 shows stale page 2 data from before the filter changed.
**Why it happens:** SWR key includes `offset` but not all filter params, so old cached response is served.
**How to avoid:** Build the full query string (all active params including page) as the SWR key. Reset to page 1 when any filter changes.

### Pitfall 3: Date range filters with UTC vs local time
**What goes wrong:** `dateFrom=2026-04-01` filters out runs created on April 1 in user's timezone because they were stored as UTC timestamps an hour or more earlier.
**Why it happens:** D1 stores ISO UTC. A date string `2026-04-01` without time component may be interpreted as midnight UTC.
**How to avoid:** DASH-08 mandates UTC API / client-side bucketing. For filter inputs, accept date-only strings and convert to UTC midnight range on the server. Document this boundary.

### Pitfall 4: ComparisonView's `baseline` field assumption
**What goes wrong:** The existing `ComparisonData` type has a required `baseline` sub-object for run-to-run comparison response — but the new `compare/:otherId` endpoint has no baseline concept.
**Why it happens:** `ComparisonData` was designed for baseline-only comparison.
**How to avoid:** Create a new `RunComparisonData` type in `api.ts` for the run-to-run response (no `hasBaseline`, no `baseline` field). Create a new `RunComparisonView` component or adapt `ComparisonView` to accept a union. The simplest approach: a new lightweight component that reuses the same `DiffRow` rendering logic.

### Pitfall 5: recharts ResponsiveContainer height
**What goes wrong:** Chart renders with 0 height in some layouts.
**Why it happens:** `ResponsiveContainer` needs a parent with explicit height.
**How to avoid:** Wrap in a div with fixed height: `<div className="h-64"><ResponsiveContainer width="100%" height="100%">`.

---

## Code Examples

### TrendChart recharts dual-axis pattern
```typescript
// Source: recharts.org docs — ComposedChart with dual YAxis
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// data: Array<{ day: string; passRate: number; costUsd: number | null }>
<ResponsiveContainer width="100%" height="100%">
  <LineChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
    <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#78716c" }} />
    <YAxis yAxisId="left" domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: "#78716c" }} />
    <YAxis yAxisId="right" orientation="right" unit="$" tick={{ fontSize: 12, fill: "#78716c" }} />
    <Tooltip />
    <Legend />
    <Line yAxisId="left" type="monotone" dataKey="passRate" stroke="#6366f1" dot={false} name="Pass Rate" />
    <Line yAxisId="right" type="monotone" dataKey="costUsd" stroke="#84cc16" dot={false} name="Cost (USD)" />
  </LineChart>
</ResponsiveContainer>
```

### D1 trends query with day bucketing
```typescript
// In getTestingQueries (testing.ts)
async function getRunTrends(
  projectId: string,
  limit: number = 30,
): Promise<Array<{ day: string; avgPassRate: number | null; totalCostUsd: number | null; runCount: number }>> {
  const { results } = await db
    .prepare(`
      SELECT
        strftime('%Y-%m-%d', created_at) AS day,
        AVG(pass_rate) AS avg_pass_rate,
        SUM(cost_estimate_usd) AS total_cost_usd,
        COUNT(*) AS run_count
      FROM runs
      WHERE project_id = ? AND status = 'completed'
      GROUP BY day
      ORDER BY day DESC
      LIMIT ?
    `)
    .bind(projectId, limit)
    .all();
  return results.map((r) => ({
    day: r.day as string,
    avgPassRate: (r.avg_pass_rate as number) ?? null,
    totalCostUsd: (r.total_cost_usd as number) ?? null,
    runCount: r.run_count as number,
  }));
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| recharts v2 (React 16-18) | recharts v3 (React 19 compat) | 2024 | Import paths unchanged; no breaking changes for basic usage |
| Next.js pages router dynamic | App router `next/dynamic` | Next.js 13+ | Same API, works identically in app router |

---

## Environment Availability

Step 2.6: SKIPPED (no external tools beyond npm install recharts — no services, databases, or CLIs beyond existing project infra).

The only new external dependency is `recharts` as an npm package. It is not installed; Wave 0 plan task must add it.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| recharts | DASH-03, DASH-04 | Not installed | 3.8.1 (npm) | None — locked by D-04 |
| D1 (existing) | DASH-09, DASH-10 | Available | — | — |
| Next.js dynamic | DASH-07 | Available (Next 15.2) | built-in | — |

**Missing dependencies with no fallback:**
- `recharts` not yet in `packages/dashboard/package.json` — Wave 0 must add it.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test -- --project dashboard` (if configured) or `npx vitest run packages/dashboard` |
| Full suite command | `npm run test` |

Note: No test files currently exist in `packages/dashboard/`. All DASH requirements that are UI-only (React components) are difficult to unit-test without a browser environment. The planner should treat DASH validation as primarily manual smoke testing + TypeScript type checking, with unit tests only for the new Cloud API query functions.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Run list shows duration column | manual-only | — | N/A |
| DASH-02 | Filter params pass to API | unit | `npx vitest run packages/cloud/src/routes/runs.test.ts` | ❌ Wave 0 |
| DASH-03 | TrendChart renders without SSR crash | manual (build) | `cd packages/dashboard && npm run build` | N/A |
| DASH-04 | Cost line on trend chart | manual-only | — | N/A |
| DASH-05 | Run comparison diff shows correct statuses | unit | `npx vitest run packages/cloud/src/routes/compare.test.ts` | ❌ Wave 0 |
| DASH-06 | Drill-down shows assertion/tool/response data | manual-only | — | N/A |
| DASH-07 | No SSR crash with charts | build test | `cd packages/dashboard && npm run build` | N/A |
| DASH-08 | API returns UTC, client buckets | unit | `npx vitest run packages/cloud/src/routes/runs.test.ts` | ❌ Wave 0 |
| DASH-09 | Trends endpoint returns day-bucketed rows | unit | `npx vitest run packages/cloud/src/db/queries/testing.test.ts` | ❌ Wave 0 |
| DASH-10 | Compare endpoint returns diff for two run IDs | unit | `npx vitest run packages/cloud/src/routes/compare.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` across all packages
- **Per wave merge:** `npm run test && cd packages/dashboard && npm run build`
- **Phase gate:** Full suite green + dashboard build succeeds before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/cloud/src/routes/runs.test.ts` — covers DASH-02, DASH-08, DASH-09
- [ ] `packages/cloud/src/routes/compare.test.ts` — covers DASH-05, DASH-10
- Framework already installed (vitest root config); no install step needed.

---

## Open Questions

1. **`response_text` and `tool_calls_json` columns in D1**
   - What we know: CLAUDE.md schema shows these columns; `mapTestResult` in `testing.ts` does NOT map them currently; `assertionScores` is mapped.
   - What's unclear: Whether the columns have been added to the live D1 schema or only documented in CLAUDE.md. Also whether `kindlm upload` actually populates them.
   - Recommendation: Wave 1 plan task should add mapping + type additions, and include a note that if columns don't exist in D1, a migration `ALTER TABLE test_results ADD COLUMN response_text TEXT; ALTER TABLE test_results ADD COLUMN tool_calls_json TEXT;` is needed. Check `packages/cloud/src/db/migrations/` for existing migration files.

2. **Suite filter dropdown data source**
   - What we know: The filter bar needs a suite name dropdown. Suites are fetched via `GET /v1/projects/:id/suites`.
   - What's unclear: Whether a SWR call to fetch suite names for the dropdown will cause a waterfall load on the runs page.
   - Recommendation: Fetch suites in parallel with the runs list. Since both are small queries, no concern.

---

## Sources

### Primary (HIGH confidence)
- Code read: `packages/dashboard/` — all referenced components, pages, and lib/api.ts read directly
- Code read: `packages/cloud/src/routes/runs.ts`, `compare.ts`, `db/queries/testing.ts` — all read directly
- `npm view recharts version` — 3.8.1 confirmed live

### Secondary (MEDIUM confidence)
- recharts dual Y-axis pattern — from recharts documentation (standard API, no breaking changes in v3)
- Next.js `dynamic` with `ssr: false` — well-established Next.js pattern, verified working with `output: "export"`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — recharts version verified, Next.js dynamic pattern verified from code
- Architecture: HIGH — all extension points read directly from source; no guessing
- Pitfalls: HIGH — SSR crash risk confirmed by static export config; filter/URL pattern confirmed from existing code
- DASH-06 gap: MEDIUM — response_text column assumed present per CLAUDE.md schema but mapping not verified in live code

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (recharts is stable; Next.js 15 API stable)
