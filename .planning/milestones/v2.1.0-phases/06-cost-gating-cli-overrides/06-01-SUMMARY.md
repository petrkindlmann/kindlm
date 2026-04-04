---
phase: 06-cost-gating-cli-overrides
plan: "01"
subsystem: cli
tags: [cli, feature-flags, cost-gating, overrides]
dependency_graph:
  requires: []
  provides: [concurrency-override, timeout-override, costGating-strip]
  affects: [packages/cli/src/commands/test.ts, packages/cli/src/utils/run-tests.ts]
tech_stack:
  added: []
  patterns: [cli-override-pattern, feature-flag-strip]
key_files:
  created: []
  modified:
    - packages/cli/src/commands/test.ts
    - packages/cli/src/utils/run-tests.ts
    - packages/cli/src/utils/run-tests.test.ts
decisions:
  - "--timeout 0 is valid (immediate timeout) — consistent with POSIX timeout semantics and test.ts plan spec"
  - "costGating strip applied before createRunner() — ensures runner never sees costMaxUsd when flag is off"
metrics:
  duration: 8min
  completed: "2026-04-01"
  tasks: 2
  files: 3
---

# Phase 06 Plan 01: Cost Gating + CLI Overrides Summary

Wire the `costGating` feature flag to gate `config.gates.costMaxUsd`, and add `--concurrency` and `--timeout` CLI override flags to `kindlm test`. Closes three v2.1.0 audit gaps (COST-01, CLI-01, CLI-02).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Add --concurrency, --timeout options + costGating strip to production code | c275301 |
| 2 | Add 8 unit tests for all three requirements | c275301 |

## Changes Made

**`packages/cli/src/commands/test.ts`**
- Added `concurrency?: string` and `timeout?: string` to `TestOptions` interface
- Registered `--concurrency <count>` and `--timeout <ms>` Commander options
- Passes `parseInt(options.concurrency)` and `parseInt(options.timeout)` to `runTests()`

**`packages/cli/src/utils/run-tests.ts`**
- Added `concurrency?: number` and `timeout?: number` to `RunTestsOptions` interface
- Concurrency validation block: exits 1 if not integer or < 1, sets `config.defaults.concurrency`
- Timeout validation block: exits 1 if not integer or < 0, sets `config.defaults.timeoutMs`
- costGating strip block: if `!isEnabled(featureFlags, "costGating") && config.gates`, strips `costMaxUsd` from gates before `createRunner()` is called

**`packages/cli/src/utils/run-tests.test.ts`**
- 8 new tests added: concurrency invalid (zero), concurrency invalid (negative), concurrency valid override, timeout invalid (negative), timeout zero valid, timeout valid override, costGating disabled strips costMaxUsd, costGating enabled preserves costMaxUsd
- Total: 23 tests passing (was 14 + mcp test = 15, now 23)

## Verification

- `npx tsc --noEmit --project packages/cli/tsconfig.json` — zero errors
- `npx vitest run packages/cli/src/utils/run-tests.test.ts` — 23/23 passed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- packages/cli/src/commands/test.ts — modified, contains `--concurrency` and `--timeout`
- packages/cli/src/utils/run-tests.ts — modified, contains `costGating` strip
- packages/cli/src/utils/run-tests.test.ts — modified, contains 8 new tests
- Commit c275301 exists
