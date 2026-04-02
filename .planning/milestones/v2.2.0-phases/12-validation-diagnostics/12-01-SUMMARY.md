---
phase: 12-validation-diagnostics
plan: "01"
subsystem: core/config
tags: [validation, error-messages, dx]
dependency_graph:
  requires: []
  provides: [VAL-01, VAL-02]
  affects: [packages/core/src/config/schema.ts]
tech_stack:
  added: []
  patterns: [formatZodPath helper, bracket-notation array path formatting]
key_files:
  created: []
  modified:
    - packages/core/src/config/schema.ts
    - packages/core/src/config/schema.test.ts
decisions:
  - formatZodPath exported for direct testability (no linting rule against it)
  - Test via both direct export and validateConfig output for full coverage
metrics:
  duration: ~5 minutes
  completed: "2026-04-02"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
---

# Phase 12 Plan 01: Zod Validation Error Bracket Notation Summary

**One-liner:** `formatZodPath` helper converts numeric Zod path segments to bracket notation, fixing `tests[2].expect.judge[0].minScore` vs the old ambiguous `tests.2.expect.judge.0.minScore`.

## What Was Built

Added `formatZodPath(path: (string | number)[]): string` as an exported helper in `schema.ts`. Updated `validateConfig` to use it when mapping Zod issues to error strings. Added 5 `formatZodPath` unit tests and 1 end-to-end `validateConfig` path-format test.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add formatZodPath helper and update validateConfig | 180e4c7 | schema.ts, schema.test.ts |

## Decisions Made

- **Export `formatZodPath`:** Exported for direct unit testability. No linting rule prohibits it. Allows tests to cover all path variants independently of full config fixture setup.
- **Test approach:** Both direct unit tests (5 cases) and one end-to-end `validateConfig` test that asserts bracket notation appears in live error output.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `packages/core/src/config/schema.ts` — FOUND (contains `formatZodPath`)
- `packages/core/src/config/schema.test.ts` — FOUND (contains bracket notation tests)
- Commit `180e4c7` — FOUND
- `npx vitest run packages/core/src/config/schema.test.ts` — 25/25 tests passed
- `npm run typecheck` — 4/4 tasks successful
