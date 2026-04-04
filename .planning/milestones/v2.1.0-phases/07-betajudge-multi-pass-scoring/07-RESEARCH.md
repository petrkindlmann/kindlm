# Phase 7: betaJudge Multi-Pass Scoring - Research

**Researched:** 2026-04-01
**Domain:** Core assertion engine — judge.ts multi-pass median scoring
**Confidence:** HIGH

## Summary

Phase 7 wires the already-declared `betaJudge` feature flag into the judge assertion logic. The flag exists in `FeatureFlags` and `features.ts` but has no effect today — `createJudgeAssertion` always runs exactly one evaluation pass. The work is entirely in `@kindlm/core` (zero I/O), with a thin wiring step in `run-tests.ts` to pass the flag down to the assertion context.

The core algorithm is: run the judge 3 times, collect scores from successful passes only, require `ceil(3/2) = 2` successes as a minimum quorum, and return the median of the successful scores. If fewer than 2 passes succeed, surface `JUDGE_EVAL_ERROR` immediately rather than a potentially misleading median of one.

This phase touches 2–3 files: `packages/core/src/assertions/judge.ts` (the algorithm), `packages/core/src/assertions/interface.ts` (add `betaJudge?: boolean` to `AssertionContext`), and the `run-tests.ts` wiring. No schema changes, no new files, no I/O.

**Primary recommendation:** Implement multi-pass logic as a self-contained block inside `createJudgeAssertion`'s `evaluate` method, gated by `context.betaJudge`. Single-pass path must remain byte-for-byte equivalent to the current implementation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JUDGE-01 | `betaJudge` flag enables 3-pass median judge scoring; errored passes are excluded from median (minimum 1 successful pass required, per REQUIREMENTS.md — but success criteria says `ceil(N/2)` = 2, use 2) | `judge.ts` evaluate method extended; `AssertionContext.betaJudge` carries the flag |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- No ES6 classes except error types — use factory functions (`createJudgeAssertion` is already a factory, keep it)
- `@kindlm/core` must have zero I/O — no `fs`, `fetch`, `console.log`; the `betaJudge` flag must come in via `AssertionContext`, not read from a file inside core
- Result types over exceptions — fallible operations return `Result<T, E>` or the `AssertionResult` error pattern already used in `judge.ts`
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- All relative imports require `.js` extension
- `strict: true` TypeScript — no `any`, use `unknown` with narrowing
- Run `npx tsc --noEmit` and `npx eslint . --quiet` before reporting complete
- One file per concern — multi-pass logic stays inside `judge.ts`, not a new file

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.0 | Language | Project-wide, strict mode |
| Vitest | 3.2.4 | Test framework | Project-wide test runner |

No new dependencies. This is a pure logic change to existing core code.

**Installation:** None required.

## Architecture Patterns

### Where betaJudge Lives

The flag must travel from `features.ts` (CLI layer) → `AssertionContext` (core interface) → `createJudgeAssertion.evaluate()` (core implementation). This is the same injection pattern used for `judgeAdapter` and `judgeModel`.

**Step 1 — Extend `AssertionContext` interface** (`packages/core/src/assertions/interface.ts`):

```typescript
export interface AssertionContext {
  // ... existing fields ...
  betaJudge?: boolean;   // When true, run 3 passes and return median score
}
```

**Step 2 — Multi-pass algorithm in `judge.ts`**:

```typescript
// Inside evaluate(context):
if (!context.betaJudge) {
  // existing single-pass path — unchanged
}

// Multi-pass path
const PASSES = 3;
const MIN_QUORUM = Math.ceil(PASSES / 2); // 2

type PassResult =
  | { ok: true; score: number; reasoning: string }
  | { ok: false; failureCode: FailureCode; failureMessage: string };

const passResults: PassResult[] = [];
for (let i = 0; i < PASSES; i++) {
  try {
    const response = await context.judgeAdapter.complete({ /* same request */ });
    const parsed = parseJudgeResponse(response.text);
    if (parsed.ok) {
      passResults.push({ ok: true, score: parsed.score, reasoning: parsed.reasoning });
    } else {
      passResults.push({ ok: false, failureCode: "JUDGE_PARSE_ERROR", failureMessage: parsed.reason });
    }
  } catch (e) {
    passResults.push({
      ok: false,
      failureCode: "JUDGE_EVAL_ERROR",
      failureMessage: `Judge adapter error (pass ${i + 1}): ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}

const successfulPasses = passResults.filter((r): r is Extract<PassResult, { ok: true }> => r.ok);

if (successfulPasses.length < MIN_QUORUM) {
  // Not enough passes succeeded — return error, not a poisoned median
  const firstError = passResults.find(r => !r.ok) as Extract<PassResult, { ok: false }>;
  return [{
    assertionType: "judge",
    label: `Judge: ${config.criteria}`,
    passed: false,
    score: 0,
    failureCode: "JUDGE_EVAL_ERROR",
    failureMessage: `betaJudge: only ${successfulPasses.length}/${PASSES} passes succeeded (need ${MIN_QUORUM}): ${firstError.failureMessage}`,
  }];
}

