---
phase: 12-validation-diagnostics
plan: "02"
subsystem: core/config
tags: [dx, error-messages, levenshtein, suggestions]
dependency_graph:
  requires: []
  provides: [suggestClosest helper, improved cross-ref error messages]
  affects: [packages/core/src/config/parser.ts]
tech_stack:
  added: []
  patterns: [inline-levenshtein, pure-function, row-based-dp]
key_files:
  created: []
  modified:
    - packages/core/src/config/parser.ts
    - packages/core/src/config/parser.test.ts
decisions:
  - Row-based Levenshtein DP chosen to avoid noUncheckedIndexedAccess issues with flat array indexing
  - Provider suggestion test uses "anthropic" (valid enum, not configured) since Zod enum rejects unknown strings before cross-ref
metrics:
  duration: ~5 minutes
  completed: 2026-04-02
  tasks_completed: 1
  tasks_total: 1
  files_created: 0
  files_modified: 2
---

# Phase 12 Plan 02: Did You Mean? Suggestions in Cross-Ref Errors Summary

**One-liner:** Inline Levenshtein + suggestClosest added to parser.ts; all four cross-ref error messages now include "Did you mean: X?" or "Available X: ..." hints.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add suggestClosest helper + update error messages | d0a84e4 | parser.ts, parser.test.ts |

## What Was Built

Added two pure functions to `packages/core/src/config/parser.ts`:

- `levenshtein(a, b)` — row-based DP implementation, no external dependency, compatible with `noUncheckedIndexedAccess`
- `suggestClosest(input, candidates)` — returns closest match if within `max(2, floor(len*0.4))` edit distance, null otherwise

Updated all four cross-ref error message sites:
1. `test.prompt` not in `config.prompts` — appends `Did you mean: "X"?` or `Available prompts: ...`
2. `test.models[]` item not in model IDs — appends `Did you mean: "X"?` or `Available models: ...`
3. `model.provider` not in `config.providers` — appends `Did you mean: "X"?` or `Available providers: ...`
4. `defaults.judgeModel` not a model ID — appends `Did you mean: "X"?` or `Available models: ...`

Added 11 new tests: 6 unit tests for `suggestClosest` and 5 integration tests covering suggestion and available-list cases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched Levenshtein to row-based DP**
- **Found during:** Task 1, typecheck phase
- **Issue:** Flat `Int32Array` with index expressions triggered `TS2322`/`TS2532` under `noUncheckedIndexedAccess: true`
- **Fix:** Replaced with row-based rolling array using `??` fallback for noUncheckedIndexedAccess compatibility
- **Files modified:** packages/core/src/config/parser.ts
- **Commit:** d0a84e4

**2. [Rule 1 - Bug] Provider suggestion test adjusted**
- **Found during:** Task 1, RED phase — provider case test failed at Zod enum validation, not cross-ref
- **Issue:** `openAI` is not a valid provider enum value in Zod schema, so it never reaches cross-ref validation
- **Fix:** Changed test to use `anthropic` (valid enum, not configured) which reaches cross-ref and produces `Available providers:` output
- **Files modified:** packages/core/src/config/parser.test.ts
- **Commit:** d0a84e4

## Known Stubs

None.

## Self-Check: PASSED

- `packages/core/src/config/parser.ts` — exists, contains `suggestClosest` and `levenshtein`
- `packages/core/src/config/parser.test.ts` — exists, contains `Did you mean` assertions
- Commit d0a84e4 — verified in git log
- 31/31 tests pass
- `tsc --noEmit` exits 0 for core package
