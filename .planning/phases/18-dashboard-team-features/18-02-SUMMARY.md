---
phase: 18-dashboard-team-features
plan: "02"
subsystem: ui
tags: [recharts, next.js, dashboard, react, swr, filtering, charts]

requires:
  - phase: 18-01
    provides: "Trends API endpoint, filter params on runs list, run-to-run compare route, TrendPoint type in api.ts"

provides:
  - "RunFilterBar component: branch/suite/date range filters with URL param persistence"
  - "TrendChart component: dynamic import wrapper (ssr: false) over TrendChartInner"
  - "TrendChartInner component: recharts dual Y-axis line chart (pass rate + cost over time)"
  - "RunTable enhanced: checkbox column, duration column, optional selection props"
  - "RunsPageClient wired: filters in SWR key, trends SWR fetch, suites SWR fetch, compare navigation"

affects: [dashboard, ui, runs-page]

tech-stack:
  added: [recharts]
  patterns:
    - "Dynamic import with ssr: false for recharts components to prevent Next.js SSR crash"
    - "URL param synchronization for shareable filter links (useSearchParams + router.push)"
    - "Optional props with defaults for backward-compatible component extension"

key-files:
  created:
    - packages/dashboard/components/TrendChartInner.tsx
    - packages/dashboard/components/TrendChart.tsx
    - packages/dashboard/components/RunFilterBar.tsx
  modified:
    - packages/dashboard/components/RunTable.tsx
    - packages/dashboard/app/projects/[projectId]/runs/RunsPageClient.tsx
    - packages/dashboard/package.json

key-decisions:
  - "RunTable selectedRunIds/onToggleRun made optional with defaults — preserves backward compatibility with ProjectPageClient usage"
  - "dynamic import ssr: false wraps recharts to avoid window undefined errors in Next.js SSR"

patterns-established:
  - "Filter state lives in URL params — not React state — for shareability and browser back/forward"
  - "Branches extracted from current page's run data; suites fetched from dedicated suites endpoint"

requirements-completed:
  - DASH-01
  - DASH-02
  - DASH-03
  - DASH-04
  - DASH-05
  - DASH-07
  - DASH-08

duration: 8min
completed: 2026-04-03
---

# Phase 18 Plan 02: Run History Filtering, Trend Chart, and Run Comparison Summary

**Recharts dual Y-axis trend chart with ssr: false, URL-persisted filter bar, duration column, and checkbox-driven run comparison selection wired into the runs page**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-03T09:00:00Z
- **Completed:** 2026-04-03T09:08:00Z
- **Tasks:** 2 (+ 1 checkpoint auto-approved)
- **Files modified:** 5

## Accomplishments

- TrendChartInner renders a dual Y-axis recharts LineChart: pass rate (left axis, %) and cost (right axis, $)
- TrendChart wraps TrendChartInner with `dynamic(() => import(), { ssr: false })` preventing Next.js SSR crash
- RunFilterBar syncs branch/suite/date filters to URL params; resets page=1 on filter change; Clear filters button
- RunTable gains checkbox column (first) and Duration column (formatted from startedAt/finishedAt)
- RunsPageClient wires filters into SWR key, fetches trends and suites in parallel, shows Compare button when exactly 2 runs selected

## Task Commits

1. **Task 1: Install recharts, create TrendChart and RunFilterBar** - `c8cb65e` (feat)
2. **Task 2: Enhance RunTable + wire RunsPageClient** - `c632252` (feat)
3. **Task 3: Checkpoint — auto-approved** (no commit, verification only)

## Files Created/Modified

- `packages/dashboard/components/TrendChartInner.tsx` — Recharts LineChart with dual Y-axis
- `packages/dashboard/components/TrendChart.tsx` — Dynamic import wrapper (ssr: false)
- `packages/dashboard/components/RunFilterBar.tsx` — Branch/suite/date filter bar with URL persistence
- `packages/dashboard/components/RunTable.tsx` — Added checkbox column, duration column, optional selection props
- `packages/dashboard/app/projects/[projectId]/runs/RunsPageClient.tsx` — Wired filters, trends, suites SWR, compare navigation
- `packages/dashboard/package.json` — Added recharts dependency

## Decisions Made

- **RunTable optional props:** Made `selectedRunIds` and `onToggleRun` optional with defaults so `ProjectPageClient` (which uses RunTable in read-only mode for recent runs) doesn't need to be updated.
- **ssr: false pattern:** recharts uses browser APIs unavailable in SSR; wrapping with `dynamic` and `ssr: false` is the standard Next.js solution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made RunTable selection props optional**
- **Found during:** Task 2 (TypeScript type check)
- **Issue:** `ProjectPageClient` uses `<RunTable runs={runs} projectId={projectId} />` without selection props — plan didn't account for this existing usage
- **Fix:** Changed `selectedRunIds` and `onToggleRun` to optional; added `?.(run.id)` call guard
- **Files modified:** packages/dashboard/components/RunTable.tsx
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** c632252 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential fix for backward compatibility. No scope creep.

## Issues Encountered

None beyond the RunTable backward compatibility issue above.

## Known Stubs

None — all components are wired to real API data via SWR.

## Next Phase Readiness

- All run history page requirements (DASH-01 through DASH-08) complete
- Compare page route (`/projects/:id/runs/compare?runA=X&runB=Y`) is navigated to but not yet implemented (phase 18-03 or future plan)
- Dashboard builds without SSR crashes (recharts uses ssr: false)

---
*Phase: 18-dashboard-team-features*
*Completed: 2026-04-03*
