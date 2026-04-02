# Phase 13: Rich Tool Call Failure Output - Research

**Researched:** 2026-04-02
**Domain:** TypeScript assertion metadata enrichment + terminal reporter formatting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Tool call failures show a numbered list of all actual tool calls with name + arguments
- **D-02:** When `argsMatch` fails, show field-level diff — expected value vs received value for each mismatched key (Vitest expected/received pattern)
- **D-03:** When a tool is missing entirely, show the full call sequence so the user sees what DID happen
- **D-04:** Enrich `AssertionResult.metadata` on tool call failures with structured data: `receivedToolCalls`, `expectedTool`, `expectedArgs`, `argDiffs`
- **D-05:** Assertion layer (`tool-calls.ts`) populates metadata; reporter layer (`pretty.ts`) reads and formats it. Clean separation.
- **D-06:** Passing tool call assertions show tool name + argument count only: `✓ Tool "search" called (3 args)` — dimmed, compact
- **D-07:** No argument dump on passing assertions
- **D-08:** `JSON.stringify(args)` truncated at 500 characters when rendered in pretty reporter
- **D-09:** Truncated output appends `...(truncated)` indicator
- **D-10:** JSON reporter gets full untruncated args (no truncation in structured output)

### Claude's Discretion
- Exact indentation and spacing of the numbered call sequence
- Whether to use color for expected (green) vs received (red) in arg diffs, or a different scheme
- How `computeArgDiffs` helper is structured internally (as long as it returns the diff record)
- Whether to add `argCount` to metadata for passing assertions or compute it in the reporter

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TCOUT-01 | When a tool call assertion fails, the pretty reporter shows the full list of actual tool calls with names and arguments | `metadata.receivedToolCalls` array; `formatAssertion()` branch in `pretty.ts` |
| TCOUT-02 | When `argsMatch` fails, the failure output highlights which specific argument fields differ (expected vs received) | `computeArgDiffs()` helper in `tool-calls.ts`; `metadata.argDiffs` rendered by reporter |
| TCOUT-03 | Tool call failure output includes a numbered call sequence showing all tool calls in execution order | Numbered list rendered from `metadata.receivedToolCalls` using `tc.index` or array position |
| TCOUT-04 | Tool call arguments longer than 500 characters are truncated with a `...(truncated)` indicator | `truncateArgs()` helper in `pretty.ts`; applied only in pretty reporter, not JSON reporter |
| TCOUT-05 | Passing tool call assertions show only the tool name and argument count (no full args) | Reporter branch: `assertionType === "tool_called"` + `passed === true` → `(N args)` label |
| TCOUT-06 | All rich failure formatting uses the injected `Colorize` interface (no direct chalk calls in core) | `Colorize` already injected into `formatAssertion()`; use `c.red`/`c.green` for diff coloring |
</phase_requirements>

---

## Summary

Phase 13 is a pure enrichment phase: two files in `@kindlm/core` change (`tool-calls.ts` and `pretty.ts`), with corresponding test additions. No new types, no new packages, no new exports. The existing judge-reasoning pattern in `pretty.ts` (lines 118-123) is the direct template — the planner should follow it for tool call metadata extraction.

The assertion layer already has `partialDeepMatch()` and `matchArgs()`. These need a new sibling `computeArgDiffs()` that returns `Record<string, { expected: unknown; received: unknown }>` for each key where `partialDeepMatch` returns false. The `matchArgs()` function stays boolean for the pass/fail verdict; `computeArgDiffs` is called only on failure to populate metadata.

The reporter layer's `formatAssertion()` function needs one new branch: when `assertionType` is a tool call type (`tool_called`, `tool_not_called`, `tool_order`) and `metadata.receivedToolCalls` is present, render the numbered call sequence and arg diffs instead of the bare `failureMessage`. Passing tool call assertions already render via the generic path — only the label text changes to include `(N args)`. This label change happens at the assertion layer when `passed: true`.

**Primary recommendation:** Follow the `extractReasoning()` → `formatAssertion()` pattern from judge assertions. Add `extractToolCallDetail()` as the parallel function and call it from `formatAssertion()` for tool call assertion types.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.0 | All implementation | Project standard, strict mode |
| Vitest | 3.2.4 | Test framework | Project standard |

