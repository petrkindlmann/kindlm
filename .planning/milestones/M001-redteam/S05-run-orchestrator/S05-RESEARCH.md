# S05: Run Orchestrator — Research

**Date:** 2026-04-10
**Scope:** M001/S05

## Summary

S05 ties the whole red team pipeline together behind a single pure
orchestrator: `runRedTeam`. Given a validated `KindLMConfig` and an
adapters map, it

1. generates attacks per plugin (re-using S02's `generateAttacksForPlugin`),
2. executes each attack against the target model (**new in S05**),
3. grades each response via `plugin.grade()` (S03), and
4. builds the vulnerability report via `buildRedTeamReport` (S04).

The shape mirrors `engine/generate.ts` exactly — same deps interface,
same concurrency pool, same partial-success semantics at the plugin
level — so S06 (the CLI command) only has to call one function and
format the returned report.

## Architecture Decision

### Do NOT call `runAttackGeneration` as a black box.

`runAttackGeneration` is the S02 aggregator. It returns a flat
`attacks: Attack[]` plus a `perPlugin` map keyed by `${id}#${index}`.
The problem for S05: to grade attacks we must call the *exact plugin
instance* that generated each one (same `pluginConfig`, same
`severity`), and the returned `Attack` only carries `pluginId` — not
the registry key. Re-deriving which plugin instance owns a given
attack when two entries share an id (e.g. two `policy` plugins) is
ambiguous.

The cleanest fix is to re-walk the registry in S05 the same way S02
does, but run a bigger inner task per plugin:

```
generate attacks
  → for each attack: execute against target
    → grade response
  → return verdicts
```

This keeps `plugin`, `pluginCtx`, and `attacks` co-located inside a
single closure, so there's no cross-referencing question. It also
means S05 doesn't couple tightly to the S02 aggregator's return
shape — it depends only on `generateAttacksForPlugin` (the inner
loop) and on the registry helpers. That's a smaller surface.

Trade-off: the config-wiring logic (guards, adapter resolution,
registry build, plugin context construction) is duplicated between
`generate.ts` and `run.ts`. For two callers this is cheap; if a
third emerges we should extract a shared `resolveRedTeamContext`
helper. For S05 we accept the duplication and leave a TODO.

### Partial-success semantics: plugin level, not attack level.

Matching S02:

* **All plugins fail** during generation → aggregate
  `REDTEAM_PLUGIN_ERROR`.
* **Any plugin succeeds** → `ok(result)` with per-plugin outcomes
  recorded in a `perPlugin` map.

Within a successful plugin, individual attack-level failures
(target call throws, grading returns an error `Result`) are
recorded as **synthetic failed verdicts** with `passed: false`,
`score: 0`, and a reason that names the failure. They flow into
`buildRedTeamReport` normally and become "failed probes" in the
report. This preserves two properties:

1. A single transient target-call error never nukes an entire
   plugin's worth of work.
2. The report always shows as many probes as the config asked for
   (no missing rows).

`perPlugin` still carries per-attack execution/grading error
counts so callers can distinguish "10 genuine failures" from "10
probes dropped on the floor by a broken adapter."

### Target call parameters come from the target model config.

The target model's `params` block (temperature, maxTokens, etc.)
should be used verbatim for target calls. This mirrors production:
red teaming exercises the target exactly as its users do. We do
NOT override to `temperature: 0` — that would hide non-determinism
that might itself be a vulnerability.

System prompt resolution: `attack.systemPrompt ?? redteam.target.prompt`.
If both are undefined, we omit the system message entirely.

### Target calls use `withRetry` for transient failures.

Same retry contract as `gradeAttackResponse` (maxRetries: 2,
shouldRetry only on `ProviderError.retryable`). Non-retryable
errors and exhausted retries produce a synthetic failed verdict,
not a plugin-level abort.

### Usage tracking is real in S05 for target calls only.

Target-call `ProviderResponse.usage` is summed across all attacks
and returned as `totalUsage`. Generation and grading call usage
remain stubbed at zero because `generateAttacksForPlugin` and
`gradeAttackResponse` don't surface usage today — surfacing it
would require changing those function signatures across S02/S03,
which is out of scope. We document the gap.

## Implementation Landscape

### New file: `packages/core/src/redteam/engine/run.ts`

**Public exports:**

```typescript
export interface RedTeamRunDeps {
  /** Provider id → adapter map. Same shape as `AttackGenerationDeps`. */
  adapters: Map<string, ProviderAdapter>;
}

export interface PerPluginRunResult {
  /** Number of attacks this plugin generated. Zero when generation failed. */
  attackCount: number;
  /** Number of verdicts produced (including synthetic error verdicts). */
  verdictCount: number;
  /** Count of attacks that failed during target call. */
  executionErrors: number;
  /** Count of attacks that failed during grading. */
  gradingErrors: number;
  /** Present only when generation itself failed (plugin contributed zero verdicts). */
  error?: KindlmError;
}

export interface RedTeamRunResult {
  /** Built report (aggregation + gate evaluation + formatted-ready shape). */
  report: RedTeamReport;
  /** All verdicts in plugin insertion order. */
  verdicts: AttackVerdict[];
  /** Per-plugin outcomes keyed by `${id}#${index}`. */
  perPlugin: Map<string, PerPluginRunResult>;
  /** Aggregate token usage across target calls only. */
  totalUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export async function runRedTeam(
  config: KindLMConfig,
  deps: RedTeamRunDeps,
): Promise<Result<RedTeamRunResult, KindlmError>>;
```

### Internal structure

Mirrors `generate.ts` section by section:

1. **Guard** — `config.redteam` must exist → `CONFIG_VALIDATION_ERROR`.
2. **Build registry** — `createRedTeamPluginRegistry` surfaces
   `CONFIG_VALIDATION_ERROR` verbatim on unknown ids.
3. **Resolve target adapter** — look up `redteam.target.model` in
   `config.models`, then find its provider in `deps.adapters`.
   Capture `targetModelConfig.params` for use in target calls.
4. **Resolve judge adapter** — same pattern as S02.
5. **Build per-plugin tasks** — each task is a closure over
   `(plugin, pluginCtx, targetAdapter, targetParams, targetModelId,
   targetSystemPrompt)`. Returns a `PluginTaskOutcome`.
6. **Run pool** — `runWithConcurrency(tasks, redteam.strategy.concurrency)`.
7. **Roll up** — same all-fail vs partial-success logic as S02, but
   also accumulates `totalUsage` and assembles the final
   `verdicts[]`.
8. **Build report** — call `buildRedTeamReport(verdicts, redteam.gates)`.
9. **Return** `ok({ report, verdicts, perPlugin, totalUsage })`.

### The per-plugin task (new part)

```typescript
async function runPluginTask(deps): Promise<PluginTaskOutcome> {
  // 1. Generate attacks.
  const genResult = await generateAttacksForPlugin(plugin, pluginCtx);
  if (!genResult.success) {
    return {
      pluginKey,
      verdicts: [],
      attackCount: 0,
      executionErrors: 0,
      gradingErrors: 0,
      generationError: genResult.error,
    };
  }
  const attacks = genResult.data;

  // 2. For each attack: execute → grade → record verdict.
  const verdicts: AttackVerdict[] = [];
  let executionErrors = 0;
  let gradingErrors = 0;

  for (const attack of attacks) {
    // System prompt resolution: attack > target.prompt > none.
    const systemPrompt = attack.systemPrompt ?? targetSystemPrompt;
    const messages: ProviderMessage[] = [];
    if (systemPrompt !== undefined) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: attack.userPrompt });

    // 2a. Execute with retry.
    let outputText: string;
    try {
      const response = await withRetry(
        () => targetAdapter.complete({
          model: targetModelId,
          messages,
          params: targetParams,
        }),
        {
          maxRetries: 2,
          shouldRetry: (e) => e instanceof ProviderError && e.retryable,
        },
      );
      outputText = response.text;
      totalUsage.inputTokens += response.usage.inputTokens;
      totalUsage.outputTokens += response.usage.outputTokens;
      totalUsage.totalTokens += response.usage.totalTokens;
    } catch (error) {
      executionErrors += 1;
      verdicts.push({
        attack,
        passed: false,
        score: 0,
        reason: `Target adapter call failed: ${messageOf(error)}`,
      });
      continue;
    }

    // 2b. Grade.
    const gradeResult = await plugin.grade(attack, outputText, pluginCtx);
    if (!gradeResult.success) {
      gradingErrors += 1;
      verdicts.push({
        attack,
        passed: false,
        score: 0,
        reason: `Grading failed: ${gradeResult.error.message}`,
      });
      continue;
    }
    verdicts.push(gradeResult.data);
  }

  return {
    pluginKey,
    verdicts,
    attackCount: attacks.length,
    executionErrors,
    gradingErrors,
  };
}
```

(The real implementation merges `totalUsage` updates through a
shared accumulator handed in by the outer function so the pool
can still run tasks in parallel without racy writes — see note
below.)

### Concurrency and shared state

`runWithConcurrency` runs tasks in parallel. Target-call usage is
the only mutable shared state. Two options:

1. Accumulate per-task into the returned `PluginTaskOutcome`, then
   sum after the pool finishes. **Chosen** — no shared mutation
   during parallel execution, keeps the pool behavior identical
   to S02.
2. Pass a shared accumulator object. Rejected — adds race windows
   even though JS is single-threaded, because partial increments
   between `await` points are brittle and hard to test.

So `PluginTaskOutcome` grows a `usage` field that the outer roll-up
sums into `totalUsage`.

### Pattern fidelity with generate.ts

* Outcome key: same `${id}#${index}` registry key.
* All-fail signal: `REDTEAM_PLUGIN_ERROR` with `details.perPlugin`
  populated by a plain `Object.fromEntries` over the per-plugin map.
