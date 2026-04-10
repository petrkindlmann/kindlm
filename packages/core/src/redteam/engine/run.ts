import type { KindLMConfig } from "../../config/schema.js";
import type { Result, KindlmError } from "../../types/result.js";
import type {
  ProviderAdapter,
  ProviderMessage,
  ProviderRequest,
  ProviderResponse,
} from "../../types/provider.js";
import type {
  Attack,
  AttackVerdict,
  RedTeamPluginContext,
} from "../types.js";
import type { RedTeamPlugin } from "../plugins/interface.js";
import type { RedTeamReport } from "./report.js";
import { ok, err } from "../../types/result.js";
import { ProviderError } from "../../types/provider.js";
import { withRetry } from "../../providers/retry.js";
import { runWithConcurrency } from "../../engine/concurrency.js";
import {
  createRedTeamPluginRegistry,
  resolveSeverity,
  type RedTeamPluginConfigInput,
} from "../plugins/registry.js";
import { generateAttacksForPlugin } from "../generation/generate.js";
import { buildRedTeamReport } from "./report.js";

// ============================================================
// Red Team Run Orchestrator (S05)
// ============================================================
//
// `runRedTeam` is the single entry point that stitches the whole
// red team pipeline together:
//
//   1. Generate attacks per plugin      (S02)
//   2. Execute each attack against target (NEW in S05)
//   3. Grade each response               (S03)
//   4. Build the vulnerability report    (S04)
//
// It mirrors `runAttackGeneration` (S02) section by section — same
// guards, same adapter resolution, same registry walk, same
// concurrency pool, same partial-success semantics — but the
// per-plugin task is bigger: it extends generation with execute+grade
// and accumulates `AttackVerdict[]` instead of `Attack[]`.
//
// We deliberately re-walk the registry here rather than calling
// `runAttackGeneration` as a black box. The reason: to grade an
// attack we must call the *exact* plugin instance that produced it,
// with the *exact* `RedTeamPluginContext` used for generation.
// S02's flat `Attack[]` loses that binding when two entries share
// an id (two `policy` plugins are the canonical case). Re-walking
// keeps `plugin`, `pluginCtx`, and attacks co-located inside one
// closure, so there is no re-resolution question.
//
// Trade-off: the config-wiring prelude is duplicated between
// `generate.ts` and this file. For two callers the duplication is
// cheap. If a third emerges we should extract a shared
// `resolveRedTeamContext` helper.
// ============================================================

export interface RedTeamRunDeps {
  /** Provider id → adapter map. Same shape as `AttackGenerationDeps`. */
  adapters: Map<string, ProviderAdapter>;
}

export interface PerPluginRunResult {
  /** Attacks this plugin generated. Zero when generation itself failed. */
  attackCount: number;
  /** Verdicts produced (includes synthetic verdicts for failed attacks). */
  verdictCount: number;
  /** Count of attacks whose target call failed after retries. */
  executionErrors: number;
  /** Count of attacks whose grade() returned an error Result. */
  gradingErrors: number;
  /** Present only when generation (or an unhandled exception) killed the plugin. */
  error?: KindlmError;
}

