# Phase 16: Multi-Turn Agent Testing - Research

**Researched:** 2026-04-03
**Domain:** TypeScript / Zod schema extension / assertion pipeline / reporter grouping
**Confidence:** HIGH

## Summary

The conversation infrastructure is ~85% built. `runConversation()` in `packages/core/src/providers/conversation.ts` runs a full tool-simulation loop with `ConversationTurn[]` already returned. The `ConversationResult` type exposes every turn's `request`/`response` pair. The engine's `buildAssertionContext()` in `runner.ts` currently reads only `conversation.finalText` and `conversation.allToolCalls`, ignoring per-turn data.

The three remaining gaps are: (1) a `conversation:` Zod schema on `TestCaseSchema` with unique turn labels and per-turn `expect:`; (2) per-turn assertion evaluation in `executeUnit()` — each labeled turn's response is extracted and evaluated independently, with `turnLabel` injected into `AssertionResult.metadata`; (3) the pretty reporter needs a turn-grouping branch that reads `metadata.turnLabel` and emits indented separator lines.

**Primary recommendation:** Extend existing types and pipelines — no new modules needed. The work is pure wiring: schema → runner → reporter.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add a `conversation:` array field to `TestCaseSchema` in Zod schema. Each entry has: `turn` (string label, required), `user` (optional user message for this turn), `expect` (optional, same `ExpectSchema` as single-turn tests).
- **D-02:** When `conversation:` is present, `prompt` is still required (defines the initial system+user message). Subsequent turns in `conversation:` can override the user message.
- **D-03:** Turn labels must be unique within a test case — Zod `.refine()` validates this.
- **D-04:** YAML format (see CONTEXT.md §D-04 for canonical example).
- **D-05:** When `conversation:` is defined, `runConversation` must expose per-turn responses. After each turn, evaluate that turn's `expect:` block against the response from that specific turn.
- **D-06:** The existing single `expect:` on the test case (outside `conversation:`) evaluates against the FINAL turn's response — backward compatible.
- **D-07:** Assertion results carry `turnLabel` in metadata so the reporter can group them.
- **D-08:** The existing `tools[].responses[].when/then` pattern IS the "onToolCall" mapping — no rename needed.
- **D-09:** Document that `tools[].responses` is the YAML equivalent of the "onToolCall" concept.
- **D-10:** `maxTurns` already implemented — no new work.
- **D-11:** Conversation state isolation already implemented — no new work.
- **D-12:** Conversation runner architecture already implemented — no new work.
- **D-13:** Pretty reporter groups assertions under indented turn headers when `metadata.turnLabel` is present.
- **D-14:** JSON and JUnit reporters include `turnLabel` in output structures but need no special grouping.

### Claude's Discretion

- Internal refactoring of `runConversation` to support per-turn assertion evaluation (may need callback or return per-turn results).
- Whether to add `maxTurns` to the `conversation:` schema level or keep it only at test level.
- Exact separator style for turn headers in pretty reporter.

### Deferred Ideas (OUT OF SCOPE)

- Conditional branching (if tool A fails → expect tool B) — CONV-F01/F02.
- Decision tree assertions — future.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONV-01 | Users can define multi-turn conversations in YAML with labeled turns under a `conversation:` block | Add `conversation:` array to `TestCaseSchema` (D-01 to D-04) |
| CONV-02 | Each turn has its own `expect:` block supporting all existing assertion types | Per-turn assertion loop in `executeUnit()` using `createAssertionsFromExpect()` (D-05, D-07) |
| CONV-03 | Users can define mock tool responses via `onToolCall` mapping (tool name → response payload) | Already satisfied by `tools[].responses[].when/then` — document only (D-08, D-09) |
| CONV-04 | `maxTurns` config field limits conversation length (default 10, max 20), failing with `MAX_TURNS_EXCEEDED` if exceeded | Already implemented in `conversation.ts` line 11; `truncated: true` signals exceedance (D-10). Verify max cap of 20 is enforced in schema. |
| CONV-05 | Conversation state is isolated per test case | Already implemented — `messages` is local to each `runConversation` call (D-11) |
| CONV-06 | Conversation runner lives in `@kindlm/core` as a pure state machine with no I/O dependencies | Already implemented — `conversation.ts` has zero I/O (D-12) |
| CONV-07 | Pretty reporter groups assertion results by turn label | Reporter `formatTest()` needs a turn-grouping branch reading `metadata.turnLabel` (D-13) |
| CONV-08 | Zod schema validates conversation config with clear error messages for missing turn labels or invalid structure | `.refine()` for unique labels, `.describe()` for field-level messages (D-03, D-08) |
</phase_requirements>

---

## Standard Stack

