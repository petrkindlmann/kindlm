---
phase: quick
plan: 260331-ti8
subsystem: core-engine
tags: [runner, events, refactor, types, observability]
dependency_graph:
  requires: []
  provides: [RunEvent union, executeUnit helpers, ProviderToolCall.index, judge boundary comments]
  affects: [packages/core/src/engine/runner.ts, packages/core/src/types/provider.ts, packages/core/src/providers/conversation.ts, packages/core/src/assertions/judge.ts, packages/cli/src/utils/run-tests.ts]
tech_stack:
  added: []
  patterns: [emit helper pattern, pure helper extraction, factory function coordinator]
key_files:
  created: []
  modified:
    - packages/core/src/engine/runner.ts
    - packages/core/src/engine/index.ts
    - packages/core/src/types/provider.ts
    - packages/core/src/providers/conversation.ts
    - packages/core/src/assertions/judge.ts
    - packages/cli/src/utils/run-tests.ts
    - packages/core/src/providers/openai.ts
    - packages/core/src/providers/anthropic.ts
    - packages/core/src/providers/ollama.ts
    - packages/core/src/providers/gemini.ts
    - packages/core/src/providers/mistral.ts
    - packages/core/src/providers/cohere.ts
    - packages/core/src/providers/http.ts
    - packages/core/src/engine/command.ts
    - packages/core/src/trace/mapper.ts
decisions:
  - Use CONFIG_VALIDATION_ERROR error code for interpolation failures in buildPromptMessages (CONFIG_ERROR does not exist in ErrorCode union)
  - Set index: 0 in all provider adapters as placeholder — conversation.ts overwrites with correct cross-turn index
  - trace/mapper.ts assigns index via Array.map callback index (i) since it builds from a flat list
  - Keep onProgress as deprecated fallback in RunnerDeps; emit helper resolves onEvent ?? onProgress ?? noop
metrics:
  duration: 8min
  completed: "2026-03-31T19:41:16Z"
  tasks_completed: 3
  files_modified: 22
---

# Quick 260331-ti8: Expand RunEvent Union, Split executeUnit, Tool Call Indexing

**One-liner:** RunEvent union with 5 lifecycle events replaces ProgressEvent, executeUnit decomposed into buildPromptMessages/buildAssertionContext/runAssertions pure helpers, ProviderToolCall gains 0-based cross-turn index field, judge.ts annotated with static/dynamic prompt boundary.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Expand RunEvent union + extract executeUnit helpers | 46cd008 |
| 2 | Add ProviderToolCall index + judge boundary comments | 662338b |
| 3 | Run tests — all 170 passed, 0 failures | (verification) |

## What Changed

### RunEvent Union (runner.ts, engine/index.ts, run-tests.ts)

Replaced the 2-event `ProgressEvent` union with a 5-event `RunEvent` union:
- `run.started` — emitted after execution plan is built, carries `totalUnits`
- `test.started` — emitted at the start of each unit
- `test.completed` — emitted on success, carries `durationMs` and `costUsd`
- `test.errored` — emitted on catch (replaces `test.completed` with `passed: false`)
- `run.completed` — emitted before return, carries pass/fail/errored counts and total duration

`ProgressEvent` is kept as a deprecated alias (`type ProgressEvent = RunEvent`). `onProgress` is kept as a deprecated fallback in `RunnerDeps` — the emit helper resolves `onEvent ?? onProgress ?? noop`.

### executeUnit Decomposition (runner.ts)

Three pure helper functions extracted from the 100+ line `executeUnit`:
- `buildPromptMessages(promptDef, test, modelConfig)` — interpolates templates, builds `ProviderMessage[]` and `ProviderRequest`, returns `Result<PromptBuildResult>`
- `buildAssertionContext(conversation, test, modelConfig, deps, schemaCache, config, costEstimate, adapter)` — creates assertions from expect config and builds `AssertionContext` with baseline injection
- `runAssertions(assertions, context)` — loops and collects `AssertionResult[]`

`executeUnit` is now a thin coordinator: call helpers in order, handle errors at each step. `executeCommandUnit` reuses `runAssertions` directly.

### ProviderToolCall.index (types/provider.ts, conversation.ts, all providers)

Added `index: number` to `ProviderToolCall` interface with JSDoc explaining the semantics. All provider adapters set `index: 0` as a placeholder — `conversation.ts` overwrites with the correct 0-based sequential position across all turns using `allToolCalls.length` before push. `trace/mapper.ts` assigns index from the `Array.map` callback index.

### Judge Boundary Comments (assertions/judge.ts)

Three comment blocks clarify prompt caching boundaries:
- Above `JUDGE_SYSTEM_PROMPT`: static/cacheable section with Anthropic/OpenAI caching note
- Above `buildUserPrompt`: dynamic/per-test section with explicit MUST NOT cache note
- Inline in `evaluate`: static/dynamic boundary marker between the two message constructions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CONFIG_ERROR is not a valid ErrorCode**
- **Found during:** Task 1
- **Issue:** `buildPromptMessages` used `err({ code: "CONFIG_ERROR", ... })` but `CONFIG_ERROR` does not exist in the `ErrorCode` union
- **Fix:** Changed to `CONFIG_VALIDATION_ERROR` which is the correct existing code for config validation failures
- **Files modified:** packages/core/src/engine/runner.ts
- **Commit:** 46cd008

**2. [Rule 2 - Missing functionality] ConversationResult import was placed inline mid-file**
- **Found during:** Task 1
- **Issue:** Initial placement of `import type { ConversationResult }` was inline in the function body, invalid with verbatimModuleSyntax
- **Fix:** Moved to top-level imports; also corrected import source from `../providers/conversation.js` (which doesn't export it) to `../types/provider.js`
- **Files modified:** packages/core/src/engine/runner.ts
- **Commit:** 46cd008

**3. [Rule 2 - Missing test updates] All provider test files asserting full ProviderToolCall shape needed index field**
- **Found during:** Task 2 typecheck
- **Files modified:** anthropic.test.ts, openai.test.ts, mistral.test.ts, gemini.test.ts, gemini.resilience.test.ts, cohere.test.ts, command.test.ts, tool-calls.test.ts, conversation.test.ts, runner.test.ts
- **Commit:** 662338b

**4. [Rule 2 - Missing update] trace/mapper.ts constructs ProviderToolCall without index**
- **Found during:** Task 2 typecheck
- **Fix:** Added `.map((tc, i) => ({ ...tc, index: i }))` pattern
- **Files modified:** packages/core/src/trace/mapper.ts
- **Commit:** 662338b

## Self-Check: PASSED

- Commit 46cd008 exists: FOUND
- Commit 662338b exists: FOUND
- All 170 tests pass (core + cli)
- Full monorepo typecheck passes
- RunEvent exported from engine/index.ts: confirmed
- ProviderToolCall.index field present: confirmed
- buildPromptMessages, buildAssertionContext, runAssertions exist in runner.ts: confirmed
- Judge.ts has static/dynamic boundary comments: confirmed
