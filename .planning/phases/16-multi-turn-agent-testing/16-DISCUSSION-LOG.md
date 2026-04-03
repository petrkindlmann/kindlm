# Phase 16: Multi-Turn Agent Testing - Discussion Log

> **Audit trail only.**

**Date:** 2026-04-03
**Phase:** 16-multi-turn-agent-testing
**Areas discussed:** Turn label schema, Per-turn assertion binding, onToolCall mapping, Reporter grouping
**Mode:** Auto (--auto)

---

## Critical Finding: Infrastructure ~85% Built

- `conversation.ts` — Full conversation runner with tool simulation loop, maxTurns, truncation
- `ToolSimulation` schema with `when`/`then` conditional responses
- `ConversationResult`/`ConversationTurn` types exist
- `runner.ts` already calls `runConversation()` for all tests
- `maxTurns` defaults to 10, conversation state already isolated

Main gaps: labeled turns in YAML, per-turn assertions, turn-grouped reporter.

---

## All areas auto-selected with recommended defaults.

| Area | Decision | Rationale |
|------|----------|-----------|
| Turn label schema | `conversation:` array with `turn` label + `expect` per entry | Labeled turns prevent positional-index fragility |
| Per-turn assertions | Each turn's expect evaluated against that turn's response | Enables granular multi-turn testing |
| onToolCall mapping | Existing `tools[].responses` IS the implementation — no rename | Avoid breaking changes, same semantics |
| Reporter grouping | Indent assertions under `── Turn: label ──` headers | Clear visual grouping |

## Claude's Discretion

- runConversation refactoring approach for per-turn results
- maxTurns placement (conversation-level vs test-level)
- Turn header separator style

## Deferred Ideas

- Conditional branching (CONV-F01) — future milestone
- Decision tree assertions (CONV-F02) — future milestone
