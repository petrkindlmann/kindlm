# Phase 16: Multi-Turn Agent Testing - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Add explicit multi-turn conversation definitions with labeled turns, per-turn assertions, and turn-grouped reporter output. The conversation infrastructure (runConversation, ToolSimulation, ConversationResult, maxTurns) already exists. This phase adds the YAML schema for labeled turns with per-turn `expect:` blocks and wires them through the assertion and reporter layers.

</domain>

<decisions>
## Implementation Decisions

### Turn label schema (CONV-01, CONV-08)
- **D-01:** Add a `conversation:` array field to `TestCaseSchema` in Zod schema. Each entry has: `turn` (string label, required), `user` (optional user message for this turn), `expect` (optional, same ExpectSchema as single-turn tests).
- **D-02:** When `conversation:` is present, `prompt` is still required (defines the initial system+user message). Subsequent turns in `conversation:` can override the user message.
- **D-03:** Turn labels must be unique within a test case — Zod refinement validates this.
- **D-04:** YAML format:
  ```yaml
  tests:
    - name: booking-flow
      prompt: booking
      vars: { destination: "Paris" }
      tools:
        - name: search_flights
          defaultResponse: '{"flights": [{"id": 1}]}'
      conversation:
        - turn: initial-search
          expect:
            toolCalls:
              - tool: search_flights
        - turn: confirmation
          user: "Book flight 1"
          expect:
            output:
              contains: ["booked", "Paris"]
  ```

### Per-turn assertion binding (CONV-02)
- **D-05:** When `conversation:` is defined, `runConversation` must expose per-turn responses. After each turn, evaluate that turn's `expect:` block against the response from that specific turn.
- **D-06:** The existing single `expect:` on the test case (outside `conversation:`) evaluates against the FINAL turn's response (backward compatible — no change for tests without `conversation:`).
- **D-07:** Assertion results carry `turnLabel` in metadata so the reporter can group them.

### onToolCall mapping (CONV-03)
- **D-08:** The existing `tools[].responses[].when/then` pattern already implements tool response mocking with conditional matching. No rename needed — this IS the `onToolCall` mapping.
- **D-09:** Document in CLAUDE.md/.planning that `tools[].responses` is the YAML equivalent of the "onToolCall" concept from the requirements.

### maxTurns (CONV-04)
- **D-10:** Already implemented in `conversation.ts` with default 10, truncation detection, `MAX_TURNS_EXCEEDED`-equivalent via `truncated: true`. No new work needed.

### Conversation state isolation (CONV-05)
- **D-11:** Already implemented — `runConversation()` creates a fresh `messages` array per call. No new work needed.

### Conversation runner architecture (CONV-06)
- **D-12:** Already implemented as pure state machine in `@kindlm/core`. No new work needed.

### Reporter turn grouping (CONV-07)
- **D-13:** When assertion results have `turnLabel` in metadata, the pretty reporter groups them under indented turn headers:
  ```
  ✓ booking-flow
    gpt-4o · 2.34s · $0.0012
    ── Turn: initial-search ──
      ✓ Tool "search_flights" called (1 args)
    ── Turn: confirmation ──
      ✓ Output contains "booked"
      ✓ Output contains "Paris"
  ```
- **D-14:** JSON and JUnit reporters include `turnLabel` in their output structures but don't need special grouping.

### Claude's Discretion
- Internal refactoring of `runConversation` to support per-turn assertion evaluation (may need callback or return per-turn results)
- Whether to add `maxTurns` to the `conversation:` schema level or keep it only at test level
- Exact separator style for turn headers in pretty reporter

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing conversation infrastructure
- `packages/core/src/providers/conversation.ts` — runConversation() with tool simulation loop. EXTEND to support per-turn assertion evaluation.
- `packages/core/src/providers/conversation.test.ts` — Existing tests. EXTEND for per-turn assertions.
- `packages/core/src/types/provider.ts` lines 119-133 — ConversationTurn, ConversationResult types
- `packages/core/src/providers/interface.ts` — ProviderAdapter, ToolSimulation re-exports

### Config schema
- `packages/core/src/config/schema.ts` lines 387-416 — ToolSimulationSchema (already supports when/then conditional responses)
- `packages/core/src/config/schema.ts` lines 422-470 — TestCaseSchema (needs `conversation:` field addition)

### Engine
- `packages/core/src/engine/runner.ts` lines 466-498 — Where runConversation is called and results processed. Needs to handle per-turn assertion evaluation.
- `packages/core/src/assertions/registry.ts` — createAssertionsFromExpect. May need per-turn variant.

### Reporter
- `packages/core/src/reporters/pretty.ts` — formatAssertion and formatTest. Needs turn-grouping branch.

### Research
- `.planning/research/PITFALLS.md` §Pitfall 1 — Conversation state leaking (already handled)
- `.planning/research/PITFALLS.md` §Pitfall 2 — Non-deterministic branch assertions (mitigated by turn labels)
- `.planning/research/PITFALLS.md` §Pitfall 11 — Infinite loop prevention (already handled by maxTurns)
- `.planning/research/FEATURES.md` §Multi-Turn Agent Testing — Table stakes vs differentiators

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (CRITICAL — foundation ~85% built)
- `runConversation()` — Full conversation loop with tool simulation. Needs: per-turn result exposure.
- `ToolSimulationSchema` — Conditional when/then responses already work. IS the "onToolCall" concept.
- `ConversationResult` / `ConversationTurn` — Types already capture per-turn request/response pairs.
- `buildAssertionContext()` in `runner.ts` — Already processes conversation results. Needs: per-turn context building.
- `createAssertionsFromExpect()` — Creates assertion set from expect config. Reuse per turn.

### Established Patterns
- Test case schema uses Zod with `.optional()` fields and `.describe()` for each
- Tool simulation uses `when`/`then` pattern with `matchArgs()` partial matching
- Assertion metadata carries extra info (e.g., `turnLabel`, `reasoning`) for reporter consumption

### Integration Points
- `schema.ts` TestCaseSchema — add `conversation` field
- `runner.ts` `executeUnit()` — per-turn assertion evaluation loop
- `conversation.ts` — may need to return per-turn or accept a callback
- `pretty.ts` — turn-grouped assertion display
- `registry.ts` — per-turn assertion context construction

</code_context>

<specifics>
## Specific Ideas

- The infrastructure is ~85% built. The main new work is the YAML schema + per-turn assertion wiring + reporter grouping.
- Keep backward compatibility: tests without `conversation:` work exactly as before (single-shot with tool loop).

</specifics>

<deferred>
## Deferred Ideas

- Conditional branching (if tool A fails → expect tool B) — deferred to CONV-F01/F02 in future requirements.
- Decision tree assertions — deferred to future.

</deferred>

---

*Phase: 16-multi-turn-agent-testing*
*Context gathered: 2026-04-03*
