import type { KindLMConfig } from "../../config/schema.js";
import type { Result, KindlmError } from "../../types/result.js";
import type { ProviderAdapter } from "../../types/provider.js";
import type { Attack, RedTeamPluginContext } from "../types.js";
import { ok, err } from "../../types/result.js";
import { runWithConcurrency } from "../../engine/concurrency.js";
import {
  createRedTeamPluginRegistry,
  resolveSeverity,
  type RedTeamPluginConfigInput,
} from "../plugins/registry.js";
import { generateAttacksForPlugin } from "../generation/generate.js";

// ============================================================
// Red Team Attack Generation Engine (S02 - internal aggregator)
// ============================================================
//
// `runAttackGeneration` is the S02 entry point that stitches together
// everything the earlier tasks built:
//
//   * T01 — per-plugin attacker prompts + JSON parser
//   * T02 — `generateAttacksForPlugin` shared inner loop
//   * T03 — this file: the outer orchestrator that builds contexts,
//           runs plugins through a concurrency pool, and rolls up
//           partial-success semantics
//
// It consumes a validated `KindLMConfig` plus an adapters map (the same
// shape the main runner uses), resolves the target/judge adapters by
// provider id, builds a `RedTeamPluginContext` per plugin entry, and
// dispatches the work through the lifted `runWithConcurrency` helper.
//
// Partial-success semantics (the whole point of this layer): if *any*
// plugin succeeds, we return `ok(...)` carrying the successful attacks
// plus a `perPlugin` map whose entries record per-plugin counts and
// errors. Only if *every* plugin fails do we return an aggregate
// `REDTEAM_PLUGIN_ERROR`. This lets the CLI (T04/T05) report mixed
// outcomes without needing a second retry loop.
//
// Usage tracking is deliberately stubbed in S02 — the T02 inner loop
// does not surface `ProviderResponse.usage`, and wiring that through
// the return type would bloat this slice. S05 will add real usage
// aggregation when `kindlm redteam run` needs to enforce cost gates.
// For now we return a zero-filled `totalUsage` and document the TODO.
// ============================================================

export interface AttackGenerationDeps {
  /** Provider id → adapter map. Keys match `ModelConfig.provider` values. */
  adapters: Map<string, ProviderAdapter>;
}

export interface PerPluginGenerationResult {
  /** Number of attacks this plugin emitted. Zero when the plugin failed. */
  attackCount: number;
  /** Present only when the plugin failed. */
  error?: KindlmError;
}

export interface AttackGenerationResult {
  /**
   * All attacks successfully generated across every plugin, in plugin
   * insertion order. Failed plugins contribute nothing here; their
   * errors live in `perPlugin`.
   */
  attacks: Attack[];
  /**
   * Per-plugin outcome keyed by the same `${id}#${index}` key the
   * registry uses. Every plugin that was attempted has an entry,
   * success or failure.
   */
  perPlugin: Map<string, PerPluginGenerationResult>;
  /**
   * Aggregate token usage across all attacker calls.
   *
   * S02 limitation: `generateAttacksForPlugin` does not currently
   * surface `ProviderResponse.usage`, so this is zero-filled. S05 will
   * wire real usage tracking when `kindlm redteam run` needs cost
   * gates. Downstream code should treat a zero `totalUsage` as
   * "unknown" rather than "free".
   */
  totalUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
}

/**
 * Aggregator result for a single plugin task — internal to the
 * concurrency pool. We pair the registry key with the inner `Result`
 * so the post-pool reducer can attribute successes and failures
 * without having to rebuild the key.
 */
interface PluginTaskOutcome {
  pluginKey: string;
  result: Result<Attack[], KindlmError>;
}

/**
 * Run attack generation across every configured red team plugin.
 *
 * Returns `ok(result)` as long as at least one plugin produced attacks.
 * Per-plugin failures are visible in `result.perPlugin[key].error`.
 * Returns `err(...)` only when the config is invalid, the target
 * model/adapter lookup fails, or every plugin fails.
 */
export async function runAttackGeneration(
  config: KindLMConfig,
  deps: AttackGenerationDeps,
): Promise<Result<AttackGenerationResult, KindlmError>> {
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
  // 2. Build plugin registry (surfaces CONFIG_VALIDATION_ERROR
  //    verbatim on unknown plugin ids or bad plugin configs).
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
  // 3. Resolve target adapter by looking up the target model in
  //    `config.models`, then the model's provider in `deps.adapters`.
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
  // 4. Resolve judge adapter (optional). Note: the judge adapter's
  //    absence is not an error — `generateAttacksForPlugin` falls
  //    back to the target adapter in that case.
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
  //
  // We walk the registry in insertion order so results stay
  // deterministic. The registry key `${id}#${index}` matches the
  // entry's position in `redteam.plugins`, so we index-align the
  // two lists to read back the per-entry `numTests` and config.
  // ----------------------------------------------------------
  const registryEntries = Array.from(registry.entries());
  const tasks: (() => Promise<PluginTaskOutcome>)[] = registryEntries.map(
    ([pluginKey, plugin], entryIndex) => {
      const configEntry = redteam.plugins[entryIndex];
      if (!configEntry) {
        // This is structurally impossible: the registry is built 1:1
        // from `redteam.plugins`, so the index must line up. Guard
        // anyway so a future registry change surfaces loudly.
        return async () => ({
          pluginKey,
          result: err({
            code: "INTERNAL_ERROR",
            message: `Plugin registry/config index mismatch at ${entryIndex}`,
          }) as Result<Attack[], KindlmError>,
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
          const result = await generateAttacksForPlugin(plugin, pluginCtx);
          return { pluginKey, result };
        } catch (error: unknown) {
          // `generateAttacksForPlugin` already wraps every expected
          // failure into a `Result`, so reaching this branch means
          // something exotic escaped — we still want to record it as
          // a per-plugin failure rather than tearing down the whole
          // pool (partial-success semantics).
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            pluginKey,
            result: err({
              code: "REDTEAM_PLUGIN_ERROR",
              message: `Unhandled error in plugin '${plugin.id}': ${message}`,
              details: { pluginId: plugin.id, phase: "adapter_call" },
              cause: error instanceof Error ? error : undefined,
            }) as Result<Attack[], KindlmError>,
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
  // 7. Roll up results.
  // ----------------------------------------------------------
  const attacks: Attack[] = [];
  const perPlugin = new Map<string, PerPluginGenerationResult>();
  let anySucceeded = false;

  for (const outcome of outcomes) {
    if (outcome.result.success) {
      attacks.push(...outcome.result.data);
      perPlugin.set(outcome.pluginKey, {
        attackCount: outcome.result.data.length,
      });
      anySucceeded = true;
    } else {
      perPlugin.set(outcome.pluginKey, {
        attackCount: 0,
        error: outcome.result.error,
      });
    }
  }

  // ----------------------------------------------------------
  // 8. All-fail → aggregate error. Partial-or-better → ok.
  // ----------------------------------------------------------
  if (!anySucceeded) {
    return err({
      code: "REDTEAM_PLUGIN_ERROR",
      message: "All plugins failed during attack generation",
      details: { perPlugin: Object.fromEntries(perPlugin) },
    });
  }

  return ok({
    attacks,
    perPlugin,
    // S02 stub — see PerPluginGenerationResult doc comment.
    // TODO(S05): wire real usage from ProviderResponse.usage.
    totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  });
}
