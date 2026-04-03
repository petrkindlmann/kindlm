---
phase: 16-multi-turn-agent-testing
verified: 2026-04-03T07:42:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 16: Multi-Turn Agent Testing Verification Report

**Phase Goal:** Developers can define and assert on multi-turn agent conversations in YAML, including mock tool responses, without live tool backends
**Verified:** 2026-04-03T07:42:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | A test case with `conversation:` array parses successfully via Zod | VERIFIED | `ConversationTurnSchema` + `conversation` field in schema.ts:425-473 |
| 2  | Duplicate turn labels are rejected by Zod with a clear error message | VERIFIED | `.superRefine()` at schema.ts:495 with "Duplicate turn label" message at line 510 |
| 3  | Each turn's `expect:` is evaluated against only that turn's response | VERIFIED | runner.ts:474-495 — `turnContext` uses `turnResponse.response.toolCalls` not `allToolCalls` |
| 4  | The final `test.expect` still evaluates against the last turn (backward compat) | VERIFIED | runner.ts:516 combines `perTurnResults` with `finalResults` from existing `buildAssertionContext`; 110/110 tests pass |
| 5  | Assertion results from per-turn evaluation carry `turnLabel` in metadata | VERIFIED | runner.ts:493 stamps `turnLabel: turnDef.turn` via spread; runner.test.ts line 587 confirms |
| 6  | `maxTurns` is capped at 20 in the schema | VERIFIED | schema.ts:474-478 — `.number().int().min(1).max(20)` |
| 7  | Truncated conversations produce a synthetic INTERNAL_ERROR assertion result | VERIFIED | runner.ts:500-508 — `assertionType: "conversation"`, `failureCode: "INTERNAL_ERROR"`, `failureMessage: "MAX_TURNS_EXCEEDED: ..."` |
| 8  | Pretty reporter groups assertion results by turn label under dim headers | VERIFIED | pretty.ts:30-64 — `── Turn: {label} ──` via `c.dim()`; 4 tests in `describe("turn-grouped output")` |
| 9  | Assertions without turnLabel render flat (backward compat) | VERIFIED | pretty.ts:35-39 — `hasTurns` gate; pretty.test.ts:587 confirms flat render |
| 10 | JSON reporter includes turnLabel in assertion output when present | VERIFIED | json.ts:34 — spread `turnLabel` from `a.metadata.turnLabel` |
| 11 | JUnit reporter includes turnLabel when present | VERIFIED | junit.ts:48-49 — `[Turn: label]` prefix on failure message |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/config/schema.ts` | ConversationTurnSchema + conversation field | VERIFIED | `ConversationTurnSchema` at line 425, `conversation` field at line 470, `maxTurns` at line 474, `.superRefine()` at line 495, `onToolCall` comment at line 385 |
| `packages/core/src/engine/runner.ts` | Per-turn assertion evaluation loop | VERIFIED | `perTurnResults` at line 473, `turnLabel` stamp at line 493, `MAX_TURNS_EXCEEDED` at line 507 |
| `packages/core/src/config/schema.test.ts` | Tests for conversation schema parsing | VERIFIED | `describe("conversation schema")` at line 308, 8 new tests |
| `packages/core/src/engine/runner.test.ts` | Tests for per-turn assertion evaluation | VERIFIED | `describe("per-turn assertion evaluation")` covering all 5 test cases |
| `packages/core/src/reporters/pretty.ts` | Turn-grouped assertion display | VERIFIED | Turn grouping logic at line 30; `── Turn: label ──` separator at line 63 |
| `packages/core/src/reporters/pretty.test.ts` | Tests for turn-grouped output | VERIFIED | `describe("turn-grouped output")` at line 543, 4 tests |
| `packages/core/src/reporters/json.ts` | turnLabel in JSON assertion output | VERIFIED | Line 34 — spread turnLabel when present |
| `packages/core/src/reporters/junit.ts` | turnLabel in JUnit testcase output | VERIFIED | Lines 48-49 — `[Turn: label]` prefix |
| `packages/core/src/types/config.ts` | ConversationTurnConfig exported | VERIFIED | Line 12 re-exports `ConversationTurnConfig` from schema |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `schema.ts` | `runner.ts` | `TestCase` type with `conversation` field | WIRED | runner.ts:474 uses `test.conversation`; runner.ts:467 passes `maxTurns` to `runConversation` |
| `runner.ts` | `assertions/registry.ts` | `createAssertionsFromExpect` called per turn | WIRED | runner.ts:487 calls `createAssertionsFromExpect(turnDef.expect)` |
| `pretty.ts` | `assertions/interface.ts` | `metadata.turnLabel` field on AssertionResult | WIRED | pretty.ts:32 reads `a.metadata?.turnLabel` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `runner.ts` | `perTurnResults` | `conversation.turns[i].response` from `runConversation` | Yes — turn response from provider adapter | FLOWING |
| `pretty.ts` | `test.assertions` (with `turnLabel`) | `perTurnResults` stamped in runner.ts | Yes — metadata stamped before reporter call | FLOWING |
| `json.ts` | assertion object with `turnLabel` | `a.metadata.turnLabel` from runner | Yes — passthrough from metadata | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Schema tests pass (conversation schema) | `npx vitest run packages/core/src/config/schema.test.ts` | 33 tests pass | PASS |
| Runner tests pass (per-turn evaluation) | `npx vitest run packages/core/src/engine/runner.test.ts` | 20 tests pass | PASS |
| Reporter tests pass (turn-grouped output) | `npx vitest run packages/core/src/reporters/` | 57 tests pass | PASS |
| All 3 test files combined | 6 test files, 110 tests | 110 passed (0 failed) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONV-01 | 16-01 | Multi-turn conversations in YAML with labeled turns under `conversation:` block | SATISFIED | `ConversationTurnSchema` with `turn` field; `conversation` on `TestCaseSchema` |
| CONV-02 | 16-01 | Each turn has its own `expect:` block supporting all assertion types | SATISFIED | `expect: ExpectSchema.optional()` on `ConversationTurnSchema`; `createAssertionsFromExpect(turnDef.expect)` in runner |
| CONV-03 | 16-02 | Mock tool responses via `onToolCall` mapping (tool name → response payload) | SATISFIED | `ToolSimulationSchema` with `responses[].when/then`; comment at schema.ts:385-388 documents it as onToolCall equivalent |
| CONV-04 | 16-01 | `maxTurns` field (default 10, max 20), failing with `MAX_TURNS_EXCEEDED` | SATISFIED | schema.ts:474-478 caps at 20; runner.ts:500-508 injects synthetic failure |
| CONV-05 | 16-01 | Conversation state isolated per test case — never shared across tests | SATISFIED | conversation.ts:22 — `let messages = [...initialRequest.messages]` freshly initialized per `runConversation` call |
| CONV-06 | 16-01 | Conversation runner in `@kindlm/core` as pure state machine, no I/O | SATISFIED | `conversation.ts` imports only type-level — no `fs`, `fetch`, `console.log` found |
| CONV-07 | 16-02 | Pretty reporter groups assertion results by turn label | SATISFIED | pretty.ts:30-64 groups by `metadata.turnLabel`, renders `── Turn: {label} ──` separators |
| CONV-08 | 16-01 | Zod schema validates conversation config with clear error messages | SATISFIED | `.superRefine()` at schema.ts:495 with "Duplicate turn label" message; `maxTurns` boundary enforcement |

All 8 required CONV requirements satisfied. No orphaned requirements detected.

### Anti-Patterns Found

No blockers or warnings found. Scan of modified files showed:
- No TODOs, FIXMEs, or placeholder comments in phase-modified files
- No empty return implementations in the new code paths
- No hardcoded empty data that flows to rendering

### Human Verification Required

None. All must-haves are programmatically verifiable via test suite and code inspection.

### Gaps Summary

No gaps. All 11 observable truths verified, all 9 artifacts confirmed substantive and wired, all 8 CONV requirements satisfied, and 110 tests pass with no regressions.

---

_Verified: 2026-04-03T07:42:00Z_
_Verifier: Claude (gsd-verifier)_
