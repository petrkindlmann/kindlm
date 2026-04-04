---
phase: 09-cli-utility-unit-tests
plan: 01
subsystem: testing
tags: [vitest, cli, spinner, ora, chalk, unit-tests]

requires:
  - phase: 08-worktree-file-copy
    provides: final implementations of dry-run.ts, select-reporter.ts, and spinner.ts

provides:
  - unit test coverage for formatTestPlan (dry-run.ts) — 8 tests
  - unit test coverage for selectReporter (select-reporter.ts) — 4 tests
  - unit test coverage for createSpinner (spinner.ts) — 8 tests

affects: [future phases modifying cli utilities]

tech-stack:
  added: []
  patterns:
    - "No chalk mocking in dry-run tests — use .toContain() on substrings with stripAnsi helper"
    - "process.exit mock via vi.spyOn with throw pattern — stops execution at exit call site"
    - "ora mocked at module level with vi.mock; shared mockInstance reset in beforeEach via vi.clearAllMocks()"

key-files:
  created:
    - packages/cli/src/utils/dry-run.test.ts
    - packages/cli/src/utils/select-reporter.test.ts
    - packages/cli/src/utils/spinner.test.ts
  modified: []

key-decisions:
  - "No chalk mocking in dry-run.test.ts — strip ANSI with regex helper and use .toContain() for substring assertions"
  - "process.exit mock throws Error('process.exit') to halt execution at call site and prevent confusing test state"
  - "ora mocked at module level via vi.mock('ora') with a shared mockInstance object reset per test via vi.clearAllMocks()"
  - "process.exit spyOn type widened to string | number | null to match Node.js overload — required for typecheck"

patterns-established:
  - "ANSI strip helper: stripAnsi = (s) => s.replace(/\\x1B\\[[0-9;]*m/g, '') — avoids chalk mock complexity"
  - "Shared mock instance pattern for vi.mock factory: define mockInstance outside factory, reset in beforeEach"

requirements-completed: [TEST-01, TEST-02, TEST-03]

duration: 7min
completed: 2026-04-02
---

# Phase 09 Plan 01: CLI Utility Unit Tests Summary

**Vitest unit tests for formatTestPlan, selectReporter, and createSpinner — completing v2.1.0 CLI test coverage with 20 new tests across 3 files**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-02T01:46:22Z
- **Completed:** 2026-04-02T01:53:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `dry-run.test.ts`: 8 tests covering output format, project/suite name, skip filtering, command label rendering, description, totals section, repeat multiplier, and tags
- `select-reporter.test.ts`: 4 tests covering pretty/json/junit reporter routing and unknown type error path (process.exit + console.error)
- `spinner.test.ts`: 8 tests covering ora delegation, no-op safety before start, and instance clearing after succeed/fail/stop

## Task Commits

1. **Task 1: dry-run and select-reporter tests** — `fefd2d9` (test)
2. **Task 2: spinner tests** — `7e17260` (test)
3. **Type fix: process.exit mock signature** — `722af0c` (fix)

## Files Created/Modified

- `packages/cli/src/utils/dry-run.test.ts` — 8 formatTestPlan tests with ANSI-strip helper
- `packages/cli/src/utils/select-reporter.test.ts` — 4 selectReporter tests with process.exit throw pattern
- `packages/cli/src/utils/spinner.test.ts` — 8 createSpinner tests with module-level ora mock

## Decisions Made

- No chalk mocking — ANSI is stripped with a one-liner regex helper; `.toContain()` on substrings is simpler and more resilient
- process.exit spy throws `new Error("process.exit")` to mirror real exit behavior and stop test execution at call site
- ora module-level mock uses a shared `mockInstance` object defined outside the factory so tests can inspect the same reference; reset via `vi.clearAllMocks()` in `beforeEach`
- process.exit mock type signature widened to `string | number | null` to satisfy Node.js overload — strict typecheck caught this

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed process.exit mock type signature**
- **Found during:** Post-task typecheck
- **Issue:** Mock implementation typed `_code?: number` but Node.js `process.exit` accepts `string | number | null | undefined`; TypeScript strict mode rejected this
- **Fix:** Widened parameter type to `_code?: string | number | null` in both spy locations in `select-reporter.test.ts`
- **Files modified:** packages/cli/src/utils/select-reporter.test.ts
- **Verification:** `npx tsc --noEmit -p packages/cli/tsconfig.json` exits cleanly
- **Committed in:** `722af0c`

---

**Total deviations:** 1 auto-fixed (Rule 1 — type bug in test mock)
**Impact on plan:** Necessary for typecheck compliance. No scope creep.

## Issues Encountered

Pre-existing integration test failures in the CLI package (48 tests in `packages/cli/tests/integration/`) are unrelated to this plan. All 242 CLI utils tests pass.

## Known Stubs

None — test files only, no production stubs.

## Next Phase Readiness

- v2.1.0 Gap Closure milestone test requirements (TEST-01, TEST-02, TEST-03) complete
- All CLI utility unit tests passing — the final untested utils are now covered
- No blockers for milestone closure

## Self-Check: PASSED

- FOUND: packages/cli/src/utils/dry-run.test.ts
- FOUND: packages/cli/src/utils/select-reporter.test.ts
- FOUND: packages/cli/src/utils/spinner.test.ts
- FOUND: .planning/phases/09-cli-utility-unit-tests/09-01-SUMMARY.md
- FOUND: fefd2d9 test(09-01): add unit tests for formatTestPlan and selectReporter
- FOUND: 7e17260 test(09-01): add unit tests for createSpinner
- FOUND: 722af0c fix(09-01): fix process.exit mock type signature

---
*Phase: 09-cli-utility-unit-tests*
*Completed: 2026-04-02*