* Try/catch wrapper around the per-plugin closure catches
  *unhandled* exceptions and maps them to `generationError`
  `REDTEAM_PLUGIN_ERROR` — `generateAttacksForPlugin` and
  `plugin.grade` already wrap expected failures in `Result`, so
  reaching the catch means something exotic escaped (same
  reasoning as S02 line 219-235).

### Existing code S05 imports

* `runWithConcurrency` — `../../engine/concurrency.js`
* `generateAttacksForPlugin` — `../generation/generate.js`
* `createRedTeamPluginRegistry`, `resolveSeverity`,
  `RedTeamPluginConfigInput` — `../plugins/registry.js`
* `buildRedTeamReport`, `RedTeamReport` — `./report.js`
* `withRetry` — `../../providers/retry.js`
* `ProviderError`, `ProviderMessage`, `ProviderAdapter` — `../../types/provider.js`
* `Attack`, `AttackVerdict`, `RedTeamPluginContext` — `../types.js`
* `Result`, `KindlmError`, `ok`, `err` — `../../types/result.js`
* `KindLMConfig` — `../../config/schema.js`

## Build Order

**T01: runRedTeam happy path** — `redteam/engine/run.ts`
* Config guards + adapter resolution (copy pattern from generate.ts).
* Per-plugin task that generates → executes → grades.
* Outer roll-up + report build.
* Export types and function.

