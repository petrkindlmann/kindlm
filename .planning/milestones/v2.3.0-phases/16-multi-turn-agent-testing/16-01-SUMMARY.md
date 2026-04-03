---
phase: 16-multi-turn-agent-testing
plan: "01"
subsystem: core
tags: [schema, engine, conversation, multi-turn, assertions]
dependency_graph:
  requires: []
  provides: [ConversationTurnSchema, per-turn-assertion-evaluation]
  affects: [schema.ts, runner.ts, types/config.ts]
tech_stack:
  added: []
  patterns: [superRefine for multi-validation, turnLabel metadata stamping, synthetic assertion injection]
key_files:
  created: []
  modified:
    - packages/core/src/config/schema.ts
    - packages/core/src/config/schema.test.ts
    - packages/core/src/engine/runner.ts
    - packages/core/src/engine/runner.test.ts
    - packages/core/src/types/config.ts
decisions:
  - ".superRefine() consolidates prompt/command exclusivity and unique turn-label validation in one pass"
  - "Per-turn AssertionContext uses only that turn's toolCalls, not allToolCalls, for isolation"
  - "Synthetic MAX_TURNS_EXCEEDED assertion uses assertionType='conversation' for reporter filtering"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-03"
  tasks_completed: 2
  files_changed: 5
---

# Phase 16 Plan 01: Conversation Schema + Per-Turn Assertion Evaluation Summary

**One-liner:** ConversationTurnSchema with labeled turns, per-turn expect evaluation, and MAX_TURNS_EXCEEDED synthetic failure for multi-turn agent testing.

## What Was Built

Added `conversation:` support to the KindLM config schema and wired per-turn assertion evaluation in the engine runner — enabling YAML-defined multi-turn conversations with per-turn assertions and `turnLabel` metadata for downstream reporter grouping.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add ConversationTurnSchema to Zod config and maxTurns cap | 9f362b8 | schema.ts, schema.test.ts, types/config.ts |
| 2 | Wire per-turn assertion evaluation in engine runner | bf1b640 | runner.ts, runner.test.ts |

## Key Changes

### schema.ts
- Added `ConversationTurnSchema` with `turn` (unique label), `user` (optional override), `expect` (optional per-turn assertions)
- Added `conversation` and `maxTurns` fields to `TestCaseSchema`
- Migrated `.refine()` to `.superRefine()` handling both prompt/command exclusivity and duplicate turn label rejection
- Exported `ConversationTurnConfig` type

### runner.ts (`executeUnit`)
- Passes `maxTurns` to `runConversation` options
- Evaluates each labeled turn's `expect` block against that turn's response only (not `allToolCalls`)
- Stamps `turnLabel` into assertion result `metadata` via spread (no mutation)
- Injects synthetic `MAX_TURNS_EXCEEDED` assertion when `conversation.truncated === true`
- Combines per-turn results with final test-level assertion results

## Tests Added

- **schema.test.ts:** 8 new tests in `describe("conversation schema")` covering parse, duplicate-label rejection, backward compat, maxTurns boundaries, optional expect, user override
- **runner.test.ts:** 5 new tests in `describe("per-turn assertion evaluation")` covering turnLabel metadata, per-turn toolCalls isolation, backward compat, truncation failure, turns without expect

## Deviations from Plan

**1. [Rule 1 - Bug] TypeScript required `format` field on OutputExpectSchema**
- **Found during:** Task 2 (typecheck)
- **Issue:** `OutputExpectSchema` has `format: z.enum(["text", "json"]).default("text")` — the inferred TypeScript type requires `format` even though Zod provides a default at parse time. Raw object literals in test code failed typecheck.
- **Fix:** Added `format: "text" as const` to all `output` objects in new test cases.
- **Files modified:** packages/core/src/engine/runner.test.ts
- **Commit:** included in bf1b640

**2. [Rule 1 - Bug] TypeScript required `shouldNotCall` field on ToolCallExpectSchema**
- **Found during:** Task 2 (typecheck)  
- **Issue:** `ToolCallExpectSchema` has `shouldNotCall: z.boolean().optional().default(false)` — inferred TypeScript type still requires it in raw literals.
- **Fix:** Added `shouldNotCall: false` to tool call expect in new test.
- **Files modified:** packages/core/src/engine/runner.test.ts
- **Commit:** included in bf1b640

## Self-Check: PASSED

- [x] packages/core/src/config/schema.ts — modified, ConversationTurnSchema present
- [x] packages/core/src/engine/runner.ts — modified, turnLabel and perTurnResults present
- [x] Commit 9f362b8 exists
- [x] Commit bf1b640 exists
- [x] 33 schema tests pass
- [x] 20 runner tests pass
- [x] `npm run typecheck` exits 0
