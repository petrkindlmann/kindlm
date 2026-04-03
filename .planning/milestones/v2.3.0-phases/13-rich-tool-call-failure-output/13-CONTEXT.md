# Phase 13: Rich Tool Call Failure Output - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Enrich tool call assertion failure output so developers can see exactly which tool calls were made, in what order, and how arguments differed from expectations. Passing assertions stay compact. All formatting uses the Colorize interface for CI safety.

</domain>

<decisions>
## Implementation Decisions

### Failure format
- **D-01:** Tool call failures show a numbered list of all actual tool calls with name + arguments
- **D-02:** When `argsMatch` fails, show field-level diff — expected value vs received value for each mismatched key (inspired by Vitest's expected/received pattern)
- **D-03:** When a tool is missing entirely, show the full call sequence so the user sees what DID happen

### Metadata structure
- **D-04:** Enrich `AssertionResult.metadata` on tool call failures with structured data:
  - `receivedToolCalls`: full `ProviderToolCall[]` array (names + args)
  - `expectedTool`: the expected tool name
  - `expectedArgs`: the expected argsMatch pattern (if any)
  - `argDiffs`: `Record<string, { expected: unknown; received: unknown }>` for mismatched fields
- **D-05:** The assertion layer (`tool-calls.ts`) populates metadata; the reporter layer (`pretty.ts`) reads and formats it. Clean separation.

### Passing output
- **D-06:** Passing tool call assertions show tool name + argument count only: `✓ Tool "search" called (3 args)` — dimmed, compact
- **D-07:** No argument dump on passing assertions — prevents information overload

### Truncation
- **D-08:** `JSON.stringify(args)` truncated at 500 characters when rendered in pretty reporter
- **D-09:** Truncated output appends `...(truncated)` indicator
- **D-10:** JSON reporter gets full untruncated args (no truncation in structured output)

### Claude's Discretion
- Exact indentation and spacing of the numbered call sequence
- Whether to use color for expected (green) vs received (red) in arg diffs, or a different scheme
- How `computeArgDiffs` helper is structured internally (as long as it returns the diff record)
- Whether to add `argCount` to metadata for passing assertions or compute it in the reporter

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Assertion layer
- `packages/core/src/assertions/tool-calls.ts` — Current tool call assertions (createToolCalledAssertion, createToolNotCalledAssertion, createToolOrderAssertion). Failure messages are bare strings. metadata is unused. This is where enrichment goes.
- `packages/core/src/assertions/interface.ts` — AssertionResult type with metadata field, FailureCode union, AssertionContext with toolCalls array
- `packages/core/src/assertions/tool-calls.test.ts` — Existing test suite. New tests for metadata population needed.

### Reporter layer
- `packages/core/src/reporters/pretty.ts` — formatAssertion() function at line 126. Currently shows label + failureMessage. Needs tool-call-specific formatting branch (same pattern as judge reasoning extraction at line 118).
- `packages/core/src/reporters/interface.ts` — Colorize interface with bold, red, green, dim, cyan methods. noColor identity implementation for testing.
- `packages/core/src/reporters/pretty.test.ts` — Existing reporter tests.

### Type definitions
- `packages/core/src/types/provider.ts` — ProviderToolCall type (name: string, arguments: Record<string, unknown>)

### Research
- `.planning/research/PITFALLS.md` §Pitfall 10 — ANSI codes in CI. Use Colorize, not direct chalk.
- `.planning/research/FEATURES.md` §Rich Tool Call Failure Output — table stakes and differentiators.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `partialDeepMatch()` in `tool-calls.ts` — Already does the comparison, can be extended to report WHICH fields differ
- `matchArgs()` in `tool-calls.ts` — Entry point for arg matching, can return diff info instead of just boolean
- `extractReasoning()` in `pretty.ts` — Pattern for type-specific metadata extraction from AssertionResult
- `formatAssertion()` in `pretty.ts` — Main extension point for rich output
- `Colorize` interface — Already injected into all reporter functions, use for expected/received coloring

### Established Patterns
- Assertion metadata is `Record<string, unknown>` — flexible, no schema enforcement
- Reporter uses type-specific formatting branches (judge reasoning is the precedent)
- `noColor` identity implementation enables testing formatters without ANSI

### Integration Points
- `tool-calls.ts` → `AssertionResult.metadata` — assertion populates structured failure data
- `pretty.ts` `formatAssertion()` — reporter reads metadata and renders rich output
- `tool-calls.test.ts` — verify metadata is populated correctly
- `pretty.test.ts` — verify formatted output includes call sequence and arg diffs

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key reference: Vitest's expected/received diff pattern for argument mismatches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-rich-tool-call-failure-output*
*Context gathered: 2026-04-02*