**T02: Tests** — `redteam/engine/run.test.ts`
* Happy path: 3 plugins × 2 attacks, target always says "I cannot
  help with that" → all verdicts passed (the mock judge always
  returns passed: true).
* Mixed verdicts: judge responses drive pass/fail mix → report
  aggregates correctly, gates evaluate, exit-code signal is in
  `report.gates.passed`.
* Target call failure on one attack → synthetic failed verdict
  with `passed: false`, `score: 0`, reason mentions target call;
  `executionErrors` incremented; other attacks still succeed.
* Grading failure on one attack → synthetic failed verdict, reason
  mentions grading; `gradingErrors` incremented; other attacks
  still succeed.
* Plugin generation failure → `perPlugin[key].error` populated,
  attackCount=0, no verdicts from that plugin, other plugins
  contribute normally.
* All plugins fail generation → `err(REDTEAM_PLUGIN_ERROR)` with
  `details.perPlugin` map.
* Config wiring: no redteam block, missing target model, missing
  adapter, missing judge model → correct error codes (reuse S02
  test patterns).
* `totalUsage` accumulates target-call usage only.
* Report gates: `maxCriticalFailures=0` with 1 critical failure →
  `report.gates.passed === false`.
* Concurrency: 4 plugins × concurrency: 2 serializes correctly
  (attack counts match).

**T03: Barrel export** — `redteam/index.ts`
* Export `runRedTeam`, `RedTeamRunDeps`, `RedTeamRunResult`,
  `PerPluginRunResult`.

## Verification

```bash
npx tsc --noEmit -p packages/core/tsconfig.json
npx eslint packages/core/src/redteam/ --quiet
npx vitest run --reporter=verbose packages/core/src/redteam
```

Expected: all 199+ existing redteam tests still pass, plus the new
run.test.ts suite.

## What S06 Will Need

S06 (`kindlm redteam run` CLI command) will:

1. Parse & validate `kindlm.yaml` via existing config parser.
2. Build `adapters: Map<string, ProviderAdapter>` from
   `config.providers` (same pattern as the main `test` command).
3. Call `runRedTeam(config, { adapters })`.
4. Branch on the `Result`:
   * `err` → log the error, exit 1.
   * `ok(result)` → print `formatRedTeamReportPretty(result.report, colorize)`
     or `formatRedTeamReportJson(result.report)` based on
     `--reporter` flag, then exit `result.report.gates.passed ? 0 : 1`.
5. Surface per-plugin errors from `result.perPlugin` in the output
   so partial failures are visible.

No changes to core are expected from S06 — S05 leaves the public
surface complete.