### Core (all already present — no new installs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 3.x (existing) | Schema validation | Project-wide standard for config and API validation |
| vitest | 3.2.4 (existing) | Unit tests | Project-wide test framework |
| TypeScript | 5.7.0 (existing) | Type checking | Project standard |

**No new dependencies.** All work is extension of existing code.

---

## Architecture Patterns

### Recommended: Minimal Surgery Approach

The existing `ConversationTurn[]` array in `ConversationResult` already holds every turn's `request` and `response`. The simplest implementation does not change `runConversation`'s signature at all — the runner already has the full turn array after the call returns.

### Pattern 1: Schema Extension (CONV-01, CONV-02, CONV-08)

Add a `ConversationTurnSchema` and attach it to `TestCaseSchema`:

```typescript
// packages/core/src/config/schema.ts

const ConversationTurnSchema = z.object({
  turn: NonEmptyString.describe("Unique label for this conversation turn"),
  user: z.string().optional().describe("User message override for this turn"),
  expect: ExpectSchema.optional().describe(
    "Assertions evaluated against this turn's response",
  ),
});

// Inside TestCaseSchema, add:
conversation: z
  .array(ConversationTurnSchema)
  .optional()
  .describe("Labeled turns with per-turn assertions for multi-turn agent tests"),
```

Then add a `.superRefine()` to `TestCaseSchema` (or extend the existing `.refine()`) that checks turn label uniqueness:

```typescript
.superRefine((test, ctx) => {
  if (test.conversation) {
    const labels = test.conversation.map((t) => t.turn);
    const seen = new Set<string>();
    for (const label of labels) {
      if (seen.has(label)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate turn label "${label}" — turn labels must be unique within a test case`,
        });
        return;
      }
      seen.add(label);
    }
  }
})
```

**Important:** The existing `.refine()` on `TestCaseSchema` checks that exactly one of `prompt`/`command` is set. Replacing it with `.superRefine()` lets both validations coexist cleanly.

### Pattern 2: Per-Turn Assertion Evaluation in runner.ts (CONV-02, CONV-07)

`runConversation` returns `turns: ConversationTurn[]`. When `test.conversation` is defined, map labeled turns onto the returned `turns` array by index (turn N in YAML corresponds to index N in `turns`):

```typescript
// In executeUnit(), after runConversation():

const perTurnResults: AssertionResult[] = [];

if (test.conversation) {
  for (let i = 0; i < test.conversation.length; i++) {
    const turnDef = test.conversation[i];
    if (!turnDef.expect) continue;
    const turnResponse = conversation.turns[i];
    if (!turnResponse) continue;  // truncated conversation

    const turnContext: AssertionContext = {
      outputText: turnResponse.response.text,
      toolCalls: turnResponse.response.toolCalls,
      configDir: deps.configDir,
      latencyMs: turnResponse.response.latencyMs,
      // judgeAdapter, costUsd, etc. not applicable per-turn
    };

    const turnAssertions = createAssertionsFromExpect(turnDef.expect);
    const turnAssertionResults = await runAssertions(turnAssertions, turnContext);

    // Stamp turnLabel into metadata for reporter grouping
    for (const r of turnAssertionResults) {
      r.metadata = { ...r.metadata, turnLabel: turnDef.turn };
    }

    perTurnResults.push(...turnAssertionResults);
  }
}

// Run final-turn assertions (existing `test.expect`, D-06)
const { assertions, context } = buildAssertionContext(conversation, test, ...);
const finalResults = await runAssertions(assertions, context);

const allResults = [...perTurnResults, ...finalResults];
```

**Key decision (discretion):** Per-turn `AssertionContext` uses only the specific turn's response (`toolCalls` = that turn's tool calls only, `outputText` = that turn's text). The final `test.expect` block continues to use `conversation.allToolCalls` and `conversation.finalText` unchanged.

### Pattern 3: Reporter Turn Grouping (CONV-07)

In `pretty.ts`, after printing test meta, group assertions by `turnLabel`:

```typescript
// In the assertion loop inside formatReport():

// Group assertions by turnLabel
const byTurn = new Map<string | undefined, AssertionResult[]>();
for (const a of test.assertions) {
  const label = a.metadata?.turnLabel as string | undefined;
  const bucket = byTurn.get(label) ?? [];
  bucket.push(a);
  byTurn.set(label, bucket);
}

// Emit: unlabeled assertions first (final-turn), then labeled turns
const unlabeled = byTurn.get(undefined) ?? [];
for (const a of unlabeled) {
  lines.push(formatAssertion(a, c));
}

