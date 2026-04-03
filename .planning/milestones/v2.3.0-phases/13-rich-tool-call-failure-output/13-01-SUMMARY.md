---
phase: 13-rich-tool-call-failure-output
plan: "01"
subsystem: core/assertions + core/reporters
tags: [assertions, reporter, tool-calls, dx, debugging]
dependency_graph:
  requires: []
  provides: [structured-tool-call-failure-metadata, rich-pretty-reporter-output]
  affects: [pretty-reporter, tool-call-assertions]
tech_stack:
  added: []
  patterns: [metadata-enrichment, colorize-interface, tdd]
key_files:
  created: []
  modified:
    - packages/core/src/assertions/tool-calls.ts
    - packages/core/src/assertions/tool-calls.test.ts
    - packages/core/src/reporters/pretty.ts
    - packages/core/src/reporters/pretty.test.ts
decisions:
  - Assertion layer populates metadata; reporter reads it (per existing D-04/D-05 decisions)
  - Non-null assertions forbidden by ESLint — used optional chaining and local variables instead
  - argCount=0 shows no suffix — avoids noisy "(0 args)" for no-arg tools
metrics:
  duration_minutes: 15
  completed_date: "2026-04-02"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 13 Plan 01: Rich Tool Call Failure Output Summary

Enriched tool call assertion failures with structured metadata and implemented rich formatted output in the pretty reporter showing numbered call sequences and field-level diffs.

## One-liner

Tool call assertion failures now emit structured metadata (receivedToolCalls, argDiffs, argCount) consumed by the pretty reporter to render numbered call sequences and green/red field-level diffs.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Enrich tool call assertion metadata on failure and pass paths | 005c1c7 | tool-calls.ts, tool-calls.test.ts |
| 2 | Rich tool call formatting in pretty reporter with truncation and Colorize | 16d77c7 | pretty.ts, pretty.test.ts |

## What Was Built

**Task 1 — Assertion metadata enrichment (`tool-calls.ts`):**
- Added `computeArgDiffs()` internal helper that produces per-field `{ expected, received }` diffs for only the mismatched keys
- `TOOL_CALL_MISSING` failures: `metadata.receivedToolCalls`, `metadata.expectedTool`, `metadata.argDiffs: undefined`
- `TOOL_CALL_ARGS_MISMATCH` failures: all of above + `metadata.expectedArgs`, `metadata.argDiffs` (field-level)
- `TOOL_CALL_UNEXPECTED` failures: `metadata.receivedToolCalls`, `metadata.expectedTool`
- `TOOL_CALL_ORDER_WRONG` failures: `metadata.receivedToolCalls`, `metadata.expectedTool`
- Passing `tool_called` results: `metadata.argCount` (count of keys in matched tool's arguments)
- All three factories updated: `createToolCalledAssertion`, `createToolNotCalledAssertion`, `createToolOrderAssertion`

**Task 2 — Pretty reporter rich formatting (`pretty.ts`):**
- Added `ToolCallMetadata` interface for type-safe metadata reading
- Added `extractToolCallDetail()` (parallel to existing `extractReasoning()`)
- Added `truncateArgs()` — truncates JSON at 500 chars, appends `...(truncated)`
- Failure branch: numbered call list `1. search({"q":"cats"})`, then `Arg diffs:` with `[green]expected:[/green]` / `[red]received:[/red]` per field
- Passing branch: `(N args)` suffix when `argCount > 0`; no suffix when 0
- No chalk import anywhere — only `Colorize` interface used (TCOUT-06)
- JSON reporter untouched — no truncation in structured output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint forbids non-null assertions (`!`)**
- **Found during:** Task 2 lint verification
- **Issue:** Project ESLint config has `@typescript-eslint/no-non-null-assertion: error`. Initial implementation used `matching[0]!` and `results[0]!` non-null assertions.
- **Fix:** Replaced `matching[0]!` with `matching.length > 0 ? matching[0]?.arguments ?? {} : {}` in tool-calls.ts. Replaced `results[0]!` accesses in tests with `const r = results[0]; r?.metadata` optional chaining.
- **Files modified:** `tool-calls.ts`, `tool-calls.test.ts`
- **Commit:** 16d77c7 (included in Task 2 commit)

## Known Stubs

None — all metadata is fully wired from assertion layer to reporter layer.

## Self-Check: PASSED

- `packages/core/src/assertions/tool-calls.ts` — exists, contains `computeArgDiffs`, `receivedToolCalls`, `argDiffs`, `argCount`
- `packages/core/src/reporters/pretty.ts` — exists, contains `extractToolCallDetail`, `truncateArgs`, `ToolCallMetadata`, `argDiffs`, `...(truncated)`, `args)`
- Commit `005c1c7` — verified in git log
- Commit `16d77c7` — verified in git log
- 52 tests pass (25 tool-calls + 27 pretty)
- TypeScript compiles clean (`tsc --noEmit`)
- ESLint clean on all 4 modified files
- No chalk import in `pretty.ts`
