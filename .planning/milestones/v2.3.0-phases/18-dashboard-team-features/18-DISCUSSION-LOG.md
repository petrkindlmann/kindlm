# Phase 18: Dashboard Team Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 18-dashboard-team-features
**Areas discussed:** Run history filtering UX, Trend chart design, Run comparison flow, Test detail drill-down depth
**Mode:** Auto (all recommended defaults selected)

---

## Run History Filtering UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline filter bar | Filter controls above the table — branch dropdown, suite dropdown, date range | ✓ |
| Sidebar filters | Collapsible sidebar panel with filter options | |
| Modal/dialog filters | Filter popup triggered by a filter button | |

**User's choice:** [auto] Inline filter bar (recommended — consistent with existing table-first layout)

| Option | Description | Selected |
|--------|-------------|----------|
| URL query params | Filters persist in URL for sharing and browser nav | ✓ |
| Local state only | Filters reset on page reload | |

**User's choice:** [auto] URL query params (recommended — enables shareable filtered views)

---

## Trend Chart Design

| Option | Description | Selected |
|--------|-------------|----------|
| recharts | Lightweight React-native charting library | ✓ |
| chart.js + react-chartjs-2 | Canvas-based, heavier bundle | |
| visx | Low-level D3 wrapper, more flexible but more work | |

**User's choice:** [auto] recharts (recommended — explicitly required by DASH-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Dual Y-axis single chart | Pass rate + cost as two lines on one chart | ✓ |
| Separate charts | Two stacked charts, one for pass rate, one for cost | |

**User's choice:** [auto] Dual Y-axis single chart (recommended — matches DASH-03/04 "secondary line" description)

| Option | Description | Selected |
|--------|-------------|----------|
| Last 30 runs | Default view shows last 30 runs | ✓ |
| Last 7 days | Time-based default window | |
| Last 50 runs | Larger default window | |

**User's choice:** [auto] Last 30 runs (recommended — matches DASH-03 spec)

---

## Run Comparison Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox selection | Checkboxes in run table, "Compare" button when 2 selected | ✓ |
| Dropdown selectors | Two dropdowns on a dedicated comparison page | |
| Side-by-side cards | Click two run cards to compare | |

**User's choice:** [auto] Checkbox selection (recommended — most intuitive for "selecting two runs" in table context)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend ComparisonView | Adapt existing component from baseline-only to arbitrary pairs | ✓ |
| New comparison component | Build fresh component for run-to-run comparison | |

**User's choice:** [auto] Extend ComparisonView (recommended — component already handles diff table with status coloring)

---

## Test Detail Drill-Down

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable rows | Click row to expand inline with assertions, tool calls, response | ✓ |
| Separate detail page | Navigate to /runs/:id/results/:id for full detail | |
| Slide-over panel | Side panel slides in from right with detail | |

**User's choice:** [auto] Expandable rows (recommended — keeps navigation simple, avoids extra routing)

| Option | Description | Selected |
|--------|-------------|----------|
| Truncated with toggle | ~500 chars with "Show full response" button | ✓ |
| Always full | Show complete model response | |
| Collapsible accordion | Separate collapsible sections for each part | |

**User's choice:** [auto] Truncated with toggle (recommended — model responses can be very long)

---

## Claude's Discretion

- Chart color scheme (accessible, consistent with stone palette)
- Loading skeleton design for chart components
- Exact filter bar layout/spacing
- Empty state messaging for filtered results

## Deferred Ideas

None — discussion stayed within phase scope.