export interface RedTeamRunResult {
  /** Aggregated vulnerability report ready for formatting. */
  report: RedTeamReport;
  /** Verdicts in plugin insertion order. */
  verdicts: AttackVerdict[];
  /** Per-plugin outcome keyed by the registry key `${id}#${index}`. */
  perPlugin: Map<string, PerPluginRunResult>;
  /**
   * Aggregate token usage across *target* calls only.
   *
   * Generation and grading calls still do not surface usage — that
   * would require signature changes to `generateAttacksForPlugin`
   * and `gradeAttackResponse` across S02/S03 and is out of scope
   * for S05. Downstream code should treat this as "target-only
   * usage" rather than "all red team token usage".
   */
  totalUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

/**
 * Internal per-plugin task outcome. Paired with the registry key so
 * the post-pool reducer can attribute results without rebuilding it.
 */
interface PluginTaskOutcome {
  pluginKey: string;
  /** Verdicts produced by this plugin (may be empty on generation failure). */
  verdicts: AttackVerdict[];
  attackCount: number;
  executionErrors: number;
  gradingErrors: number;
  /** Set when generation (or an unhandled exception) killed the plugin. */
  generationError?: KindlmError;
  /** Target-call usage accumulated inside the task. */
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

/**
 * Run the full red team pipeline: generate → execute → grade → report.
 *
 * Returns `ok(result)` as long as at least one plugin produced verdicts.
 * Per-plugin errors are visible in `result.perPlugin[key].error`.
 * Returns `err(...)` only when the config is invalid, the target
 * model/adapter lookup fails, or every plugin fails during generation.
 */
export async function runRedTeam(
  config: KindLMConfig,
  deps: RedTeamRunDeps,
): Promise<Result<RedTeamRunResult, KindlmError>> {
  // ----------------------------------------------------------
  // 1. Guard: redteam block must exist
  // ----------------------------------------------------------
  if (!config.redteam) {
    return err({
      code: "CONFIG_VALIDATION_ERROR",
      message: "No redteam: block in config",
    });
  }
  const redteam = config.redteam;

  // ----------------------------------------------------------
  // 2. Build plugin registry
  // ----------------------------------------------------------
  const pluginConfigs: RedTeamPluginConfigInput[] = redteam.plugins.map(
    (entry) => ({
      id: entry.id,
      severity: entry.severity,
      config: entry.config,
    }),
  );
  const registryResult = createRedTeamPluginRegistry(pluginConfigs);
  if (!registryResult.success) {
    return err(registryResult.error);
  }
  const registry = registryResult.data;

  // ----------------------------------------------------------
  // 3. Resolve target model + adapter.
  //    We also capture the target's `params` block so target calls
  //    use production-grade settings (temperature, maxTokens, ...).
  //    We do NOT override to temperature: 0 — red teaming should
  //    exercise the target exactly as users do.
  // ----------------------------------------------------------
  const targetModelConfig = config.models.find(
    (m) => m.id === redteam.target.model,
  );
  if (!targetModelConfig) {
    return err({
      code: "INTERNAL_ERROR",
      message: `Red team target model '${redteam.target.model}' not found in config.models`,
    });
  }
  const targetAdapter = deps.adapters.get(targetModelConfig.provider);
  if (!targetAdapter) {
    return err({
      code: "INTERNAL_ERROR",
      message: `No provider adapter registered for '${targetModelConfig.provider}' (required by red team target '${redteam.target.model}')`,
    });
  }

  // ----------------------------------------------------------
  // 4. Resolve judge adapter (optional).
  // ----------------------------------------------------------
  let judgeAdapter: ProviderAdapter | undefined;
  const judgeModelId = redteam.judge?.model;
  if (judgeModelId !== undefined) {
    const judgeModelConfig = config.models.find((m) => m.id === judgeModelId);
    if (!judgeModelConfig) {
      return err({
        code: "INTERNAL_ERROR",
        message: `Red team judge model '${judgeModelId}' not found in config.models`,
      });
    }
    judgeAdapter = deps.adapters.get(judgeModelConfig.provider);
    if (!judgeAdapter) {
      return err({
        code: "INTERNAL_ERROR",
        message: `No provider adapter registered for '${judgeModelConfig.provider}' (required by red team judge '${judgeModelId}')`,
      });
    }
  }

  // ----------------------------------------------------------
  // 5. Build per-plugin tasks.
  // ----------------------------------------------------------
  const registryEntries = Array.from(registry.entries());
  const tasks: (() => Promise<PluginTaskOutcome>)[] = registryEntries.map(
    ([pluginKey, plugin], entryIndex) => {
      const configEntry = redteam.plugins[entryIndex];
      if (!configEntry) {
        // Structurally impossible — registry is 1:1 with redteam.plugins.
        // Guard so a future registry change surfaces loudly.
        return async () => ({
          pluginKey,
          verdicts: [],
          attackCount: 0,
          executionErrors: 0,
          gradingErrors: 0,
          generationError: {
            code: "INTERNAL_ERROR",
            message: `Plugin registry/config index mismatch at ${entryIndex}`,
          },
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        });
      }

      const pluginCtx: RedTeamPluginContext = {
        purpose: redteam.purpose,
        targetModel: redteam.target.model,
        targetPrompt: redteam.target.prompt,
        targetAdapter,
        judgeAdapter,
        judgeModel: redteam.judge?.model,
        betaJudge: redteam.judge?.betaJudge,
        pluginConfig: configEntry.config,
        numTests: configEntry.numTests,
        severity: resolveSeverity(plugin, configEntry.severity),
      };

      return async () => {
        try {
          return await runPluginTask({
            pluginKey,
            plugin,
            pluginCtx,
            targetAdapter,
            targetModelId: targetModelConfig.model,
            targetParams: targetModelConfig.params,
            targetSystemPrompt: redteam.target.prompt,
          });
        } catch (error: unknown) {
          // `generateAttacksForPlugin`, `targetAdapter.complete`, and
          // `plugin.grade` all wrap their expected failures in
          // `Result` or synthetic verdicts. Reaching this branch
          // means something exotic escaped — record it as a
          // plugin-level failure rather than tearing down the pool.
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            pluginKey,
            verdicts: [],
            attackCount: 0,
            executionErrors: 0,
            gradingErrors: 0,
            generationError: {
              code: "REDTEAM_PLUGIN_ERROR",
              message: `Unhandled error in plugin '${plugin.id}': ${message}`,
              details: { pluginId: plugin.id, phase: "run" },
              cause: error instanceof Error ? error : undefined,
            },
            usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          };
        }
      };
    },
  );

  // ----------------------------------------------------------
  // 6. Dispatch through the concurrency pool.
  // ----------------------------------------------------------
  const outcomes = await runWithConcurrency(
    tasks,
    redteam.strategy.concurrency,
  );

