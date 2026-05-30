# Phase 20: Trajectory Metrics - Research

**Researched:** 2026-04-09
**Domain:** Agent evaluation metrics — tool-call trajectory scoring
**Confidence:** HIGH

## Summary

Port the Vertex AI / Google ADK trajectory vocabulary (`trajectory_precision`, `trajectory_recall`, `trajectory_exact_match`) into KindLM as three new first-class assertion types in `expect:`. Formulas are public, simple, and already standard among enterprise buyers. DeepEval's `ToolCorrectnessMetric` converges on the same formulas with a `should_consider_ordering` toggle, which maps cleanly to TRAJ-04 (`ordered: true/false`).

The data foundation already exists: `context.toolCalls` in `AssertionContext` is the full ordered `ProviderToolCall[]` sequence (verified in `interface.ts` line 42, and in v2.4 market signal Q10). No changes needed to the provider layer or runner. This is a pure additive core-only phase: new Zod schema fields, new assertion module, new registry wiring, unit tests, and docs. No migration required for existing `toolCalls:` users — the new `trajectory:` block sits alongside.

**Primary recommendation:** Add a single new optional `expect.trajectory` object (not an array) holding a `reference[]` plus three independent metric flags. Implement one shared `createTrajectoryAssertion` factory that emits up to three `AssertionResult`s from a single pass over the data. Match on `(tool_name, normalizedArgs)` by default (Vertex AI "action" semantics), with an opt-out `matchArgs: false` escape hatch for users who only care about the tool sequence.

## User Constraints (from CONTEXT.md)

**No CONTEXT.md exists for this phase.** The phase is executing under v2.4.0 yolo-mode research-disabled workflow (`.planning/config.json`: `research_enabled: false`, `plan_checker_enabled: false`). Phase requirements and success criteria from ROADMAP.md and REQUIREMENTS.md are the binding spec.

### Locked by Requirements (TRAJ-01..04)
- Must compute `|predicted ∩ reference| / |predicted|` for precision (TRAJ-01)
- Must compute `|predicted ∩ reference| / |reference|` for recall (TRAJ-02)
- Must return binary 0/1 for exact match with identical tools in identical order (TRAJ-03)
- Must expose an ordering toggle that switches ordered vs any-order matching (TRAJ-04)

### Locked by Project CLAUDE.md
- **No classes** — factory functions only (`createTrajectoryAssertion`)
- **Core zero-I/O** — no `fs`/`fetch`/`console.log` in this code
- **Result types over exceptions** — no throwing from assertion evaluate()
- **`.js` extension** on all relative imports (ESM)
- **`import type`** for type-only imports (`verbatimModuleSyntax: true`)
- **No `any`** — use `unknown` + narrowing
- **Co-located tests** — `trajectory.test.ts` next to `trajectory.ts`
- **Barrel export** — wire through `assertions/index.ts`

### Claude's Discretion
- Shape of the YAML block (single object vs array of metrics)
- How duplicate tool calls in reference/predicted are counted (multiset vs set)
- How to normalize arguments for comparison (deep equal vs canonical JSON)
- Default value of `ordered` flag
- Whether to emit one AssertionResult per metric or bundle them

