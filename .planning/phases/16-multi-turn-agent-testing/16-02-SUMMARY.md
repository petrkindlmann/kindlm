---
phase: 16-multi-turn-agent-testing
plan: "02"
subsystem: reporters
tags: [reporters, multi-turn, conversation, pretty, json, junit]
dependency_graph:
  requires: ["16-01"]
  provides: ["turn-grouped-reporter-output"]
  affects: ["packages/core/src/reporters/pretty.ts", "packages/core/src/reporters/json.ts", "packages/core/src/reporters/junit.ts"]
tech_stack:
  added: []
  patterns: ["metadata.turnLabel passthrough", "turn-grouped display via Map"]
key_files:
  created: []
  modified:
    - packages/core/src/reporters/pretty.ts
    - packages/core/src/reporters/pretty.test.ts
    - packages/core/src/reporters/json.ts
    - packages/core/src/reporters/junit.ts
    - packages/core/src/config/schema.ts
decisions:
  - "Turn separator uses c.dim() to match existing metadata styling — visually subordinate, not alarming"
  - "Unlabeled assertions render before labeled turns — final-level expect: appears at top"
  - "JUnit uses message prefix [Turn: label] rather than a new XML element — simplest approach that doesn't break parsers"
  - "onToolCall mapping documented as comment in schema.ts — no runtime change needed"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_modified: 5
---

# Phase 16 Plan 02: Reporter Turn-Grouped Output Summary

Turn-grouped assertion display in pretty reporter and turnLabel passthrough in JSON/JUnit reporters for multi-turn conversation test results.

## What Was Built

### Task 1: Turn-grouped assertion display in reporters

**pretty.ts** — replaced flat assertion loop with turn-aware grouping:
- Detects `metadata.turnLabel` on any assertion in the test
- If no turnLabel present: renders flat (backward-compatible, zero behavior change for non-conversation tests)
- If turnLabel present: groups by label using a `Map`, preserving insertion order
- Unlabeled assertions (final-level `expect:`) render first, then labeled turns in order
- Turn separator: `      [dim]── Turn: {label} ──[/dim]` (6-space indent, dim styling)

**json.ts** — spreads `turnLabel` into each assertion object when present in metadata (D-14).

**junit.ts** — prefixes the `<failure message>` attribute with `[Turn: label]` when turnLabel present in metadata.

**pretty.test.ts** — 4 new tests in `describe("turn-grouped output")`:
1. Renders `── Turn: label ──` header for assertions with turnLabel
2. Renders flat (no turn headers) for assertions without turnLabel (backward compat)
3. Unlabeled assertions appear before labeled turn groups
4. Multiple turns render in array insertion order

### Task 2: Document onToolCall mapping

**schema.ts** — added comment above `ToolSimulationSchema` explaining that `responses[].when/then` is the YAML equivalent of the `onToolCall` mapping pattern (satisfies CONV-03, D-08, D-09).

## Verification

- Reporter test suite: 57 tests, all pass (`packages/core/src/reporters/`)
- typecheck: 0 errors (`npm run typecheck`)
- 5 pre-existing failures in `packages/cli/tests/integration/scenarios.test.ts` — confirmed pre-existing (exist on HEAD before this plan, not caused by these changes)
- 7 pre-existing lint errors in CLI test files — not caused by these changes (no CLI files modified)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `packages/core/src/reporters/pretty.ts` — FOUND, contains `turnLabel` and `Turn:`
- `packages/core/src/reporters/json.ts` — FOUND, contains `turnLabel`
- `packages/core/src/reporters/junit.ts` — FOUND, contains `turnLabel`
- `packages/core/src/reporters/pretty.test.ts` — FOUND, contains `turn-grouped`
- `packages/core/src/config/schema.ts` — FOUND, contains `onToolCall`
- Commit `fdb35fd` — FOUND (Task 1)
- Commit `99db50a` — FOUND (Task 2)
