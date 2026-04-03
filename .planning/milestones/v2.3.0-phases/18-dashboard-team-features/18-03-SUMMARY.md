---
phase: 18-dashboard-team-features
plan: "03"
subsystem: dashboard
tags: [dashboard, run-comparison, test-detail, drill-down, expandable-rows]
dependency_graph:
  requires: [18-01]
  provides: [run-comparison-page, expandable-result-rows]
  affects: [ResultGrid, ComparisonView]
tech_stack:
  added: []
  patterns: [useSearchParams with Suspense wrapper, inline row expansion with useState]
key_files:
  created:
    - packages/dashboard/app/projects/[projectId]/runs/compare/page.tsx
    - packages/dashboard/app/projects/[projectId]/runs/compare/ComparePageClient.tsx
  modified:
    - packages/dashboard/components/ResultGrid.tsx
decisions:
  - "Wrap CompareContent in Suspense because useSearchParams requires it in Next.js App Router"
  - "Map RunComparisonData to ComparisonData (hasBaseline: true) to reuse ComparisonView without modification"
  - "Use != null check for toolCalls (unknown type) instead of truthy check to satisfy TypeScript strict mode"
metrics:
  duration: "15 minutes"
  completed: "2026-04-03"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 18 Plan 03: Run Comparison and Test Detail Drill-Down Summary

Run comparison page and expandable test detail rows giving teams diagnostic depth beyond the run list.

## What Was Built

**Task 1 — Run comparison page**

New route `/projects/[projectId]/runs/compare?runA=X&runB=Y` with two files:

- `page.tsx` — thin server component wrapping the client component
- `ComparePageClient.tsx` — client component reading `runA`/`runB` from `useSearchParams`, fetching from `/v1/compare/${runA}/compare/${runB}`, mapping to `ComparisonData` shape, and rendering `ComparisonView` unchanged

The `RunComparisonData` from Plan 01 is mapped to `ComparisonData` with `hasBaseline: true` and no `baseline` field — `ComparisonView` renders the baseline info section only when `data.baseline` exists, so the column headers "Baseline" / "Current" label run A vs run B naturally.

**Task 2 — Expandable test detail rows**

`ResultGrid` now has clickable rows that toggle inline expansion. The `ResultDetailExpanded` sub-component shows:

- Assertion outcomes with green/red dot indicators and score percentages
- Tool calls as formatted JSON in a scrollable `<pre>` block
- Model response truncated to 500 chars with "Show full response" / "Show less" toggle
- Failure messages in a red box
- Empty state when no detail data is present

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict-mode error on unknown type in JSX**
- **Found during:** TypeScript verification after Task 2
- **Issue:** `{toolCalls && (...)}` failed with "Type 'unknown' is not assignable to type 'ReactNode'" because `parseJson` returns `unknown`
- **Fix:** Changed to `{toolCalls != null && (...)}` which TypeScript accepts as a boolean guard
- **Files modified:** packages/dashboard/components/ResultGrid.tsx
- **Commit:** aeb7a21

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 5e8fe0b | feat(18-03): add run comparison page with ComparePageClient |
| 2 | aeb7a21 | feat(18-03): add expandable test detail rows to ResultGrid |

## Self-Check

Files created:
- packages/dashboard/app/projects/[projectId]/runs/compare/page.tsx — FOUND
- packages/dashboard/app/projects/[projectId]/runs/compare/ComparePageClient.tsx — FOUND

TypeScript: passes `npx tsc --noEmit` with zero errors.

## Self-Check: PASSED