for (const [label, assertions] of byTurn) {
  if (label === undefined) continue;
  lines.push(`      ${c.dim(`── Turn: ${label} ──`)}`);
  for (const a of assertions) {
    lines.push(formatAssertion(a, c));
  }
}
```

**Separator style (discretion):** `── Turn: {label} ──` in `c.dim()` matches the existing dim styling used for metadata lines.

### Pattern 4: maxTurns cap of 20 (CONV-04)

The `maxTurns` option is passed to `runConversation()`. CONV-04 requires a max of 20 enforced at schema level. Add to `TestCaseSchema`:

```typescript
maxTurns: z.number().int().min(1).max(20).optional()
  .describe("Maximum conversation turns (default 10, max 20). Fails with truncated:true if exceeded."),
```

Then in runner.ts pass `maxTurns: test.maxTurns` to `runConversation`. When `conversation.truncated === true`, inject a synthetic failing assertion result with `failureCode: "INTERNAL_ERROR"` and message `MAX_TURNS_EXCEEDED`.

### Anti-Patterns to Avoid

- **Modifying `runConversation` to accept callbacks:** Not needed — the turn array is already returned. Adding callbacks adds unnecessary complexity.
- **Mutating `AssertionResult` objects after `evaluate()` returns:** Stamp `turnLabel` into metadata in the runner loop (not inside each assertion), keeping assertions unaware of turn context.
- **Using `conversation.allToolCalls` for per-turn assertions:** Per-turn assertions must use only that turn's `response.toolCalls`, not the aggregate. Using the aggregate would make tool-call order assertions incorrect.
- **Grouping in JSON/JUnit reporters by structural changes:** D-14 says include `turnLabel` in existing output structures — do not restructure the JSON or JUnit output shape.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique turn label validation | Custom loop | Zod `.superRefine()` | Already the project pattern for cross-field validation |
| Per-turn assertion evaluation | New assertion module | Reuse `createAssertionsFromExpect()` | Same `Expect` type, same factory — no new code path |
| Tool response mocking | New mocking layer | Existing `ToolSimulationSchema` `when`/`then` | Already works; adding another layer would create duplicate concepts |
| Turn grouping in output | Custom string formatter | Extend existing `formatAssertion()` loop | Reporter already has all the primitives |

---

## Common Pitfalls

### Pitfall 1: Turn index vs. conversation turn array misalignment
**What goes wrong:** `test.conversation[i]` binds to `conversation.turns[i]` by index. If `maxTurns` is exceeded, `turns` may be shorter than `conversation`. The runner must guard `if (!turnResponse) continue` and never throw on missing turns.
**How to avoid:** Explicit length check before indexing. Add a test for truncated conversation path.
**Warning signs:** TypeScript `undefined` errors on `conversation.turns[i]` — avoid with `?.`.

### Pitfall 2: Per-turn `toolCalls` context
**What goes wrong:** Using `conversation.allToolCalls` (aggregate across all turns) as the `AssertionContext.toolCalls` for a per-turn assertion causes tool-call order assertions to fail erroneously because they see calls from other turns.
**How to avoid:** Each per-turn `AssertionContext` must use `turnResponse.response.toolCalls` only.

### Pitfall 3: `.refine()` → `.superRefine()` migration
**What goes wrong:** `TestCaseSchema` already uses `.refine()` to check prompt/command exclusivity. Chaining another `.refine()` after the first is valid but `.superRefine()` is the correct pattern for multiple cross-field validations with distinct messages.
**How to avoid:** Migrate the existing `.refine()` to `.superRefine()` in the same commit that adds the turn-label uniqueness check. Do not leave two `.refine()` calls — one will silently shadow the other if both return the same path.

### Pitfall 4: Backward compatibility with single `expect:` tests
**What goes wrong:** If the runner processes `test.conversation` assertions but forgets to also run `test.expect`, tests without `conversation:` break silently.
**How to avoid:** D-06 is explicit — `test.expect` always runs against `conversation.finalText`. Per-turn results are additive, not replacements.

### Pitfall 5: `metadata` mutation on shared `AssertionResult`
**What goes wrong:** Assertions return `AssertionResult` objects. If the same assertion instance is reused across runs (e.g., `repeat: 3`), stamping `turnLabel` onto the result object mutates a shared reference.
**How to avoid:** Spread before mutation: `r.metadata = { ...r.metadata, turnLabel: turnDef.turn }` (creates a new object, not a mutation of the returned reference).

---

## Code Examples

### Adding `conversation:` to TestCaseSchema
```typescript
// packages/core/src/config/schema.ts
// Source: verified against existing schema patterns in this file

const ConversationTurnSchema = z.object({
  turn: NonEmptyString.describe("Unique label for this turn"),
  user: z.string().optional().describe("User message for this turn"),
  expect: ExpectSchema.optional().describe("Per-turn assertions"),
});

