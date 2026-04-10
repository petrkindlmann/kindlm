# Phase 24: Tool-Call Diffing - Research

**Researched:** 2026-04-09
**Domain:** Terminal + markdown diff rendering, sequence alignment, char-level diff
**Confidence:** HIGH

## Summary

Phase 24 ships the tool-call trajectory diff visualization that market research calls out as THE v2.4.0 differentiator ("nobody ships this well" — v2.4-market-signal.md §4.1). The goal is a sequence-level, two-column diff showing expected vs actual tool-call trajectories, with per-tool-call arg-level character highlighting, rendered in both the terminal (ANSI) and PR comments (markdown).

The existing `pretty.ts` (lines 208-228) already shows a flat per-key argDiffs block (`expected: X / received: Y`) attached to single-tool `tool_called` failures. That's a good foundation but is NOT a sequence diff — it only runs on one assertion at a time and doesn't align trajectories when lengths differ or tools are reordered. Phase 24 adds a proper aligned sequence diff that is rendered primarily when a **trajectory_*** assertion (from Phase 20) fails, and secondarily when the richer multi-call `tool_order` assertion fails.

**Primary recommendation:** Build a pure, I/O-free `core/src/diff/` module with three pieces: (1) a tiny LCS-based trajectory aligner operating on `ProviderToolCall[]`, (2) a char-level arg differ backed by the `diff` npm package (jsdiff — BSD-3, zero runtime deps, ESM+CJS, TypeScript types built-in, v8.0.4 published 2026-03-23) `[VERIFIED: npm view diff]`, and (3) two rendering layers (terminal-ANSI via the existing `Colorize` interface, and markdown) that consume the aligned result. Wire the renderers into `pretty.ts` when a failed assertion's metadata contains a full trajectory, and into the PR-comment builder from Phase 23.

## User Constraints

No CONTEXT.md for this phase (running in yolo mode, `research_enabled: false` in `.planning/config.json`). Constraints come from CLAUDE.md and REQUIREMENTS.md:

### Locked Decisions (from CLAUDE.md + PROJECT.md)
- **Core zero-I/O:** `@kindlm/core` cannot import `fs`, `fetch`, `console.log`, or chalk directly. Diff module must be pure.
- **Colorize injection:** Terminal coloring goes through the existing `Colorize` interface (no direct chalk import in core). Chalk lives in `@kindlm/cli` only.
- **ESM + `.js` relative imports** required for every relative import in core.
- **No classes** except error types. Use factory functions (`createTrajectoryDiffer()`, `createTerminalDiffRenderer()`).
- **`import type`** for all type-only imports (verbatimModuleSyntax on).
- **Result<T,E> / no throw** — diff computation must not throw on pathological input; return a degraded ASCII fallback.
- **Workers compat (Cloud):** cloud package must keep importing only types from core, so the new diff module must not be loaded at runtime inside cloud. Markdown rendering stays in core but is just string manipulation — safe to consume from both CLI and cloud.
- **Semver:** published under `@kindlm` scope; adding `diff` as a core dep is a minor-version-compatible change.

### Claude's Discretion
- Diff library choice (jsdiff vs diff-match-patch vs zero-dep hand-roll).
- Sequence alignment algorithm (LCS vs Hunt-McIlroy vs Needleman-Wunsch).
- ASCII box-drawing characters, color scheme, column width defaults.
- Markdown format (unified `+/-` vs two-column tables).
- Metadata shape for passing expected+actual trajectory from Phase 20 assertions into the renderer.