No new dependencies. This phase is pure logic within existing packages.

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Changes
```
packages/core/src/
├── assertions/
│   ├── tool-calls.ts       # Add computeArgDiffs(), enrich metadata on failure,
│   │                       # add (N args) label on pass
│   └── tool-calls.test.ts  # New tests: metadata shape, argDiffs contents, pass label
└── reporters/
    ├── pretty.ts            # Add extractToolCallDetail(), truncateArgs(),
    │                        # tool-call branch in formatAssertion()
    └── pretty.test.ts       # New tests: numbered call list, arg diff lines, truncation
```

### Pattern 1: Metadata Enrichment at Assertion Layer (existing precedent — judge)

The `AssertionResult.metadata` field is `Record<string, unknown>`. On failure, populate it with everything the reporter needs. The reporter must not re-derive data from `failureMessage` strings.

```typescript
// In tool-calls.ts — on TOOL_CALL_MISSING failure
results.push({
  assertionType: "tool_called",
  label: `Tool "${tool}" called`,
  passed: false,
  score: 0,
  failureCode: "TOOL_CALL_MISSING",
  failureMessage: `Expected tool "${tool}" to be called`,
  metadata: {
    receivedToolCalls: context.toolCalls,   // full ProviderToolCall[]
    expectedTool: tool,
    expectedArgs: undefined,
    argDiffs: undefined,
  },
});

// On TOOL_CALL_ARGS_MISMATCH failure
const diffs = computeArgDiffs(matching[0].arguments, argsMatch);
results.push({
  assertionType: "tool_called",
  label: `Tool "${tool}" args match`,
  passed: false,
  score: 0,
  failureCode: "TOOL_CALL_ARGS_MISMATCH",
  failureMessage: `Tool "${tool}" args mismatch`,
  metadata: {
    receivedToolCalls: context.toolCalls,
    expectedTool: tool,
    expectedArgs: argsMatch,
    argDiffs: diffs,
  },
});

// On pass — include arg count in label
results.push({
  assertionType: "tool_called",
  label: `Tool "${tool}" called (${Object.keys(matching[0].arguments).length} args)`,
  passed: true,
  score: 1,
});
```

### Pattern 2: computeArgDiffs Helper

```typescript
// In tool-calls.ts — pure function, no I/O
function computeArgDiffs(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): Record<string, { expected: unknown; received: unknown }> {
  const diffs: Record<string, { expected: unknown; received: unknown }> = {};
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!(key in actual) || !partialDeepMatch(actual[key], expectedValue)) {
      diffs[key] = { expected: expectedValue, received: actual[key] };
    }
  }
  return diffs;
}
```

### Pattern 3: Reporter Extraction + Formatting (mirrors extractReasoning)

```typescript
// In pretty.ts — parallel to extractReasoning()
function extractToolCallDetail(a: AssertionResult): {
  receivedToolCalls?: ProviderToolCall[];
  expectedTool?: string;
  expectedArgs?: Record<string, unknown>;
  argDiffs?: Record<string, { expected: unknown; received: unknown }>;
} | null {
  const toolCallTypes = ["tool_called", "tool_not_called", "tool_order"];
  if (!toolCallTypes.includes(a.assertionType)) return null;
  if (!a.metadata || typeof a.metadata !== "object") return null;
  return a.metadata as ReturnType<typeof extractToolCallDetail>;
}

function truncateArgs(json: string): string {
  if (json.length <= 500) return json;
  return json.slice(0, 500) + "...(truncated)";
}

// In formatAssertion() — failure branch
const detail = extractToolCallDetail(a);
if (!a.passed && detail?.receivedToolCalls) {
  const callList = detail.receivedToolCalls
    .map((tc, i) => {
      const args = truncateArgs(JSON.stringify(tc.arguments));
      return `        ${i + 1}. ${tc.name}(${args})`;
    })
    .join("\n");
  // ... append diff lines for argDiffs
}
```

### Pattern 4: Arg Diff Rendering

Use `c.red()` for received values and `c.green()` for expected values — consistent with Vitest's expected/received convention. Each diff key gets its own line under the call list.