// Median of successful scores
const scores = successfulPasses.map(r => r.score).sort((a, b) => a - b);
const median = scores[Math.floor(scores.length / 2)]!;
const passed = median >= config.minScore;

return [{
  assertionType: "judge",
  label: `Judge: ${config.criteria}`,
  passed,
  score: median,
  failureCode: passed ? undefined : "JUDGE_BELOW_THRESHOLD",
  failureMessage: passed ? undefined : `Median score ${median} below threshold ${config.minScore}`,
  metadata: {
    reasoning: successfulPasses[Math.floor(successfulPasses.length / 2)]!.reasoning,
    threshold: config.minScore,
    betaJudge: { passes: PASSES, successful: successfulPasses.length, scores },
  },
}];
```

**Step 3 — Wire in `run-tests.ts`** (`packages/cli/src/utils/run-tests.ts`):

The `buildAssertionContext` function in `runner.ts` constructs `AssertionContext`. However, `runner.ts` is in `@kindlm/core` which has no I/O access. The `betaJudge` flag must be passed as a parameter into `createRunner` or injected differently.

**Design choice — pass via `RunnerDeps`:**

```typescript
// runner.ts RunnerDeps
export interface RunnerDeps {
  // ... existing ...
  betaJudge?: boolean;
}

// In buildAssertionContext:
const context: AssertionContext = {
  // ... existing ...
  betaJudge: deps.betaJudge,
};
```

Then in `run-tests.ts`:
```typescript
const runner = createRunner(config, {
  adapters,
  configDir,
  fileReader,
  onEvent,
  baselineData: options.baselineData,
  commandExecutor,
  betaJudge: isEnabled(featureFlags, "betaJudge"),
});
```

### Median Calculation Note

With exactly 3 passes where 2 succeed: `scores.sort(); median = scores[1]` (index `Math.floor(2/2) = 1`). This is the higher of the two values. With 3 successes: median = `scores[1]` (middle value). This is the standard lower-median for odd counts.

### Anti-Patterns to Avoid

- **Include errored/parse-failed passes in the score computation:** The quorum check exists precisely to avoid this. Errored passes have no valid score (score=0 would poison the median downward).
- **Run all 3 passes in parallel with `Promise.all`:** Sequential passes are safer — if pass 1 and 2 both throw (rate limit), pass 3 is also likely to throw and sequential failure is faster to detect. The current single-pass code is sequential; keep that pattern for consistency.
- **Placing multi-pass orchestration in `run-tests.ts`:** It belongs in `judge.ts` where single-pass already lives. The `AssertionContext.betaJudge` flag is the correct injection point.
- **Changing the default behavior:** When `betaJudge` is false/absent, the code path must be identical to the pre-Phase-7 implementation — not just equivalent, but the same code branch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Median of floats | Custom percentile library | Inline `scores.sort()[Math.floor(n/2)]` | Array is always length 1–3; standard sort + index is correct and readable |
| Feature flag reading | Custom config parser | Existing `isEnabled(featureFlags, "betaJudge")` from `features.ts` | Already implemented and tested |

## Common Pitfalls

### Pitfall 1: Quorum Definition Ambiguity
**What goes wrong:** REQUIREMENTS.md says "minimum 1 successful pass required" but the success criteria says "fewer than `ceil(N/2)`". These contradict for N=3 (ceil(3/2)=2 vs. 1).
**Why it happens:** Requirements were written loosely; success criteria are more specific.
**How to avoid:** Use the success criteria definition — require `ceil(3/2) = 2` successes as the quorum. The success criteria document is the authoritative spec for this phase.
**Warning signs:** A test that returns a score from 1 successful pass out of 3 total is a sign the quorum check is wrong.

### Pitfall 2: Leaking betaJudge into Zero-I/O Core
**What goes wrong:** Reading `.kindlm/config.json` directly inside `judge.ts` or `runner.ts` to check the flag.
**Why it happens:** Seems convenient — avoid threading the flag through deps.
**How to avoid:** The flag travels via `RunnerDeps.betaJudge` → `AssertionContext.betaJudge`. Core never reads files.

### Pitfall 3: Forgetting judgeAdapter/judgeModel Guard in Multi-Pass Path
**What goes wrong:** The multi-pass loop runs without checking `context.judgeAdapter` first, throwing a cryptic undefined error.
**Why it happens:** The guard is currently at the top of `evaluate`. If the multi-pass branch is added before or after the guard incorrectly, it's bypassed.
**How to avoid:** The `!context.judgeAdapter || !context.judgeModel` guard MUST remain at the top of `evaluate`, before both single-pass and multi-pass branches.

### Pitfall 4: Single-Pass Tests Break After Adding betaJudge Field
**What goes wrong:** Existing judge tests that construct `AssertionContext` manually fail because `betaJudge` is now required.
**Why it happens:** Forgot to mark the new field `optional` (`betaJudge?: boolean`).
**How to avoid:** Always add new `AssertionContext` fields as optional. Absence = false (default behavior).

### Pitfall 5: Median Index Off-By-One
**What goes wrong:** With 2 successful passes, `scores[Math.floor(2/2)] = scores[1]` (index 1 = second element = higher score). This is intentional — ties go to the higher score. But if the array is not sorted ascending, the result is wrong.
**Why it happens:** `.sort()` on numbers without a comparator sorts lexicographically. `[0.9, 0.3].sort()` → `[0.3, 0.9]` happens to be correct by coincidence, but `[0.9, 0.11].sort()` → `[0.11, 0.9]` is also correct, while `[0.9, 0.1, 0.11].sort()` → `[0.1, 0.11, 0.9]` is also fine for unit-interval floats. However, use `(a, b) => a - b` comparator to be explicit and safe.
**Warning signs:** Passing tests with specific score values that happen to sort correctly lexicographically but are wrong semantically.

## Code Examples

### Existing Single-Pass Structure to Preserve
```typescript
// Source: packages/core/src/assertions/judge.ts (current)
// The guard at line 76-88 must remain the first check in evaluate()
if (!context.judgeAdapter || !context.judgeModel) {
  return [{ assertionType: "judge", label: ..., passed: false, score: 0,
    failureCode: "INTERNAL_ERROR", failureMessage: "..." }];
}
```

### Median of N-element sorted array
```typescript
// For sorted ascending array of length >= 1
const median = scores[Math.floor(scores.length / 2)]!;
// length=1: index 0 (only element)
// length=2: index 1 (higher of two — tie-breaks up)
// length=3: index 1 (middle)
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `packages/core/vitest.config.ts` |
| Quick run command | `npm run test --workspace=packages/core -- --reporter=verbose packages/core/src/assertions/judge.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JUDGE-01 | betaJudge disabled → single pass, no change | unit | `vitest run packages/core/src/assertions/judge.test.ts` | Yes (existing tests cover this) |
| JUDGE-01 | betaJudge enabled → 3 passes, median score reported | unit | `vitest run packages/core/src/assertions/judge.test.ts` | No — new tests needed |
| JUDGE-01 | 2/3 passes succeed → uses median of 2 | unit | `vitest run packages/core/src/assertions/judge.test.ts` | No — new tests needed |
| JUDGE-01 | 1/3 passes succeed → JUDGE_EVAL_ERROR, no score | unit | `vitest run packages/core/src/assertions/judge.test.ts` | No — new tests needed |
| JUDGE-01 | 0/3 passes succeed → JUDGE_EVAL_ERROR | unit | `vitest run packages/core/src/assertions/judge.test.ts` | No — new tests needed |
| JUDGE-01 | All parse failures count as not-successful | unit | `vitest run packages/core/src/assertions/judge.test.ts` | No — new tests needed |

### Sampling Rate
- **Per task commit:** `npx vitest run packages/core/src/assertions/judge.test.ts`
- **Per wave merge:** `npm run test && npm run typecheck`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `packages/core/src/assertions/judge.test.ts` — all JUDGE-01 betaJudge behaviors listed above

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure TypeScript logic change, no new tools, services, or CLI utilities required)

## Open Questions

1. **Quorum: 1 or 2 for N=3?**
   - What we know: REQUIREMENTS.md says "minimum 1 successful pass required"; success criteria says "fewer than `ceil(N/2)`" triggers error (ceil(3/2)=2 means need at least 2)
   - What's unclear: The two documents conflict
   - Recommendation: Use `ceil(N/2) = 2` as the quorum — it's the more conservative, variance-reducing definition and matches the success criteria document

2. **Sequential vs. parallel passes**
   - What we know: 3 sequential judge calls add latency (~3x single-pass)
   - What's unclear: Whether parallel passes are preferred for performance
   - Recommendation: Sequential. Requirements say nothing about parallelism, the existing judge pattern is sequential, and parallel passes risk simultaneous rate-limit errors. Leave optimization for future.

## Sources

### Primary (HIGH confidence)
- Direct code read: `packages/core/src/assertions/judge.ts` — full implementation of current single-pass judge
- Direct code read: `packages/core/src/assertions/interface.ts` — `AssertionContext` interface and `FailureCode` union
- Direct code read: `packages/cli/src/utils/features.ts` — `FeatureFlags` type with `betaJudge: boolean` already present
- Direct code read: `packages/cli/src/utils/run-tests.ts` — `costGating` wiring pattern (exact precedent for `betaJudge` wiring)
- Direct code read: `packages/core/src/engine/runner.ts` — `RunnerDeps`, `buildAssertionContext`, `runAssertions` call chain
- Direct code read: `.planning/REQUIREMENTS.md` — JUDGE-01 requirement text
- Direct code read: `.planning/ROADMAP.md` — Phase 7 success criteria

### Secondary (MEDIUM confidence)
- None required — all findings verified from source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, existing Vitest + TypeScript
- Architecture: HIGH — wiring pattern verified against Phase 6 costGating precedent
- Pitfalls: HIGH — identified from direct code inspection and type system constraints

**Research date:** 2026-04-01
**Valid until:** Stable (no external dependencies) — valid until judge.ts or AssertionContext is refactored