### Deferred Ideas (OUT OF SCOPE)
- Tool-call diff rendering (Phase 24 — DIFF-01/02/03 owns terminal/PR visualization)
- `tool_correctness` DeepEval formula as separate metric (canonical stack #4) — not in TRAJ-01..04
- `hallucinations_v1` / Google ADK semantic trajectory scoring — v2.5+
- Multi-turn trajectory aggregation across conversation turns — already works because `context.toolCalls` accumulates all turns (verified in v2.4 audit Q10)
- Cost/latency impact of trajectory metrics in reporter output — Phase 22 (Failure-First Terminal) and Phase 27 (docs)

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAJ-01 | `trajectory_precision = \|pred ∩ ref\| / \|pred\|` | Vertex AI formula (direct quote, Part 3.1); multiset implementation below |
| TRAJ-02 | `trajectory_recall = \|pred ∩ ref\| / \|ref\|` | Vertex AI formula (direct quote, Part 3.1); multiset implementation below |
| TRAJ-03 | `trajectory_exact_match` binary on identical tools + order | Vertex AI direct quote: "identical ... exact same tool calls in the exact same order" |
| TRAJ-04 | `ordered: false` toggle switches to any-order matching | DeepEval `should_consider_ordering` + Vertex AI `trajectory_any_order_match` both establish this as standard API |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | `^3.x` (already installed) | Schema extension for `expect.trajectory` | Existing validation surface in `config/schema.ts` |
| vitest | `3.2.4` (already installed) | Unit tests for formulas + integration with registry | Project default |

**No new dependencies required.** [VERIFIED: grep of packages/core/package.json — zod, vitest already in use throughout core]

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reimplementing deep-equal for arg comparison | `fast-deep-equal` | Not worth a new dep — `partialDeepMatch` already exists in `tool-calls.ts` and can be lifted to a shared helper |
| Multiset with `Map<string, number>` counts | Array scan with `splice` | Map-based multiset is O(n+m) vs O(n*m); tool-call sequences are short (typically ≤20) so either works, but Map is cleaner and matches canonical precision/recall implementations |

## Architecture Patterns

### Recommended Structure
```
packages/core/src/assertions/
├── trajectory.ts           # NEW — factory + formula implementations
├── trajectory.test.ts      # NEW — unit tests with golden sequences
├── tool-calls.ts           # UNCHANGED — trajectory is additive, not a replacement
├── registry.ts             # EDIT — new branch for expect.trajectory
├── interface.ts            # EDIT — add 3 new FailureCode values
└── index.ts                # EDIT — barrel export createTrajectoryAssertion
packages/core/src/config/
└── schema.ts               # EDIT — add TrajectoryExpectSchema and wire into ExpectSchema
```

### Pattern 1: Canonical Action Fingerprint
**What:** Reduce each tool call to a stable string "fingerprint" so set/multiset operations are correct.
**When to use:** Both for precision/recall (multiset membership) and exact_match (sequence equality).
**Example:**
```typescript
// Vertex AI semantics: action = (tool_name, tool_input)
function canonicalizeArgs(args: Record<string, unknown>): string {
  // Stable key ordering so {a:1,b:2} and {b:2,a:1} fingerprint identically
  const keys = Object.keys(args).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of keys) ordered[k] = args[k];
  return JSON.stringify(ordered);
}

function fingerprint(
  call: { name: string; arguments: Record<string, unknown> },
  mode: "name" | "name-args",
): string {
  if (mode === "name") return call.name;
  return `${call.name}::${canonicalizeArgs(call.arguments)}`;
}
```
[CITED: derived from Vertex AI action shape `{tool_name, tool_input}` verified in Web search 2026-04-09, and DeepEval's `evaluation_params: INPUT_PARAMETERS` option from Part 2 of market signal]

### Pattern 2: Multiset Intersection (handles duplicates)
**What:** Tool-call sequences commonly call the same tool twice (e.g., `search_orders` called for two different users). A naive Set-based intersection undercounts these. Vertex AI does NOT publicly specify multiset vs set semantics, but the only sensible interpretation for agent evaluation is multiset — otherwise an agent that calls `search_orders` once when the reference calls it three times would score 1.0 precision.
**Example:**
```typescript
function multisetIntersectionSize(a: string[], b: string[]): number {
  const bCounts = new Map<string, number>();
  for (const x of b) bCounts.set(x, (bCounts.get(x) ?? 0) + 1);
  let matched = 0;
  for (const x of a) {
    const n = bCounts.get(x) ?? 0;
    if (n > 0) {
      matched++;
      bCounts.set(x, n - 1);
    }
  }
  return matched;
}
```
[ASSUMED] Multiset interpretation. Vertex AI docs show the formula but do not explicitly state set vs multiset. Flagged for user confirmation in Assumptions Log (A1). Mitigation: document the choice loudly in RESEARCH → DOCS-03 (docs/metrics.md) so users know.

### Pattern 3: One Factory, Multiple Results
**What:** `createTrajectoryAssertion` takes one config object and returns one `Assertion` whose `evaluate()` emits up to 3 `AssertionResult` entries (one per enabled metric). This mirrors the existing tool-call pattern (one assertion, multiple results) and keeps reporter output grouped naturally.
**Why:** Simpler than three separate factories, reuses the single pass over `context.toolCalls`, and lets us compute fingerprints once per run.

### Anti-Patterns to Avoid
- **Replacing existing `toolCalls` assertions:** They already handle `shouldNotCall`, `argsSchema`, `order`. Trajectory metrics are additive — users can mix both in the same `expect:` block.
- **Mutating the expected sequence:** The reference trajectory comes from YAML config. Treat as frozen.
- **Throwing on empty sequences:** If `predicted` is empty, precision is undefined (0/0). Return 0 with a clear `failureMessage` — not `NaN`, not a throw. [ASSUMED] Vertex AI docs do not specify the 0/0 behavior; flagged as A2.
- **Reading files in the assertion:** Reference is inline YAML, not a file ref. Core must stay zero-I/O.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deep argument equality | New deep-equal util | Lift `partialDeepMatch` from `tool-calls.ts` into a shared helper (`assertions/shared/match.ts`) | Already battle-tested with arrays, primitives, nested objects |
| JSON Schema validation of args | Re-implement | Existing `context.validateJsonSchema` injection | Phase 20 doesn't need schema validation, but if it did, the injection pattern already exists |
| YAML parsing of reference | Custom parser | Zod schema on `reference[]` same as existing `ToolCallExpectSchema` | Validation is free via existing infra |

**Key insight:** This phase is pure math + data shaping. The only things to build are (1) the formulas and (2) the YAML schema shape. Everything else is reuse.

## YAML Schema Examples

### Example 1: Full set of trajectory metrics (ordered, with args)
```yaml
tests:
  - name: refund-flow
    prompt: refund-agent
    vars:
      order_id: ORD-123
    expect:
      trajectory:
        reference:
          - tool: lookup_order
            args: { order_id: ORD-123 }
          - tool: check_refund_eligibility
            args: { order_id: ORD-123 }
          - tool: issue_refund
            args: { order_id: ORD-123, amount: 49.99 }
        precision:
          minScore: 1.0    # predicted must be subset of reference
        recall:
          minScore: 1.0    # predicted must cover all reference steps
        exactMatch: true   # binary — same tools, same order
        ordered: true      # default
        matchArgs: true    # default — Vertex AI "action" semantics
```

### Example 2: Order-insensitive, name-only matching
```yaml
expect:
  trajectory:
    reference:
      - tool: search_web
      - tool: search_web
      - tool: summarize
    recall:
      minScore: 0.8      # at least 80% of reference tools seen (any order)
    ordered: false       # TRAJ-04 — switch to any-order matching
    matchArgs: false     # ignore arguments, match on tool name only
```

### Example 3: Precision only (loose reference, strict predicted)
```yaml
expect:
  trajectory:
    reference:
      - tool: lookup_customer
      - tool: send_email
    precision:
      minScore: 1.0      # predicted must not call anything outside reference
    # no recall, no exactMatch — user only cares about "no unexpected tools"
```

### Example 4: Coexistence with legacy toolCalls (migration path)
```yaml
expect:
  # Existing assertions still work unchanged
  toolCalls:
    - tool: lookup_order
      argsMatch: { order_id: ORD-123 }
    - tool: issue_refund
      shouldNotCall: false
  # New trajectory metrics layered on top
  trajectory:
    reference:
      - tool: lookup_order
        args: { order_id: ORD-123 }
      - tool: issue_refund
        args: { order_id: ORD-123, amount: 49.99 }
    exactMatch: true
```

## Zod Schema Addition (packages/core/src/config/schema.ts)

```typescript
const TrajectoryActionSchema = z.object({
  tool: NonEmptyString.describe("Expected tool/function name"),
  args: z
    .record(z.unknown())
    .optional()
    .default({})
    .describe("Expected tool arguments (deep equality when matchArgs: true)"),
});

const TrajectoryExpectSchema = z
  .object({
    reference: z
      .array(TrajectoryActionSchema)
      .min(1)
      .describe("Reference tool-call sequence to score predicted against"),
    precision: z
      .object({
        minScore: Score01.default(1.0),
      })
      .optional()
      .describe("trajectory_precision = |pred ∩ ref| / |pred|"),
    recall: z
      .object({
        minScore: Score01.default(1.0),
      })
      .optional()
      .describe("trajectory_recall = |pred ∩ ref| / |ref|"),
    exactMatch: z
      .boolean()
      .optional()
      .default(false)
      .describe("Binary: 1 if predicted sequence exactly equals reference, else 0"),
    ordered: z
      .boolean()
      .optional()
      .default(true)
      .describe("If false, match as multiset regardless of order (TRAJ-04)"),
    matchArgs: z
      .boolean()
      .optional()
      .default(true)
      .describe("If true, actions compared as (tool, args); if false, tool name only"),
  })
  .refine(
    (t) => t.precision || t.recall || t.exactMatch,
    { message: "trajectory must enable at least one of precision, recall, or exactMatch" },
  );

// Add to ExpectSchema:
trajectory: TrajectoryExpectSchema
  .optional()
  .describe("Trajectory metrics: precision, recall, exact match against a reference tool-call sequence"),
```

## TypeScript Formula Implementations

```typescript
// packages/core/src/assertions/trajectory.ts
import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";
import type { ProviderToolCall } from "../types/provider.js";

export interface TrajectoryAction {
  tool: string;
  args: Record<string, unknown>;
}

export interface TrajectoryConfig {
  reference: TrajectoryAction[];
  precision?: { minScore: number };
  recall?: { minScore: number };
  exactMatch: boolean;
  ordered: boolean;
  matchArgs: boolean;
}

function canonicalizeArgs(args: Record<string, unknown>): string {
  // Stable key ordering via recursive sort — matches Vertex AI "action" equality
  const sortKeys = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(sortKeys);
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) out[k] = sortKeys(o[k]);
    return out;
  };
  return JSON.stringify(sortKeys(args));
}

function fingerprint(
  call: { name: string; arguments: Record<string, unknown> } | TrajectoryAction,
  matchArgs: boolean,
): string {
  const name = "name" in call ? call.name : call.tool;
  const args = "arguments" in call ? call.arguments : call.args;
  return matchArgs ? `${name}::${canonicalizeArgs(args)}` : name;
}

function multisetIntersectionSize(predicted: string[], reference: string[]): number {
  const refCounts = new Map<string, number>();
  for (const r of reference) refCounts.set(r, (refCounts.get(r) ?? 0) + 1);
  let matched = 0;
  for (const p of predicted) {
    const n = refCounts.get(p) ?? 0;
    if (n > 0) {
      matched++;
      refCounts.set(p, n - 1);
    }
  }
  return matched;
}

function sequencesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function createTrajectoryAssertion(config: TrajectoryConfig): Assertion {
  return {
    type: "trajectory",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const results: AssertionResult[] = [];
      const pred = context.toolCalls.map((c) => fingerprint(c, config.matchArgs));
      const ref = config.reference.map((a) => fingerprint(a, config.matchArgs));

      // For any-order matching, sort both sequences so exactMatch becomes "same multiset".
      // For precision/recall, multiset intersection already handles any-order natively.
      const predForExact = config.ordered ? pred : [...pred].sort();
      const refForExact = config.ordered ? ref : [...ref].sort();

      if (config.precision) {
        const score = pred.length === 0 ? 0 : multisetIntersectionSize(pred, ref) / pred.length;
        const passed = score >= config.precision.minScore;
        results.push({
          assertionType: "trajectory_precision",
          label: `Trajectory precision ≥ ${config.precision.minScore}`,
          passed,
          score,
          failureCode: passed ? undefined : "TRAJECTORY_PRECISION_LOW",
          failureMessage: passed
            ? undefined
            : `precision ${score.toFixed(3)} < ${config.precision.minScore} (pred=${pred.length}, matched=${multisetIntersectionSize(pred, ref)})`,
          metadata: { predicted: pred, reference: ref, ordered: config.ordered, matchArgs: config.matchArgs },
        });
      }

      if (config.recall) {
        const score = ref.length === 0 ? 0 : multisetIntersectionSize(pred, ref) / ref.length;
        const passed = score >= config.recall.minScore;
        results.push({
          assertionType: "trajectory_recall",
          label: `Trajectory recall ≥ ${config.recall.minScore}`,
          passed,
          score,
          failureCode: passed ? undefined : "TRAJECTORY_RECALL_LOW",
          failureMessage: passed
            ? undefined
            : `recall ${score.toFixed(3)} < ${config.recall.minScore} (ref=${ref.length}, matched=${multisetIntersectionSize(pred, ref)})`,
          metadata: { predicted: pred, reference: ref, ordered: config.ordered, matchArgs: config.matchArgs },
        });
      }

      if (config.exactMatch) {
        const equal = sequencesEqual(predForExact, refForExact);
        results.push({
          assertionType: "trajectory_exact_match",
          label: config.ordered ? "Trajectory exact match (ordered)" : "Trajectory exact match (any order)",
          passed: equal,
          score: equal ? 1 : 0,
          failureCode: equal ? undefined : "TRAJECTORY_EXACT_MISMATCH",
          failureMessage: equal
            ? undefined
            : `predicted=[${pred.join(", ")}] reference=[${ref.join(", ")}]`,
          metadata: { predicted: pred, reference: ref, ordered: config.ordered, matchArgs: config.matchArgs },
        });
      }

      return Promise.resolve(results);
    },
  };
}
```

## Registry Wiring (packages/core/src/assertions/registry.ts)

```typescript
// Add import
import { createTrajectoryAssertion } from "./trajectory.js";

// Add new branch inside createAssertionsFromExpect, before the final return:
if (expect.trajectory) {
  assertions.push(
    createTrajectoryAssertion({
      reference: expect.trajectory.reference.map((a) => ({
        tool: a.tool,
        args: a.args ?? {},
      })),
      precision: expect.trajectory.precision,
      recall: expect.trajectory.recall,
      exactMatch: expect.trajectory.exactMatch,
      ordered: expect.trajectory.ordered,
      matchArgs: expect.trajectory.matchArgs,
    }),
  );
}
```

**FailureCode additions** in `interface.ts`:
```typescript
| "TRAJECTORY_PRECISION_LOW"
| "TRAJECTORY_RECALL_LOW"
| "TRAJECTORY_EXACT_MISMATCH"
```

## Decision: Match on tool name only, or tool+args?

**Decision: Default to tool+args (matchArgs: true) with a toggle to name-only.**

**Rationale:**
- Vertex AI's "action" concept explicitly includes `tool_input` — confirmed via live docs fetch 2026-04-09. [CITED: docs.cloud.google.com/vertex-ai/generative-ai/docs/models/evaluation-agents — "action" shape is `{tool_name, tool_input}`]
- Name-only matching is too permissive for real regression detection. An agent that calls `send_email({to: "attacker@evil.com"})` when the reference says `send_email({to: "customer@ours.com"})` must fail.
- Users who want tool-sequence-only matching can opt in via `matchArgs: false` — matches the loose behavior of early Google ADK `tool_trajectory_avg_score`.
- Canonical JSON key ordering handles argument-order-invariance without user action.

**Alternative rejected:** Default to name-only with opt-in args. Fails safety tests — the default should be the safer, stricter interpretation. Enterprise buyers who adopt Vertex AI vocabulary expect Vertex AI semantics.

## Migration Story: Incremental Upgrade for Existing `toolCalls` Users

**Path A — No migration (default):** Existing `toolCalls` assertions continue to work unchanged. Zero breakage. Users opt into trajectory metrics by adding a `trajectory:` block alongside.

**Path B — Side-by-side adoption:** Users can run both in the same test during transition:
```yaml
expect:
  toolCalls: [...]      # keeps legacy asserts and their clear failure codes
  trajectory: {...}     # adds aggregate precision/recall scoring
```

**Path C — Full swap (recommended in docs/metrics.md):** Once confident, users replace `toolCalls` with `trajectory.reference` + `exactMatch: true`. This is equivalent to the old per-tool `argsMatch` + ordering check, but with a single aggregate score.

**Equivalence table** (for docs/metrics.md, Phase 27):

| Old `toolCalls` usage | Equivalent `trajectory` usage |
|-----------------------|------------------------------|
| `[{tool: X, argsMatch: {...}}]` (single call, no order) | `trajectory: { reference: [{tool: X, args: {...}}], precision: {minScore: 1.0}, recall: {minScore: 1.0} }` |
| `[{tool: X, order: 0}, {tool: Y, order: 1}]` | `trajectory: { reference: [{tool: X}, {tool: Y}], exactMatch: true }` |
| `[{tool: X, shouldNotCall: true}]` | **Not equivalent** — trajectory metrics are reference-based. Keep `toolCalls` for negative assertions. |

**Key point:** `toolCalls` and `trajectory` have non-overlapping strengths — `toolCalls` for fine-grained individual tool assertions (with `shouldNotCall`, `argsSchema`), `trajectory` for aggregate sequence scoring. Recommend users keep both.

## Common Pitfalls

### Pitfall 1: Set-vs-multiset ambiguity
**What goes wrong:** User expects `[search, search, search]` matched against `[search]` to score 1.0 precision but actually scores ~0.33.
**Why it happens:** Multiset semantics — each predicted tool consumes one reference slot.
**How to avoid:** Document the multiset choice in docs/metrics.md with worked examples. Include per-element counts in failure metadata.
**Warning signs:** Unexpected precision < 1.0 when every predicted tool name appears in reference.

### Pitfall 2: Argument key ordering
**What goes wrong:** `{a:1, b:2}` and `{b:2, a:1}` are structurally equal but `JSON.stringify` without sorting produces different strings → spurious mismatches.
**Why it happens:** Naive `JSON.stringify` preserves insertion order.
**How to avoid:** The `canonicalizeArgs` helper sorts keys recursively. Unit-test both orderings.
**Warning signs:** Flaky trajectory scores when args semantically equal.

### Pitfall 3: Empty predicted or reference
**What goes wrong:** Divide-by-zero produces `NaN`, which then breaks reporter output and `minScore` comparisons (`NaN >= 0` is false but silent).
**Why it happens:** `0/0` in precision (no predicted) or recall (no reference — but Zod `.min(1)` prevents this).
**How to avoid:** Explicit `pred.length === 0 ? 0 : ...` guard. Zod schema forbids empty reference.
**Warning signs:** Tests reporting score of `NaN` or precision 0 with a failure message that doesn't explain why.

### Pitfall 4: Multi-turn tool calls (existing behavior to preserve)
**What goes wrong:** User writes a multi-turn conversation test expecting trajectory to score only the last turn; it actually scores across all turns.
**Why it happens:** `context.toolCalls` is the accumulated sequence across all turns (verified in market signal Q10).
**How to avoid:** Document that `trajectory:` at the test level sees all turns' tool calls. For per-turn scoring, users add `trajectory:` inside `conversation.turns[].expect` (the existing per-turn `expect` block — confirmed via `ConversationTurnSchema` at schema.ts:434).
**Warning signs:** Precision/recall scores include tools from earlier turns users didn't intend to score.

### Pitfall 5: Ordered exact match on permutations
**What goes wrong:** User sets `exactMatch: true, ordered: false` and expects anything that reorders to pass. Implementation must sort both sides before comparing.
**Why it happens:** "Exact match" ambiguous between "literal sequence" and "same multiset".
**How to avoid:** The impl explicitly sorts both sides when `ordered: false`. Unit-test both ordered and any-order cases.
**Warning signs:** `any-order exact match` failing on commutative sequences.

## Code Examples (Golden Test Trajectories)

### Unit test skeleton (`trajectory.test.ts`)
```typescript
import { describe, it, expect } from "vitest";
import { createTrajectoryAssertion } from "./trajectory.js";
import type { AssertionContext } from "./interface.js";
import type { ProviderToolCall } from "../types/provider.js";

function makeContext(calls: Array<{ name: string; arguments: Record<string, unknown> }>): AssertionContext {
  return {
    outputText: "",
    toolCalls: calls.map((c, i) => ({ id: `t${i}`, name: c.name, arguments: c.arguments, index: i })),
    configDir: "/tmp",
  };
}

describe("trajectory metrics", () => {
  const ref = [
    { tool: "lookup_order", args: { id: 1 } },
    { tool: "issue_refund", args: { id: 1, amount: 50 } },
  ];

  it("TRAJ-01: precision = 1.0 when predicted is subset of reference", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      precision: { minScore: 1.0 },
      exactMatch: false,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([{ name: "lookup_order", arguments: { id: 1 } }]);
    const [result] = await a.evaluate(ctx);
    expect(result.score).toBe(1.0);
    expect(result.passed).toBe(true);
  });

  it("TRAJ-01: precision penalizes extra tool calls", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      precision: { minScore: 1.0 },
      exactMatch: false,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "lookup_order", arguments: { id: 1 } },
      { name: "send_spam", arguments: {} },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result.score).toBe(0.5);
    expect(result.passed).toBe(false);
  });

  it("TRAJ-02: recall < 1.0 when predicted misses reference steps", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      recall: { minScore: 1.0 },
      exactMatch: false,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([{ name: "lookup_order", arguments: { id: 1 } }]);
    const [result] = await a.evaluate(ctx);
    expect(result.score).toBe(0.5);
  });

  it("TRAJ-03: exact_match = 1 on identical ordered sequence", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      exactMatch: true,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "lookup_order", arguments: { id: 1 } },
      { name: "issue_refund", arguments: { id: 1, amount: 50 } },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result.score).toBe(1);
  });

  it("TRAJ-03: exact_match = 0 when order differs", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      exactMatch: true,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "issue_refund", arguments: { id: 1, amount: 50 } },
      { name: "lookup_order", arguments: { id: 1 } },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result.score).toBe(0);
  });

  it("TRAJ-04: ordered: false accepts permuted sequences", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      exactMatch: true,
      ordered: false,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "issue_refund", arguments: { id: 1, amount: 50 } },
      { name: "lookup_order", arguments: { id: 1 } },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result.score).toBe(1);
  });

  it("handles duplicate tool calls as multiset", async () => {
    const refDup = [{ tool: "search", args: {} }, { tool: "search", args: {} }];
    const a = createTrajectoryAssertion({
      reference: refDup,
      precision: { minScore: 0.5 },
      recall: { minScore: 0.5 },
      exactMatch: false,
      ordered: false,
      matchArgs: false,
    });
    const ctx = makeContext([
      { name: "search", arguments: {} },
      { name: "search", arguments: {} },
      { name: "search", arguments: {} }, // one extra
    ]);
    const results = await a.evaluate(ctx);
    expect(results.find((r) => r.assertionType === "trajectory_precision")?.score).toBeCloseTo(2 / 3);
    expect(results.find((r) => r.assertionType === "trajectory_recall")?.score).toBe(1);
  });

  it("canonicalizes argument key order", async () => {
    const a = createTrajectoryAssertion({
      reference: [{ tool: "f", args: { a: 1, b: 2 } }],
      exactMatch: true,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([{ name: "f", arguments: { b: 2, a: 1 } }]);
    const [result] = await a.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it("matchArgs: false ignores arguments entirely", async () => {
    const a = createTrajectoryAssertion({
      reference: [{ tool: "send_email", args: { to: "real@example.com" } }],
      exactMatch: true,
      ordered: true,
      matchArgs: false,
    });
    const ctx = makeContext([{ name: "send_email", arguments: { to: "different@example.com" } }]);
    const [result] = await a.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it("empty predicted → precision 0 with clear message", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      precision: { minScore: 0.5 },
      exactMatch: false,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([]);
    const [result] = await a.evaluate(ctx);
    expect(result.score).toBe(0);
    expect(result.failureMessage).toContain("pred=0");
  });
});
```

## Testing Strategy

**Unit tests (trajectory.test.ts)** — minimum 10 cases covering:
1. Precision happy path (1.0)
2. Precision with extra tools (penalty)
3. Recall happy path (1.0)
4. Recall with missing tools (penalty)
5. Exact match ordered = true
6. Exact match ordered = false (permutation)
7. Duplicate tool calls (multiset behavior)
8. Canonical arg key ordering
9. `matchArgs: false` name-only fallback
10. Empty predicted edge case
11. All three metrics enabled at once → three results returned
12. None enabled → Zod schema refinement rejects at parse time

**Integration tests** (extend existing `registry.test.ts` or `runner.test.ts`):
- Full pipeline: YAML config → parser → runner → assertion → reporter output
- Verify `expect.trajectory` + `expect.toolCalls` coexist in same test
- Verify failure codes surface in `AssertionResult.failureCode`

**Schema tests** (`config/schema.test.ts`):
- Reference with ≥1 entry passes
- Empty reference fails Zod
- No precision/recall/exactMatch fails Zod refinement
- Default values: `ordered: true`, `matchArgs: true`, `exactMatch: false`

**No integration with live providers required.** `context.toolCalls` is already synthesized in tests via `makeContext` helper — no need for provider mocks.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `/Users/petr/projects/kindlm/vitest.config.ts` (root shared config) |
| Quick run command | `cd packages/core && npx vitest run src/assertions/trajectory.test.ts` |
| Full suite command | `npm run test` (root — runs Turbo graph across all packages) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRAJ-01 | precision formula | unit | `cd packages/core && npx vitest run src/assertions/trajectory.test.ts -t "precision"` | ❌ Wave 0 |
| TRAJ-02 | recall formula | unit | `cd packages/core && npx vitest run src/assertions/trajectory.test.ts -t "recall"` | ❌ Wave 0 |
| TRAJ-03 | exact_match binary | unit | `cd packages/core && npx vitest run src/assertions/trajectory.test.ts -t "exact_match"` | ❌ Wave 0 |
| TRAJ-04 | ordered toggle | unit | `cd packages/core && npx vitest run src/assertions/trajectory.test.ts -t "ordered"` | ❌ Wave 0 |
| TRAJ-01..04 | registry wiring | integration | `cd packages/core && npx vitest run src/assertions/registry.test.ts` | ✅ (extend existing) |
| TRAJ-01..04 | schema validation | unit | `cd packages/core && npx vitest run src/config/schema.test.ts -t "trajectory"` | ✅ (extend existing) |
| TRAJ-01..04 | typecheck | typecheck | `npx tsc --noEmit` (per CLAUDE.md verification default) | ✅ |
| TRAJ-01..04 | lint | lint | `npx eslint . --quiet` | ✅ |

### Sampling Rate
- **Per task commit:** `cd packages/core && npx vitest run src/assertions/trajectory.test.ts`
- **Per wave merge:** `npm run test --workspace=@kindlm/core` (full core suite)
- **Phase gate:** `npm run build && npm run test && npm run typecheck && npm run lint` all green

### Wave 0 Gaps
- [ ] `packages/core/src/assertions/trajectory.ts` — new file, covers TRAJ-01..04
- [ ] `packages/core/src/assertions/trajectory.test.ts` — new file with golden sequences
- [ ] No framework install needed — Vitest already present

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (pure compute, no auth surface) |
| V3 Session Management | no | (no state) |
| V4 Access Control | no | (no resource access) |
| V5 Input Validation | yes | Zod schema on `TrajectoryExpectSchema` with `.min(1)`, enum constraints, `Score01` bounds |
| V6 Cryptography | no | (no secrets) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| YAML injection via reference.args containing JS expressions | Tampering | Zod validates `args` as `z.record(z.unknown())` — no code eval; `JSON.stringify` canonical form is safe |
| Prototype pollution via `args: { "__proto__": ... }` | Tampering | Canonical form uses `Object.keys().sort()` which enumerates own properties only; `JSON.stringify` does not walk `__proto__`; explicitly test with a `__proto__` key in unit tests |
| ReDoS in reference matching | DoS | No regex used in trajectory — all equality is deep-equal + canonical JSON strings |
| Denial via huge reference sequence | DoS | Zod has no `.max()` on reference length today — [ASSUMED] most real sequences are <50 steps, but add `.max(500)` defensively |

**Security-relevant decision:** Use `JSON.stringify` with manual key sort rather than `util.inspect` or external serializer. `JSON.stringify` is Workers-compatible (core has no Node.js imports) and prototype-safe.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vertex AI uses multiset (not set) intersection for precision/recall | Pattern 2, Pitfall 1 | Users expecting set-semantics will see "unexpectedly low" scores on duplicate tool calls. Mitigation: document loudly. |
| A2 | Empty predicted → precision = 0 (not NaN, not error) | Anti-Patterns, Pitfall 3 | Behavior mismatch with Vertex AI if they throw/skip. Mitigation: unit-test the edge case with a clear failure message. |
| A3 | Default `matchArgs: true` is correct (Vertex AI "action" semantics) | Decision section | If Vertex AI actually defaults to name-only, users migrating will see stricter-than-expected scores. [VERIFIED via docs.cloud.google.com 2026-04-09 that "action" = `{tool_name, tool_input}`] — risk is LOW. |
| A4 | No `.max()` bound on reference length is safe | Security Domain | Pathological configs (1M-step reference) could OOM Node.js. Mitigation: add `z.array(...).min(1).max(500)`. |
| A5 | Multi-turn tool-call accumulation in `context.toolCalls` is desired behavior for test-level `trajectory:` | Pitfall 4 | Users may expect per-turn scoping by default. Mitigation: document + recommend per-turn `expect.trajectory` when appropriate. |

**Action required:** Surface A1, A2, A4 to user during discussion/planning step if any ambiguity remains. A3 and A5 are low-risk and can be documented in DOCS-03 (docs/metrics.md, Phase 27).

## Open Questions

1. **Should `shouldNotCall`-style negative trajectory be supported?**
   - What we know: Vertex AI has `trajectory_single_tool_use` (binary "specific tool present/absent") which does NOT require a reference.
   - What's unclear: Whether users want this in v2.4.0 or it's out of scope.
   - Recommendation: Out of scope for Phase 20 — TRAJ-01..04 only cover precision/recall/exact_match. Existing `toolCalls: [{shouldNotCall: true}]` covers the negative case. Revisit in v2.5.0.

2. **Should trajectory metrics aggregate into `pass^k` reliability scoring (Phase 19)?**
   - What we know: Phase 19 ships `pass^k` on overall test success; trajectory metrics produce continuous scores per run.
   - What's unclear: Whether to fold trajectory precision ≥ minScore into the per-trial "success" definition.
   - Recommendation: Yes, by default — any `AssertionResult` with `passed: false` should already fail the test, which is what Phase 19's `pass^k` counts. No special integration needed. Verify during Phase 19 execution.

3. **Metadata format for tool-call diffing (Phase 24)?**
   - What we know: Phase 24 will render side-by-side diffs using the same `predicted` + `reference` arrays.
   - What's unclear: Whether to emit the canonicalized fingerprint array in metadata or the raw tool-call objects.
   - Recommendation: Emit both — `metadata.predicted` (fingerprints for comparison), `metadata.predictedRaw` (full `ProviderToolCall[]` for rendering). Phase 24 owns the rendering details.

## Sources

### Primary (HIGH confidence)
- `/Users/petr/projects/kindlm/.planning/research/v2.4-market-signal.md` Part 3.1 — Vertex AI trajectory metrics with direct quotes of formulas
- `/Users/petr/projects/kindlm/packages/core/src/assertions/tool-calls.ts` — existing `partialDeepMatch` to reuse
- `/Users/petr/projects/kindlm/packages/core/src/assertions/interface.ts` — `AssertionContext.toolCalls` shape (`ProviderToolCall[]`)
- `/Users/petr/projects/kindlm/packages/core/src/assertions/registry.ts` — existing wiring pattern to extend
- `/Users/petr/projects/kindlm/packages/core/src/config/schema.ts` lines 300-390 — `ToolCallExpectSchema` and `ExpectSchema` structure to extend
- `/Users/petr/projects/kindlm/packages/core/src/types/provider.ts` — `ProviderToolCall` shape `{id, name, arguments, index}`
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/evaluation-agents — trajectory metric definitions, action = `{tool_name, tool_input}` [verified 2026-04-09]

### Secondary (MEDIUM confidence)
- DeepEval `ToolCorrectnessMetric` docs (via market signal Part 2) — `should_consider_ordering`, `should_exact_match`, `evaluation_params` toggles confirm industry API shape
- τ-bench, Anthropic methodology — establishes multi-trial testing context (relevant to Phase 19 integration)

### Tertiary (LOW confidence)
- Multiset vs set semantics (A1) — not directly verified in Vertex AI docs, inferred from the word "count"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all from existing core
- Architecture: HIGH — pure additive, follows existing factory + registry pattern
- Formulas: HIGH — Vertex AI quotes are verbatim and simple
- Multiset interpretation: MEDIUM — A1 flagged, mitigated by documentation
- YAML schema shape: HIGH — mirrors existing `ToolCallExpectSchema` conventions

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days — Vertex AI docs and KindLM core are stable; revisit only if Vertex AI publishes breaking changes to their metric definitions)