### Deferred Ideas (OUT OF SCOPE)
- Interactive diff viewer / TUI (out of scope — terminal is a dumb stream).
- HTML diff in the dashboard (Phase 28+, v2.5.0 territory).
- Snapshot-based regression diffing à la EvalView (covered by existing baseline flow).
- Semantic "why did the args change" explanation via judge model.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIFF-01 | Terminal side-by-side two-column diff (expected vs actual trajectory) | §Terminal Renderer design, §Sequence Alignment, §ASCII Mockup |
| DIFF-02 | Arg-level character highlighting of argument differences | §Char-Level Diff (jsdiff), §Arg Rendering |
| DIFF-03 | Tool-call diff in PR comment markdown | §Markdown Renderer design, §Markdown Output |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `diff` (jsdiff) | `^8.0.4` | Char / word-level text diff primitives | De-facto JS diff library since 2011, powers Mocha, Jest, ESLint; BSD-3; zero runtime deps; ESM+CJS; built-in TS types; works in Workers (pure JS) `[VERIFIED: npm view diff 2026-03-23]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (existing) `Colorize` interface | internal | ANSI coloring injection | Pass from CLI into the diff renderer — do NOT import chalk in core |
| (existing) `yaml` / `JSON.stringify` | `^2.6.0` | Arg serialization before diffing | For deterministic arg rendering before char-diff |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `diff` (jsdiff) | `diff-match-patch` | Google's library; last publish 2022-06, stale `[VERIFIED: npm view]`; CJS-only modern fork; more features than we need; heavier API |
| `diff` (jsdiff) | hand-rolled LCS in ~60 lines | Tempting for zero-dep purity but arg diff requires robust char/word tokenization, unicode handling, and change-merging that jsdiff already solves. Hand-rolling the *sequence* alignment is fine (~40 lines); hand-rolling *char-level* diff is not. |
| `diff` (jsdiff) | `fast-diff` | Smaller (~5KB), simpler API, used by Prettier. Viable fallback if bundle size becomes a concern. `[CITED: github.com/jhchen/fast-diff]` Still recommend jsdiff for the richer `diffWords` / `diffJson` helpers we want for args. |
| LCS alignment | Hunt-McIlroy | Marginal speedup on huge inputs only (thousands of lines); trajectories are ≤ ~20 tool calls, LCS is fine and simpler. |
| LCS alignment | Needleman-Wunsch (edit distance with substitution cost) | Better for fuzzy tool-name matching (`search_order` vs `search_orders`) but significantly more code. Defer to v2.5. |

**Installation:**
```bash
npm install diff --workspace=@kindlm/core
npm install --save-dev @types/diff --workspace=@kindlm/core  # types built-in since v6, but pin explicitly if TS complains
```

**Version verification:** `npm view diff version` → `8.0.4`, published `2026-03-23`. License BSD-3-Clause. Types ship built-in (`libesm/index.d.ts`). Zero runtime dependencies. `[VERIFIED: npm registry, 2026-04-09]`

## Architecture Patterns

### Recommended Module Structure
```
packages/core/src/diff/
├── types.ts              # DiffedTrajectory, AlignedPair, ArgCharDiff
├── align.ts              # alignTrajectories(expected, actual) — LCS
├── arg-diff.ts           # diffArgValues(expected, actual) — char-level via jsdiff
├── render-terminal.ts    # renderTrajectoryDiffTerminal(diffed, colorize, opts)
├── render-markdown.ts    # renderTrajectoryDiffMarkdown(diffed, opts)
├── index.ts              # barrel
├── align.test.ts
├── arg-diff.test.ts
├── render-terminal.test.ts
└── render-markdown.test.ts
```

And wire-up points:
```
packages/core/src/reporters/pretty.ts        # call render-terminal on trajectory failures
packages/cli/src/pr-comment/*.ts             # Phase 23 PR-comment builder calls render-markdown
```

### Pattern 1: Pure Factory + Injected Colorize
**What:** Diff renderer returns a `string`. ANSI colors come from the caller's `Colorize`.
**When to use:** Every new reporter/render helper in core.
**Example:**
```typescript
// packages/core/src/diff/render-terminal.ts
import type { Colorize } from "../reporters/interface.js";
import type { DiffedTrajectory } from "./types.js";

export function renderTrajectoryDiffTerminal(
  diff: DiffedTrajectory,
  c: Colorize,
  opts: { width?: number; maxArgChars?: number } = {},
): string {
  // returns a multi-line string with box drawing + ANSI escapes
}
```

### Pattern 2: LCS Alignment Over Tool-Call Sequences
**What:** Classic dynamic-programming Longest Common Subsequence over sequences of `ProviderToolCall`, with equality = same tool name AND structurally equal args (using the existing `partialDeepMatch` helper from `tool-calls.ts`). Non-matching positions become `add` / `remove` / `change` rows.
**When to use:** Any rendered trajectory diff.
**Why LCS:** Trajectories are short (typically 1-20 calls); O(m·n) is trivial; produces the minimal-edit alignment humans expect.
**Example (shape only):**
```typescript
// packages/core/src/diff/align.ts
import type { ProviderToolCall } from "../types/provider.js";

export type AlignedRow =
  | { kind: "equal";  expected: ProviderToolCall; actual: ProviderToolCall }
  | { kind: "change"; expected: ProviderToolCall; actual: ProviderToolCall }  // same tool, different args
  | { kind: "remove"; expected: ProviderToolCall }                             // in expected, not in actual
  | { kind: "add";    actual:   ProviderToolCall };                            // in actual, not in expected

export function alignTrajectories(
  expected: ReadonlyArray<ProviderToolCall>,
  actual:   ReadonlyArray<ProviderToolCall>,
): ReadonlyArray<AlignedRow> {
  // LCS with toolNameEquals() as equality predicate,
  // then walk the DP table and tag equal rows as "change" when arg-hash differs.
}
```
`[CITED: Wikipedia — Longest common subsequence problem; classic DP]`

### Pattern 3: Char-Level Arg Diff via jsdiff
**What:** Serialize each arg value deterministically (JSON with sorted keys), then call `diffChars` from jsdiff. Collapse runs of additions/removals into colored spans.
**Example:**
```typescript
// packages/core/src/diff/arg-diff.ts
import { diffChars, type Change } from "diff";

export interface ArgCharDiff {
  key: string;
  parts: Change[];   // jsdiff Change[] — { added?, removed?, value }
}

export function diffArgValues(
  expected: Record<string, unknown>,
  actual:   Record<string, unknown>,
): ArgCharDiff[] {
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  return Array.from(keys).sort().map((key) => ({
    key,
    parts: diffChars(stableStringify(expected[key]), stableStringify(actual[key])),
  }));
}
```
`[CITED: https://github.com/kpdecker/jsdiff — diffChars API]`

### Anti-Patterns to Avoid
- **Importing chalk into core.** Breaks the zero-I/O boundary. Go through `Colorize`.
- **Rendering directly from tool-calls.ts.** Keep assertions pure; let the reporter call the diff renderer on metadata.
- **Using `JSON.stringify` without key sorting.** Non-deterministic key order produces spurious "diffs". Use a stable stringify (small helper in the diff module — no new dep needed).
- **Embedding box-drawing chars without a `--no-unicode` / ASCII fallback.** Some CI terminals still mangle UTF-8; fall back to `|` `+` `-`.
- **Treating reordered-but-equivalent tool calls as a diff when the user opted into any-order mode.** Respect `TRAJ-04`'s ordered flag: in any-order mode, align by multiset and show unordered diff.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Char-level text diff | Custom Myers algorithm | `diff` (jsdiff) `diffChars` | Unicode, surrogate pairs, change-merging, emoji grapheme edge cases — all solved |
| Word-level text diff on long string args | Custom tokenizer | `diff` `diffWords` | Respects whitespace and punctuation boundaries |
| Deterministic JSON serialization | Recursive `JSON.stringify` | Small stable-stringify helper (sort keys, handle circular refs) | Recursive JSON.stringify doesn't sort keys; undefined fields break diff consistency. ~15-line helper is fine (no dep needed — `json-stable-stringify` is ancient). |
| ANSI color handling | `\x1b[31m` literal strings in core | Inject `Colorize` | Core stays testable without a TTY; CLI controls theming |
| Terminal width detection | `process.stdout.columns` in core | Pass `width` as an option; default 100; CLI reads `process.stdout.columns` | Core must not touch `process` |

**Key insight:** The sequence-alignment layer (which maps expected[i] to actual[j]) is cheap to write correctly and is the part we need to own — it's where KindLM's semantics live (tool-name equality, partial arg match, ordered vs any-order). The char-level text-diff layer is a solved problem — don't reinvent it.

## Runtime State Inventory

Not applicable — Phase 24 is a greenfield feature (new module + two rendering paths). No rename, refactor, or migration of stored data. No external services store the phrase "tool-call diff".

- **Stored data:** None — verified by grepping `.kindlm/`, `.planning/`, and D1 migrations; no existing persisted diff artifacts.
- **Live service config:** None — no external service holds trajectory-diff state.
- **OS-registered state:** None.
- **Secrets/env vars:** None — diff rendering is pure.
- **Build artifacts:** None prior to this phase; new `core/src/diff/` module will be added to the tsup bundle output.

## Common Pitfalls

### Pitfall 1: Columns Don't Fit Narrow Terminals
**What goes wrong:** A 100-col side-by-side diff renders as wrapped mush in an 80-col terminal or a GitHub Actions log.
**Why it happens:** Default terminal widths in CI are often 80 or worse; box-drawing doesn't wrap gracefully.
**How to avoid:** Compute `width = min(stdout.columns, 120)`; each column gets `(width - 5) / 2`. Truncate long arg values with ellipsis and add a full-detail section below the two-column header. In CI mode (Phase 23 detected `CI=true`), optionally switch to stacked unified diff.
**Warning signs:** Users opening issues with screenshots of broken boxes.

### Pitfall 2: Reordered-Tool Calls Produce Huge Fake Diffs
**What goes wrong:** Expected `[A, B, C]` vs actual `[B, A, C]` aligns as three changes instead of "same multiset, different order".
**Why it happens:** Strict LCS with position-sensitive equality.
**How to avoid:** Honor Phase 20's `TRAJ-04` ordered flag. In any-order mode, align by multiset (Hungarian-lite: greedily pair equal tool names, then show reordering as a dim note rather than a row-level change).
**Warning signs:** Same test shows wildly different diffs on reruns with non-deterministic tool order.

### Pitfall 3: Arg Diff Is Noisy Due to Non-Stable JSON Key Order
**What goes wrong:** `{a:1,b:2}` vs `{b:2,a:1}` shows a full-string diff because key order differs between runs.
**Why it happens:** `JSON.stringify` preserves insertion order; providers don't guarantee key order.
**How to avoid:** Stable-stringify with sorted keys before char-diffing.
**Warning signs:** Diffs showing identical JSON with reordered keys.

### Pitfall 4: Unicode / Emoji in Args Break Char Diff
**What goes wrong:** `"🚀"` shows as a partial-byte diff.
**Why it happens:** Naive char-split sees UTF-16 surrogate halves.
**How to avoid:** jsdiff handles this correctly since v5 `[CITED: jsdiff CHANGELOG]`; do NOT write your own char splitter.
**Warning signs:** Garbled output on international chars.

### Pitfall 5: Markdown Column Width Kills GitHub Tables
**What goes wrong:** Long arg JSON in a two-column GitHub table wraps weirdly or blows out the PR comment.
**Why it happens:** GitHub's markdown tables don't support column width hints.
**How to avoid:** Use a fenced ```` ```diff ```` block with unified `+` / `-` lines (renders with syntax highlighting on GitHub) rather than a table. Table is a fallback for simple trajectories only.
**Warning signs:** Scrolling PR comments, auto-collapsed details that hide the diff.

### Pitfall 6: Color Codes Leak Into JSON / JUnit Reporters
**What goes wrong:** ANSI escapes land in `results.json`.
**Why it happens:** Somebody called the terminal renderer from the JSON reporter by mistake.
**How to avoid:** Two distinct render functions. JSON reporter attaches the **structured** `DiffedTrajectory` object to result metadata; terminal renderer is pretty-only.

## Code Examples

### Serializing args deterministically before char diff
```typescript
// packages/core/src/diff/arg-diff.ts
// Source: derived from MDN JSON.stringify replacer docs
function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
}
```

### LCS skeleton for trajectory alignment
```typescript
// packages/core/src/diff/align.ts
// Source: Wikipedia LCS pseudocode, adapted to ProviderToolCall
export function alignTrajectories<T>(
  a: ReadonlyArray<T>,
  b: ReadonlyArray<T>,
  equal: (x: T, y: T) => boolean,
): Array<{ kind: "equal" | "remove" | "add"; a?: T; b?: T }> {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = equal(a[i - 1]!, b[j - 1]!)
        ? dp[i - 1]![j - 1]! + 1
        : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }
  const out: Array<{ kind: "equal" | "remove" | "add"; a?: T; b?: T }> = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (equal(a[i - 1]!, b[j - 1]!)) { out.unshift({ kind: "equal", a: a[i - 1], b: b[j - 1] }); i--; j--; }
    else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) { out.unshift({ kind: "remove", a: a[i - 1] }); i--; }
    else { out.unshift({ kind: "add", b: b[j - 1] }); j--; }
  }
  while (i > 0) { out.unshift({ kind: "remove", a: a[i - 1] }); i--; }
  while (j > 0) { out.unshift({ kind: "add",    b: b[j - 1] }); j--; }
  return out;
}
```

### Terminal ASCII mockup (DIFF-01 + DIFF-02)

Target output when a `trajectory_exact_match` fails with expected `[search_orders, get_order, send_email]` vs actual `[list_products, get_order, send_email]`, and `get_order`'s `order_id` arg differs:

```
        ✗ trajectory_exact_match (0.67 < 1.00): trajectories diverge at step 1

        ┌─ Expected trajectory ─────────────┬─ Actual trajectory ───────────────┐
        │ 1. search_orders                  │ 1. list_products                  │  ← tool changed
        │    status: "open"                 │    category: "electronics"        │
        │                                   │                                   │
        │ 2. get_order                      │ 2. get_order                      │  ← args changed
        │    order_id: "ord_1234"           │    order_id: "ord_5678"           │
        │                ^^^^                              ^^^^                 │
        │                                   │                                   │
        │ 3. send_email                     │ 3. send_email                     │  ✓ match
        │    to: "customer@example.com"     │    to: "customer@example.com"     │
        └───────────────────────────────────┴───────────────────────────────────┘

        Legend: red = removed/expected-only, green = added/actual-only,
                yellow underline = changed chars, dim = unchanged
        Repro:  kindlm test -t checkout-flow
```

Color mapping via `Colorize`:
- Tool-name row, `kind: "change"`: name in `c.yellow()`, row marker `← tool changed` in `c.dim()`.
- Arg value char-diff: removed spans `c.red()`, added spans `c.green()`, unchanged `c.dim()`.
- Matching rows: whole row `c.dim()` with trailing `c.green("✓ match")`.
- Box drawing: `┌─┐└─┘│├─┤┬─┴` by default; ASCII fallback `+-|+` behind `--ascii` / `KINDLM_NO_UNICODE=1`.

### Markdown mockup (DIFF-03)

```markdown
### Tool-call trajectory mismatch

Test **`checkout-flow`** — trajectory_exact_match failed (0.67 / 1.00)

```diff
  Step 1
- search_orders(status="open")
+ list_products(category="electronics")

  Step 2  (get_order — args changed)
- get_order(order_id="ord_1234")
+ get_order(order_id="ord_5678")

  Step 3  (match)
  send_email(to="customer@example.com")
```

<details><summary>Full arg diff for step 2</summary>

| key | expected | actual |
|---|---|---|
| `order_id` | `ord_1234` | `ord_5678` |

</details>

Repro: `kindlm test -t checkout-flow`
```

The fenced `diff` block is the primary surface — GitHub renders `+` lines green and `-` lines red natively, no custom HTML needed. The `<details>` block carries the per-key arg breakdown for cases too noisy for inline display.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat per-key `expected: X / received: Y` list on a single `tool_called` failure (KindLM v2.3) | Aligned sequence diff over full trajectory with char-level arg highlight | Phase 24 (this phase) | Covers reordered calls, missing calls, extra calls — not just arg mismatch on one call |
| EvalView Python terminal-only trajectory diff | Terminal + PR markdown (both surfaces) | 2026-04 KindLM | PR-comment diff is the market gap — v2.4-market-signal.md §4.1 |
| DeepEval `ToolCorrectnessMetric` (no visualization, just score) | Score PLUS human-readable diff on failure | 2026-04 KindLM | "why did I fail" answered in the terminal, not in a dashboard |

**Deprecated/outdated:** Nothing to deprecate in this phase. The existing `argDiffs` metadata on `tool_called` failures remains — it's a simpler subset and the renderer can use it as a backwards-compat input to `renderTrajectoryDiffTerminal` with a single-row trajectory.

## Interaction with Phase 20 (Trajectory Metrics)

Phase 20 adds `trajectory_precision`, `trajectory_recall`, `trajectory_exact_match` assertions that compute scalar metrics against a `reference` tool-call sequence declared in YAML. Phase 24's job is to **render the diff when those assertions fail**.

Required metadata contract (Phase 20 must set; Phase 24 consumes):
```typescript
// packages/core/src/assertions/interface.ts — metadata shape expected by renderer
interface TrajectoryAssertionMetadata {
  expectedTrajectory: ProviderToolCall[];   // from YAML `reference:` block
  actualTrajectory:   ProviderToolCall[];   // from response.toolCalls
  ordered: boolean;                         // from TRAJ-04 config flag
  metric: "precision" | "recall" | "exact_match";
  threshold?: number;
}
```

Planner must confirm Phase 20 exposes exactly this metadata (or negotiate the shape). If Phase 20 lands with different field names, add an adapter in `extractTrajectoryDetail()` in `pretty.ts` mirroring the existing `extractToolCallDetail()` pattern. `[ASSUMED: Phase 20 will set metadata in this shape — needs confirmation from Phase 20 plan]`

Rendering policy:
- On fail: render full trajectory diff (two-column terminal + markdown section).
- On pass: render nothing (trajectories are long — don't clutter passing output). Phase 22 failure-first terminal already collapses passing assertions.

The existing single-call `tool_called` / `tool_order` argDiffs path stays as a lighter-weight fallback for tests that haven't migrated to trajectory assertions.

## Environment Availability

Phase 24 is pure code — no external tools, databases, or services required. The only new dependency is the `diff` npm package fetched during `npm install`.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥20 | All core code | ✓ | enforced in `engines` | — |
| `diff` npm package | char-level arg diff | ✓ (to be installed) | 8.0.4 | `fast-diff` (smaller alt) or hand-rolled LCS (degraded) |
| ANSI-capable terminal | terminal renderer | ✓ (user's TTY) | — | ASCII fallback built-in |
| GitHub Flavored Markdown renderer | PR comment | ✓ (GitHub) | — | Plain markdown fallback without fenced-diff block |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — everything is available.

## Validation Architecture

`workflow.nyquist_validation` key absent in `.planning/config.json` → enabled by default.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 (`[VERIFIED: packages/core/package.json depends via root]`) |
| Config file | `/Users/petr/projects/kindlm/vitest.config.ts` (shared root) + per-package configs |
| Quick run command | `npm run test --workspace=@kindlm/core -- src/diff` |
| Full suite command | `npm run test` (root — runs all workspaces via turbo) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIFF-01 | Two-column terminal diff for mixed insert/delete/change | unit + snapshot | `npm run test --workspace=@kindlm/core -- src/diff/render-terminal.test.ts` | ❌ Wave 0 |
| DIFF-01 | LCS alignment handles reordered / missing / extra calls | unit | `npm run test --workspace=@kindlm/core -- src/diff/align.test.ts` | ❌ Wave 0 |
| DIFF-02 | Char-level arg diff highlights exact changed substrings | unit + snapshot | `npm run test --workspace=@kindlm/core -- src/diff/arg-diff.test.ts` | ❌ Wave 0 |
| DIFF-02 | Stable stringify prevents spurious diffs from key reorder | unit | same as above | ❌ Wave 0 |
| DIFF-03 | Markdown renderer emits fenced `diff` block | unit + snapshot | `npm run test --workspace=@kindlm/core -- src/diff/render-markdown.test.ts` | ❌ Wave 0 |
| DIFF-03 | PR-comment integration wires diff into comment body | integration | `npm run test --workspace=@kindlm/cli -- src/pr-comment` (depends on Phase 23 layout) | ❌ Wave 0 |
| DIFF-01 | pretty.ts calls renderer on trajectory failure (no regression on existing tool_called rendering) | integration | `npm run test --workspace=@kindlm/core -- src/reporters/pretty.test.ts` | ✅ exists, extend |

### Sampling Rate
- **Per task commit:** `npm run test --workspace=@kindlm/core -- src/diff` (quick, ~5 s)
- **Per wave merge:** `npm run test --workspace=@kindlm/core` (core only) + `npm run typecheck`
- **Phase gate:** `npm run test && npm run typecheck && npm run lint` at repo root before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/core/src/diff/align.test.ts` — covers DIFF-01 (alignment)
- [ ] `packages/core/src/diff/arg-diff.test.ts` — covers DIFF-02
- [ ] `packages/core/src/diff/render-terminal.test.ts` — covers DIFF-01 rendering + snapshots
- [ ] `packages/core/src/diff/render-markdown.test.ts` — covers DIFF-03
- [ ] Fixture helper (shared between tests) with canned trajectories: identical, arg-changed, missing-call, extra-call, reordered, mixed
- [ ] Mock `Colorize` returning wrapping markers (`<r>...</r>`, `<g>...</g>`) for snapshot readability — pattern already established in `pretty.test.ts` line 235

Framework install: none — Vitest already on root. No new config required.

### Snapshot testing strategy
Use Vitest's `toMatchInlineSnapshot` for small outputs and `toMatchSnapshot` for the multi-line terminal and markdown renderings. Each scenario gets one snapshot:

1. **Identical trajectories** — renderer returns empty string (no diff to show).
2. **Single arg changed** — char-level highlight visible; tool names dim.
3. **Missing expected call** — `-` row only in expected column / `-` lines in markdown.
4. **Extra actual call** — `+` row only in actual column / `+` lines in markdown.
5. **Tool swapped at position** — `change` row with dim tool-name comparison.
6. **Reordered (ordered=true)** — shows as removes + adds.
7. **Reordered (ordered=false)** — shows as dim "reordered: A,B,C → B,A,C" note without per-row diff.
8. **Very long arg values** — truncation kicks in; full value spills to a follow-up details block.
9. **Unicode / emoji in args** — char diff doesn't corrupt.
10. **Empty expected trajectory** — all-add diff.
11. **Empty actual trajectory** — all-remove diff.

Strip ANSI escapes before `.toContain()` assertions (pattern from `dry-run.test.ts` per CLAUDE.md key decisions).

## Security Domain

`security_enforcement` key absent in `.planning/config.json` → default enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase is pure rendering, no auth surface |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No new endpoints or resources |
| V5 Input Validation | yes | Tool-call args are arbitrary JSON from providers — must be handled as untrusted; no `eval`, no HTML injection into markdown |
| V6 Cryptography | no | No crypto in this phase |
| V7 Error Handling | yes | Diff renderer must not leak stack traces or secrets when args contain API keys |
| V14 Configuration | no | No new config surface |

### Known Threat Patterns for terminal + markdown rendering

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Markdown injection via attacker-controlled tool-call args bleeding into PR comments | Tampering / EoP | Escape backticks and pipe chars in arg values before embedding in markdown tables / fenced blocks. Use 4-backtick or 7-backtick fences if content contains 3-backticks. |
| ANSI escape injection via tool-call args (terminal hijack) | Tampering | Strip all `\x1b` sequences from arg strings before embedding in terminal output. |
| Secret / API key leakage into diff output | Information disclosure | Reuse existing `truncateArgs` path + add a redaction pass for common secret patterns (`sk-`, `ghp_`, `AKIA`, JWT-ish strings). Coordinate with existing PII assertion regex. |
| JSON DOS via deeply nested args | DoS | Cap recursion depth in stable stringify (e.g., 20). Truncate and tag `…(truncated)`. |
| Unicode bidi / RTL override attacks in diffs | Tampering | Strip `\u202E` (RTL override) and related bidi chars from arg values before rendering. `[CITED: CVE-2021-42574 "Trojan Source"]` |

Planner must include tasks for: (1) ANSI strip on untrusted arg content before terminal rendering, (2) markdown-safe escaping in the markdown renderer, (3) secret-redaction helper shared with the existing PII assertion, (4) Trojan Source bidi stripping.

## Project Constraints (from CLAUDE.md)

Directives extracted that apply to this phase:

1. **Zero I/O in `@kindlm/core`.** No `fs`, `fetch`, `console.log`, no chalk. All I/O is injected. → Diff renderer is pure; terminal coloring via `Colorize`.
2. **No classes** except error types. → Use `createTrajectoryDiffer()` / `renderTrajectoryDiffTerminal()` factory + function exports.
3. **Result types over exceptions.** → Renderer returns `string` (never throws). On malformed input, return a dim `"(diff unavailable)"` placeholder.
4. **No `any`.** Use `unknown` + type narrowing. → Arg values are `unknown`, narrow with `typeof`.
5. **`.js` extensions in relative imports.** → `import { diffChars } from "diff";` (bare) is fine; internal `./align.js` etc.
6. **`import type` for type-only imports** (verbatimModuleSyntax). → Applies to `ProviderToolCall`, `Colorize`, `Change`.
7. **One file per concern.** → Separate `align.ts`, `arg-diff.ts`, `render-terminal.ts`, `render-markdown.ts`.
8. **Barrel exports.** → `diff/index.ts` re-exports public API.
9. **Comments explain why, not what.** → Comment only the LCS walk-back logic and the markdown-escape rationale.
10. **Descriptive naming.** → `renderTrajectoryDiffTerminal`, not `renderTD`.
11. **Co-locate tests with source** (`*.test.ts`).
12. **Run `tsc --noEmit` + ESLint before reporting done.** → Phase-gate verification step.
13. **Check all reference sites before renaming/deleting** (from global CLAUDE.md). → Applies when wiring into `pretty.ts`; grep for `extractToolCallDetail` callers first.
14. **Don't duplicate state** (global CLAUDE.md). → Assertion metadata stays the single source of truth; the diff module reads from it, doesn't cache a parallel copy.
15. **Workers compat for cloud consumption.** → Diff module uses only pure JS. `diff` (jsdiff) is pure JS, Workers-safe. Verified: no Node.js built-in imports in jsdiff `[VERIFIED: jsdiff is used in ESLint browser builds]`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 20 will expose `expectedTrajectory` + `actualTrajectory` + `ordered` in assertion metadata | Interaction with Phase 20 | Renderer gets data in a different shape; adapter needed in pretty.ts. Mitigation: confirm metadata contract in Phase 20 plan before coding Phase 24 Wave 1. |
| A2 | jsdiff's `diffChars` handles UTF-16 surrogate pairs correctly in v8 | Pitfall 4 | Corrupted emoji in diffs. Mitigation: add an explicit emoji-in-arg snapshot test; if broken, switch to `diffWordsWithSpace` or pre-normalize NFC. |
| A3 | GitHub renders fenced ```` ```diff ```` blocks with +/- line coloring in PR comments | Markdown mockup | PR comment looks flat. Very low risk — this is a GitHub-documented feature since ~2015. |
| A4 | Phase 23 PR-comment builder will accept a "diff block" parameter from Phase 24 | Wire-up points | Integration mismatch. Mitigation: Phase 24 plan should depend explicitly on Phase 23 and negotiate the PR-comment builder API. |
| A5 | `diff` package v8.0.4 is Workers-compatible (no Node built-ins) | Constraints #15 | Cloud build breaks if diff is ever imported at runtime in `@kindlm/cloud`. Mitigation: cloud currently imports only *types* from core — the `diff/` module stays untouched at runtime. Enforced by existing CI typecheck. |
| A6 | Current CI terminals (GitHub Actions default runner) render UTF-8 box drawing correctly | Pitfall 1 / ASCII fallback | Garbled CI logs. Low risk for GH Actions (UTF-8 default); hedge with `--ascii` flag + `KINDLM_NO_UNICODE` env var. |
| A7 | Char-level diff is the right granularity for arg values | DIFF-02 | For very long JSON strings, word-level or line-level might be more readable. Mitigation: expose `granularity: "char" \| "word"` option; default char; fall back to word above N chars. |

**Action for planner:** Treat A1 and A4 as blocking — confirm metadata + PR-comment contracts with Phase 20 and Phase 23 planners before Wave 1. A2 and A7 are testable assumptions — snapshot tests will surface them.

## Open Questions

1. **Should single-call `tool_called` arg-mismatch failures also use the new renderer?**
   - What we know: existing `pretty.ts` L208-228 already handles this with a simpler per-key list; `argDiffs` metadata is already populated.
   - What's unclear: whether forcing the new renderer on single-call failures is worth the visual overhead of a two-column box for one row.
   - Recommendation: Keep the existing per-key display for single-call failures; reserve the two-column box for trajectory assertions (3+ rows). Gate via row count in the renderer.

2. **What's the truncation strategy for very long arg values in the two-column terminal view?**
   - What we know: default terminal width is ~100-120; arg values can be huge JSON blobs.
   - What's unclear: whether to truncate inline (`…`), wrap, or spill to a follow-up "full arg diff" block below the two-column view.
   - Recommendation: Truncate inline at `maxArgChars = (width - 5) / 2 - 10`; when truncation happens, emit a follow-up "full arg diff for step N" block with the non-truncated char-diff.

3. **Should the markdown renderer support both fenced-diff and table formats?**
   - What we know: fenced-diff renders natively on GitHub with color; tables are more structured.
   - What's unclear: whether auditors reading compliance reports prefer tables.
   - Recommendation: Ship fenced-diff for PR comments (DIFF-03). Table mode can be a flag (`format: "diff" | "table"`) but is optional for v2.4.0.

4. **Do we need a config knob for color theme?**
   - What we know: CLAUDE.md doesn't mention theme config; existing Colorize is hard-coded via chalk.
   - Recommendation: Out of scope for Phase 24. Ship default green/red/yellow; theme work is v2.5.

5. **How does Phase 22 (failure-first terminal) interact with this diff?**
   - Phase 22 collapses passes. Phase 24 renders on fail. They're complementary: the trajectory diff is exactly the "expanded failure detail" Phase 22 surfaces after the collapsed green summary.
   - Recommendation: Phase 22 plan should reserve a slot for "diff block" in its failure-expansion template; Phase 24 fills it.

## Testing Strategy (expanded)

Beyond the per-unit tests listed in Validation Architecture, the phase needs:

1. **Snapshot fixtures** — a `test-fixtures/trajectories.ts` module exporting canned `{ expected, actual, label }` triples, reused across align + render tests. Scenarios: identical, arg-changed-single-call, arg-changed-multi-call, missing-middle-call, extra-last-call, tool-swapped, fully-reordered (ordered vs any-order), empty-expected, empty-actual, unicode-args, long-args, nested-arg-structures, null-vs-missing-key.

2. **Golden terminal snapshots** — mock `Colorize` to wrap colors in markers (`[R]…[/R]`) for readable snapshot diffs. Pattern from `pretty.test.ts` L235.

3. **Golden markdown snapshots** — full-string equality against expected markdown output, including fenced-diff block layout.

4. **Property tests (optional, fast-check is already a dev dep per STACK.md):** generate random short trajectories, assert that `alignTrajectories(a, a)` always yields all-equal rows, and that the row count is always `max(|a|, |b|) ≤ rows ≤ |a| + |b|`.

5. **Integration test into `pretty.ts`:** construct a fake `AssertionResult` with trajectory metadata and assert the full reporter output includes the diff. Extend `pretty.test.ts`.

6. **Regression test for existing `tool_called` arg-mismatch path** — ensure the new module does NOT break the existing L208-228 rendering when metadata lacks `expectedTrajectory`.

7. **Cross-platform newline check** — diff output uses `\n` only; no `\r\n`.

8. **Bundle-size check (soft gate):** after adding `diff`, run `du -sh packages/core/dist/` and compare to pre-phase size. Target: < +50 KB unpacked. `diff` is ~520 KB unpacked but tsup tree-shakes; we only import `diffChars`.

## Sources

### Primary (HIGH confidence)
- `packages/core/src/reporters/pretty.ts` L163-233 — existing `extractToolCallDetail` + `argDiffs` rendering `[VERIFIED: codebase read 2026-04-09]`
- `packages/core/src/assertions/tool-calls.ts` L53-185 — existing `computeArgDiffs` + `metadata.argDiffs` contract `[VERIFIED]`
- `packages/core/src/types/provider.ts` L40-46 — `ProviderToolCall` shape with `index: number` for sequence position `[VERIFIED]`
- `packages/core/package.json` — confirms no existing `diff` dependency, `zod/yaml/ajv` only `[VERIFIED]`
- `npm view diff` — jsdiff v8.0.4, BSD-3, zero deps, published 2026-03-23, ESM+CJS, types built-in `[VERIFIED: npm registry 2026-04-09]`
- `.planning/research/v2.4-market-signal.md` L549-564 — §4.1 presentation ranking, "nobody ships this well" call-out `[VERIFIED: file read]`
- `.planning/REQUIREMENTS.md` L52-55 — DIFF-01..03 requirement text `[VERIFIED]`
- `.planning/ROADMAP.md` L136-145 — Phase 24 success criteria `[VERIFIED]`
- `./CLAUDE.md` + `.claude/CLAUDE.md` — project-specific conventions `[VERIFIED]`
- `./.planning/config.json` — workflow flags absent → defaults `[VERIFIED]`

### Secondary (MEDIUM confidence)
- jsdiff README — `diffChars`, `diffWords`, `diffJson` APIs `[CITED: github.com/kpdecker/jsdiff]`
- GitHub Flavored Markdown — fenced `diff` code blocks with `+/-` line coloring `[CITED: docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-and-highlighting-code-blocks]`
- CVE-2021-42574 "Trojan Source" — bidi unicode override attacks `[CITED]`
- Wikipedia — Longest common subsequence problem, classical DP `[CITED]`

### Tertiary (LOW confidence)
- "EvalView does full-trajectory diffing but Python-native, terminal-only" claim — from v2.4 market-signal research; not re-verified this session. Doesn't affect Phase 24 implementation, only positioning.
- `fast-diff` as alternative to jsdiff — known in the ecosystem via Prettier; not re-verified for current version/license.

## Metadata

**Confidence breakdown:**
- Library choice (jsdiff): HIGH — verified version, license, types, zero deps on npm 2026-04-09
- LCS alignment approach: HIGH — classical, well-understood, fits short sequences
- ASCII/terminal mockup: HIGH — matches existing `Colorize` + box-drawing conventions in KindLM codebase
- Markdown fenced-diff format: HIGH — GitHub-documented feature
- Phase 20 metadata contract: MEDIUM — depends on Phase 20 plan; marked as assumption A1
- Phase 22 / 23 integration points: MEDIUM — depends on those phases' interface shapes; marked as assumptions A4
- Secret/bidi/ANSI escaping controls: MEDIUM — patterns are standard, but specific regex/redaction rules need to match existing PII assertion module
- Bundle-size impact of adding `diff`: MEDIUM — tsup tree-shaking should help; needs post-implementation measurement

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (30 days — stack is stable; only jsdiff upstream churn would invalidate)