  // ----------------------------------------------------------
  // 7. Roll up per-plugin outcomes into a flat verdict list plus a
  //    `perPlugin` map, mirroring generate.ts.
  // ----------------------------------------------------------
  const verdicts: AttackVerdict[] = [];
  const perPlugin = new Map<string, PerPluginRunResult>();
  const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let anySucceeded = false;

  for (const outcome of outcomes) {
    if (outcome.generationError) {
      perPlugin.set(outcome.pluginKey, {
        attackCount: 0,
        verdictCount: 0,
        executionErrors: 0,
        gradingErrors: 0,
        error: outcome.generationError,
      });
      continue;
    }

    verdicts.push(...outcome.verdicts);
    perPlugin.set(outcome.pluginKey, {
      attackCount: outcome.attackCount,
      verdictCount: outcome.verdicts.length,
      executionErrors: outcome.executionErrors,
      gradingErrors: outcome.gradingErrors,
    });
    totalUsage.inputTokens += outcome.usage.inputTokens;
    totalUsage.outputTokens += outcome.usage.outputTokens;
    totalUsage.totalTokens += outcome.usage.totalTokens;
    anySucceeded = true;
  }

  // ----------------------------------------------------------
  // 8. All-fail → aggregate error. Partial-or-better → ok.
  // ----------------------------------------------------------
  if (!anySucceeded) {
    return err({
      code: "REDTEAM_PLUGIN_ERROR",
      message: "All plugins failed during red team run",
      details: { perPlugin: Object.fromEntries(perPlugin) },
    });
  }

  // ----------------------------------------------------------
  // 9. Build the report from graded verdicts.
  // ----------------------------------------------------------
  const report = buildRedTeamReport(verdicts, redteam.gates);

  return ok({
    report,
    verdicts,
    perPlugin,
    totalUsage,
  });
}

// ============================================================
// Per-plugin task — new in S05
// ============================================================
//
// Extends S02's generation step with execute+grade per attack.
// Individual attack failures become *synthetic failed verdicts*
// instead of aborting the plugin, so a single transient error
// never hides a whole plugin's worth of probes.
//
// Generation failure is still plugin-level: if the plugin can't
// produce attacks, there is nothing to execute or grade, and the
// plugin contributes zero verdicts + a `generationError`.
// ============================================================

interface RunPluginTaskParams {
  pluginKey: string;
  plugin: RedTeamPlugin;
  pluginCtx: RedTeamPluginContext;
  targetAdapter: ProviderAdapter;
  targetModelId: string;
  targetParams: ProviderRequest["params"];
  targetSystemPrompt: string | undefined;
}

async function runPluginTask(
  params: RunPluginTaskParams,
): Promise<PluginTaskOutcome> {
  const {
    pluginKey,
    plugin,
    pluginCtx,
    targetAdapter,
    targetModelId,
    targetParams,
    targetSystemPrompt,
  } = params;

  // ----------------------------------------------------------
  // 1. Generate attacks for this plugin.
  // ----------------------------------------------------------
  const genResult = await generateAttacksForPlugin(plugin, pluginCtx);
  if (!genResult.success) {
    return {
      pluginKey,
      verdicts: [],
      attackCount: 0,
      executionErrors: 0,
      gradingErrors: 0,
      generationError: genResult.error,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }
  const attacks = genResult.data;

  // ----------------------------------------------------------
  // 2. Execute + grade each attack.
  //
  // We deliberately do this sequentially within a plugin. The
  // outer pool already parallelizes across plugins; per-attack
  // parallelism inside one plugin would need its own sub-pool
  // and complicates rate-limit semantics. If per-attack parallelism
  // becomes a bottleneck we can revisit.
  // ----------------------------------------------------------
  const verdicts: AttackVerdict[] = [];
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
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

    // 2a. Execute against target (with retry for transient errors).
    let response: ProviderResponse;
    try {
      response = await withRetry(
        () =>
          targetAdapter.complete({
            model: targetModelId,
            messages,
            params: targetParams,
          }),
        {
          maxRetries: 2,
          shouldRetry: (e: unknown) =>
            e instanceof ProviderError && e.retryable,
        },
      );
    } catch (error: unknown) {
      executionErrors += 1;
      const message = error instanceof Error ? error.message : String(error);
      verdicts.push(syntheticFailureVerdict(attack, `Target adapter call failed: ${message}`));
      continue;
    }

    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;
    usage.totalTokens += response.usage.totalTokens;

    // 2b. Grade the response.
    const gradeResult = await plugin.grade(attack, response.text, pluginCtx);
    if (!gradeResult.success) {
      gradingErrors += 1;
      verdicts.push(
        syntheticFailureVerdict(attack, `Grading failed: ${gradeResult.error.message}`),
      );
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
    usage,
  };
}

/**
 * Build a synthetic failed verdict for an attack that could not be
 * executed or graded. Synthetic verdicts let the report show every
 * requested probe (no missing rows) while still flagging the failure
 * as an exploited attack — the target "failed" to handle it.
 */
function syntheticFailureVerdict(
  attack: Attack,
  reason: string,
): AttackVerdict {
  return {
    attack,
    passed: false,
    score: 0,
    reason,
    details: { synthetic: true },
  };
}