// In TestCaseSchema object:
conversation: z.array(ConversationTurnSchema).optional()
  .describe("Multi-turn conversation definition with labeled turns"),

// Replace existing .refine() with .superRefine() to add unique-label check:
.superRefine((test, ctx) => {
  const hasPrompt = test.prompt !== undefined;
  const hasCommand = test.command !== undefined;
  if (!(hasPrompt || hasCommand) || (hasPrompt && hasCommand)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one of 'prompt' or 'command' must be set on each test case",
    });
  }
  if (test.conversation) {
    const seen = new Set<string>();
    for (const t of test.conversation) {
      if (seen.has(t.turn)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate turn label "${t.turn}" — turn labels must be unique`,
        });
      }
      seen.add(t.turn);
    }
  }
})
```

### Per-turn assertion stamping in runner.ts
```typescript
// Source: verified against runner.ts executeUnit() call site

for (const r of turnAssertionResults) {
  r.metadata = { ...r.metadata, turnLabel: turnDef.turn };
}
```

### Pretty reporter turn grouping
```typescript
// Source: verified against pretty.ts formatReport() loop
// Place after `const meta = formatTestMeta(test, c)` block

const grouped = new Map<string | undefined, AssertionResult[]>();
for (const a of test.assertions) {
  const label = (a.metadata?.turnLabel as string | undefined);
  const list = grouped.get(label) ?? [];
  list.push(a);
  grouped.set(label, list);
}
// Unlabeled (final-turn expect:) first
for (const a of grouped.get(undefined) ?? []) {
  lines.push(formatAssertion(a, c));
}
// Then labeled turns
for (const [label, assertions] of grouped) {
  if (!label) continue;
  lines.push(`      ${c.dim(`── Turn: ${label} ──`)}`);
  for (const a of assertions) lines.push(formatAssertion(a, c));
}
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/config-only with no external dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test -- --reporter=verbose packages/core/src/providers/conversation.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONV-01 | `conversation:` YAML parses and validates correctly | unit | `vitest run packages/core/src/config/schema.test.ts` | Check existing |
| CONV-02 | Per-turn assertions evaluate against correct turn response | unit | `vitest run packages/core/src/engine/runner.test.ts` | Check existing |
| CONV-03 | `tools[].responses` when/then mocking works | unit | `vitest run packages/core/src/providers/conversation.test.ts` | ✅ exists |
| CONV-04 | Truncated conversation produces `MAX_TURNS_EXCEEDED` result | unit | `vitest run packages/core/src/providers/conversation.test.ts` | ✅ exists |
| CONV-05 | State isolation between test cases | unit | `vitest run packages/core/src/providers/conversation.test.ts` | ✅ exists |
| CONV-06 | `runConversation` has zero I/O dependencies | design | `npx tsc --noEmit` (import check) | N/A |
| CONV-07 | Pretty reporter groups by `turnLabel` | unit | `vitest run packages/core/src/reporters/pretty.test.ts` | Check existing |
| CONV-08 | Zod rejects duplicate turn labels with clear message | unit | `vitest run packages/core/src/config/schema.test.ts` | Check existing |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/src/providers/conversation.test.ts`
- **Per wave merge:** `npm run test && npm run typecheck`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
Check whether these test files exist and contain multi-turn coverage:
- [ ] `packages/core/src/config/schema.test.ts` — needs `conversation:` parse + unique label rejection cases
- [ ] `packages/core/src/engine/runner.test.ts` — needs per-turn assertion result with `turnLabel` in metadata
- [ ] `packages/core/src/reporters/pretty.test.ts` — needs turn-grouped output snapshot

---

## Sources

### Primary (HIGH confidence)
- Direct code read of `packages/core/src/providers/conversation.ts` — full implementation verified
- Direct code read of `packages/core/src/config/schema.ts` lines 380-478 — `ToolSimulationSchema` and `TestCaseSchema` verified
- Direct code read of `packages/core/src/engine/runner.ts` lines 367-519 — `buildAssertionContext` and `executeUnit` call site verified
- Direct code read of `packages/core/src/assertions/interface.ts` — `AssertionResult.metadata` field confirmed
- Direct code read of `packages/core/src/reporters/pretty.ts` — existing `formatAssertion` and assertion loop verified
- Direct code read of `packages/core/src/types/provider.ts` lines 119-133 — `ConversationTurn` / `ConversationResult` verified
- `.planning/phases/16-multi-turn-agent-testing/16-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — CONV-01 through CONV-08 requirement text verified
- `.planning/STATE.md` — project state verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified in source
- Architecture: HIGH — all integration points confirmed by direct code reads
- Pitfalls: HIGH — derived directly from code structure, not speculation

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable codebase, no fast-moving external deps)