```typescript
// Diff section under the call list
if (detail.argDiffs) {
  const diffLines = Object.entries(detail.argDiffs).map(([key, { expected, received }]) =>
    `          ${key}:\n` +
    `            ${c.green("expected:")} ${JSON.stringify(expected)}\n` +
    `            ${c.red("received:")} ${JSON.stringify(received)}`
  );
  // append to formatted output
}
```

### Anti-Patterns to Avoid
- **Parsing failureMessage strings in reporter:** Reporter must read structured `metadata`, never parse string messages. Metadata is set at assertion time.
- **Adding chalk imports to core:** `@kindlm/core` has zero I/O. All coloring must go through the injected `Colorize` interface. The `Colorize` type already has `red` and `green` — use those.
- **Truncating in the assertion layer:** Truncation is a display concern only. `metadata.receivedToolCalls` stores full data. `pretty.ts` applies the 500-char truncation. The JSON reporter reads metadata directly and never truncates.
- **Breaking existing label tests:** The `pretty.test.ts` test at line 76 expects `'✓ Tool "lookup_order" called'`. If arg count is added to passing labels at assertion layer, existing test helpers (like `makeRunResult()`) must be updated or the label approach changed. Consider adding arg count only when `arguments` is non-empty, or handle it in the reporter rather than assertion layer.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON diffing | Custom recursive differ | `computeArgDiffs()` — shallow key-level diff over `expected` keys | `argsMatch` is already shallow-partial; diff only needs to cover expected keys |
| String truncation | Complex truncation logic | Simple `json.slice(0, 500) + "...(truncated)"` | Sufficient for display; content after 500 chars is rarely diagnostic |
| ANSI color | Direct chalk calls | `Colorize` interface methods | CI safety — `noColor` identity in tests, chalk in CLI |

---

## Common Pitfalls

### Pitfall 1: Existing Test Label Mismatch
**What goes wrong:** `pretty.test.ts` line 76 asserts `'✓ Tool "lookup_order" called'` — adding `(N args)` to labels in assertion layer breaks this test and any downstream test that checks exact label strings.
**Why it happens:** The `makeRunResult()` helper in the test file has hardcoded assertion label strings.
**How to avoid:** Either (a) generate the `(N args)` suffix in the reporter from `metadata.argCount` so labels remain unchanged, or (b) update all affected test fixtures. Option (a) is lower risk.
**Warning signs:** `vitest` output showing string inequality on label assertions.

### Pitfall 2: Tool Order Assertion Missing receivedToolCalls
**What goes wrong:** `createToolOrderAssertion` has multiple result-push sites. If only `createToolCalledAssertion` populates metadata, TCOUT-01/03 are incomplete for `tool_order` assertion type.
**Why it happens:** Three separate assertion factories in `tool-calls.ts` each have their own failure paths.
**How to avoid:** Audit all three factories — `createToolCalledAssertion`, `createToolNotCalledAssertion`, `createToolOrderAssertion` — and ensure each failure result includes `receivedToolCalls`.

### Pitfall 3: Type Import in pretty.ts for ProviderToolCall
**What goes wrong:** `pretty.ts` currently imports from assertion and engine types only. Adding `ProviderToolCall` from `types/provider.ts` requires a new import.
**Why it happens:** First time reporter needs provider types.
**How to avoid:** Add `import type { ProviderToolCall } from "../types/provider.js"` using `verbatimModuleSyntax` pattern.

### Pitfall 4: metadata type is Record<string, unknown>
**What goes wrong:** Accessing `metadata.receivedToolCalls` requires a cast. TypeScript will not narrow `unknown` to `ProviderToolCall[]` without a type guard.
**Why it happens:** `AssertionResult.metadata` is intentionally loosely typed for flexibility.
**How to avoid:** Cast via `(a.metadata as ToolCallMetadata)` where `ToolCallMetadata` is a local interface in `pretty.ts`, or use inline type narrowing with `Array.isArray` guard.

### Pitfall 5: Empty args object counts as "(0 args)"
**What goes wrong:** `Object.keys(matching[0].arguments).length` returns 0 for `{}`. `Tool "search" called (0 args)` looks odd vs just `Tool "search" called`.
**Why it happens:** Many tool calls have no required args.
**How to avoid:** Omit arg count when args is empty — `args.length > 0 ? \`(\${n} args)\` : ""`.

---

## Code Examples

### Verified: extractReasoning pattern (source: pretty.ts lines 118-123)
```typescript
function extractReasoning(a: AssertionResult): string | null {
  if (a.assertionType !== "judge") return null;
  if (!a.metadata || typeof a.metadata !== "object") return null;
  const r = (a.metadata as Record<string, unknown>)["reasoning"];
  if (typeof r !== "string" || r.trim() === "") return null;
  return r;
}
```
The `extractToolCallDetail()` function follows identical structure: guard on `assertionType`, guard on `metadata` existence, cast and return.

### Verified: mockColorize pattern for testing (source: pretty.test.ts lines 233-243)
```typescript
const mockColorize = {
  green: (s: string) => `[green]${s}[/green]`,
  red: (s: string) => `[red]${s}[/red]`,
  // ... etc
};
```
New reporter tests for arg diffs should use `mockColorize` and assert `[green]expected:[/green]` and `[red]received:[/red]` markers appear.

### Verified: Test context factory (source: tool-calls.test.ts lines 9-18)
```typescript
function ctx(toolCalls: AssertionContext["toolCalls"] = []): AssertionContext {
  return { outputText: "", toolCalls, configDir: "/tmp" };
}
function tc(name: string, args: Record<string, unknown> = {}, index = 0) {
  return { id: `call_${name}`, name, arguments: args, index };
}
```
New metadata tests reuse these helpers and assert `results[N].metadata` shape.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `/Users/petr/projects/kindlm/vitest.config.ts` |
| Quick run command | `cd /Users/petr/projects/kindlm && npx vitest run packages/core/src/assertions/tool-calls.test.ts packages/core/src/reporters/pretty.test.ts` |
| Full suite command | `cd /Users/petr/projects/kindlm && npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TCOUT-01 | Pretty reporter shows full tool call list on failure | unit | quick run command above | ✅ (new tests in existing file) |
| TCOUT-02 | Arg diff shows expected vs received per field | unit | quick run command above | ✅ |
| TCOUT-03 | Numbered call sequence in failure output | unit | quick run command above | ✅ |
| TCOUT-04 | Args truncated at 500 chars with `...(truncated)` | unit | quick run command above | ✅ |
| TCOUT-05 | Passing tool call assertions show name + arg count only | unit | quick run command above | ✅ |
| TCOUT-06 | No direct chalk calls in core — only Colorize interface | unit (mockColorize) | quick run command above | ✅ |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/src/assertions/tool-calls.test.ts packages/core/src/reporters/pretty.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. New tests are additions to `tool-calls.test.ts` and `pretty.test.ts` (both exist). No new test files or framework config needed.

---

## Open Questions

1. **Label change location for TCOUT-05**
   - What we know: `(N args)` must appear on passing tool call assertions
   - What's unclear: Assert layer (changes `label` field) vs reporter layer (modifies display only). Changing at assert layer breaks existing label-string test assertions in `pretty.test.ts`.
   - Recommendation: Generate the `(N args)` display suffix in the reporter from `metadata` (store `argCount` in metadata on pass, compute display in `formatAssertion`). This keeps `label` strings stable and avoids fixture churn.

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `packages/core/src/assertions/tool-calls.ts` — full implementation, all three factories
- Direct source read: `packages/core/src/reporters/pretty.ts` — `formatAssertion()` and `extractReasoning()` pattern
- Direct source read: `packages/core/src/assertions/interface.ts` — `AssertionResult` shape
- Direct source read: `packages/core/src/reporters/interface.ts` — `Colorize` interface
- Direct source read: `packages/core/src/types/provider.ts` — `ProviderToolCall` type
- Direct source read: `packages/core/src/assertions/tool-calls.test.ts` — test helper patterns
- Direct source read: `packages/core/src/reporters/pretty.test.ts` — `mockColorize`, existing label assertions

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-10 — design decisions verified against code structure

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all code read directly
- Architecture: HIGH — patterns derived from reading actual source files
- Pitfalls: HIGH — derived from specific code inspection (label string test at line 76, three assertion factories, verbatimModuleSyntax enforcement)

**Research date:** 2026-04-02
**Valid until:** Stable (no fast-moving dependencies; pure internal TypeScript)
