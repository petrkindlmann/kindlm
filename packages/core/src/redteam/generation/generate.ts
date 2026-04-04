import type { RedTeamPlugin } from "../plugins/interface.js";
import type { Attack, RedTeamPluginContext } from "../types.js";
import type { Result, KindlmError } from "../../types/result.js";
import type {
  ProviderAdapter,
  ProviderMessage,
  ProviderResponse,
} from "../../types/provider.js";
import { ok, err } from "../../types/result.js";
import { ProviderError } from "../../types/provider.js";
import { withRetry } from "../../providers/retry.js";
import {
  buildAttackSystemPrompt,
  buildAttackUserPrompt,
} from "./prompts.js";
import { parseAttackJsonResponse } from "./parse.js";

// ============================================================
// Per-plugin attack generator
// ============================================================
//
// This is the single delegate every built-in plugin's `generate` method
// forwards to. Keeping the logic here (rather than inlined nine times)
// guarantees the adapter selection, retry policy, parse handling, and
// error mapping stay in lock-step across every plugin.
//
// High-level flow:
//   1. Select the attacker adapter (judgeAdapter preferred, falls back
//      to targetAdapter). If neither is available, return INTERNAL_ERROR
//      — this is a programmer error, not a runtime condition.
//   2. Build the system/user messages for the chosen plugin id.
//   3. Call `adapter.complete` inside `withRetry` so transient provider
//      failures get the same backoff treatment as normal test runs.
//   4. Parse the JSON array response through `parseAttackJsonResponse`.
//   5. Decorate each draft into a full `Attack` with pluginId, category,
//      severity, and the production system prompt (passed through so
//      S03 execution hits the target with its real system prompt).
//   6. Defensively slice to `numTests` and reject empty batches.
//
// All failure paths produce a `REDTEAM_PLUGIN_ERROR` with a `phase`
// discriminator in `details` so callers (T03 aggregator, CLI reporter)
// can distinguish adapter_call / parse / empty_batch without string
// matching on the message. `no_adapter` is the one exception and is
// returned as `INTERNAL_ERROR` because it can only happen if the engine
// wired a plugin up without supplying any adapter at all.
// ============================================================

/**
 * Maximum characters of raw provider text we embed in the error
 * `details.raw` field when parsing fails. The real response can be
 * arbitrarily long; we only want enough to debug the failure without
 * bloating log output.
 */
const RAW_PREVIEW_MAX_CHARS = 500;

/**
 * Temperature for attack generation. High enough that the attacker LLM
 * produces diverse angles across runs, not the same canned list.
 */
const ATTACK_GEN_TEMPERATURE = 0.9;

/**
 * Max tokens for a single attack batch. 2048 is enough for ~50 distinct
 * attack objects at realistic lengths, with headroom for JSON overhead.
 */
const ATTACK_GEN_MAX_TOKENS = 2048;

/**
 * Generate a batch of adversarial attack probes for a single plugin.
 *
 * This function is the only place per-plugin generation logic lives;
 * every `RedTeamPlugin.generate` implementation delegates here. Returns
 * a `Result` so callers never need to try/catch — all failure modes
 * (missing adapter, provider error, parse error, empty batch) come back
 * as structured `KindlmError` values with a stable `phase` discriminator
 * in `details`.
 */
export async function generateAttacksForPlugin(
  plugin: RedTeamPlugin,
  context: RedTeamPluginContext,
): Promise<Result<Attack[], KindlmError>> {
  // ----------------------------------------------------------
  // 1. Select attacker adapter
  // ----------------------------------------------------------
  // Prefer the judge adapter when the user has one configured — it is
  // usually a stronger/safer model than the target. Fall back to the
  // target adapter so configs without a judge still work (at the cost
  // of the target model generating prompts against itself, which is
  // acceptable for low-cost smoke testing).
  const attacker: ProviderAdapter | undefined =
    context.judgeAdapter ?? context.targetAdapter;

  if (!attacker) {
    return err({
      code: "INTERNAL_ERROR",
      message:
        "No adapter available for attack generation (need judgeAdapter or targetAdapter)",
      details: { pluginId: plugin.id },
    });
  }

  // Model id mirrors the adapter choice: judgeModel when using the
  // judge, otherwise targetModel. Callers that only supply a judge
  // adapter must also supply a judgeModel — we fall back to targetModel
  // as a safety net rather than throwing here.
  const model =
    context.judgeAdapter !== undefined && context.judgeModel !== undefined
      ? context.judgeModel
      : context.targetModel;

  // ----------------------------------------------------------
  // 2. Build messages
  // ----------------------------------------------------------
  const systemPrompt = buildAttackSystemPrompt(plugin.id);
  const userPrompt = buildAttackUserPrompt(context);
  const messages: ProviderMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // ----------------------------------------------------------
  // 3. Call provider (with retry for transient failures)
  // ----------------------------------------------------------
  let response: ProviderResponse;
  try {
    response = await withRetry(
      () =>
        attacker.complete({
          model,
          messages,
          params: {
            temperature: ATTACK_GEN_TEMPERATURE,
            maxTokens: ATTACK_GEN_MAX_TOKENS,
          },
        }),
      {
        maxRetries: 2,
        shouldRetry: (e: unknown) =>
          e instanceof ProviderError && e.retryable,
      },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    return err({
      code: "REDTEAM_PLUGIN_ERROR",
      message: `Attack generation provider call failed: ${message}`,
      details: {
        pluginId: plugin.id,
        phase: "adapter_call",
      },
      cause: error instanceof Error ? error : undefined,
    });
  }

  // ----------------------------------------------------------
  // 4. Parse JSON array response
  // ----------------------------------------------------------
  const parseResult = parseAttackJsonResponse(response.text, plugin.id);
  if (!parseResult.ok) {
    return err({
      code: "REDTEAM_PLUGIN_ERROR",
      message: `Failed to parse attack response: ${parseResult.reason}`,
      details: {
        pluginId: plugin.id,
        phase: parseResult.reason === "Empty attack batch" ? "empty_batch" : "parse",
        raw: response.text.slice(0, RAW_PREVIEW_MAX_CHARS),
      },
    });
  }

  // ----------------------------------------------------------
  // 5. Decorate drafts into Attacks
  // ----------------------------------------------------------
  // Each draft carries only `{label, prompt}`; we layer on the plugin
  // metadata and pass the production target system prompt through
  // untouched so S03 execution hits the target with its real system
  // prompt rather than an attacker-authored one.
  const decorated: Attack[] = parseResult.drafts.map((draft) => ({
    pluginId: plugin.id,
    category: plugin.category,
    severity: context.severity,
    label: draft.label,
    userPrompt: draft.prompt,
    systemPrompt: context.targetPrompt,
  }));

  // Defensive slice: the parser already rejects empty arrays, and the
  // attacker prompt asks for exactly `numTests`, but models sometimes
  // over-generate. Trim to the requested count so downstream callers
  // never have to worry about batch-size drift.
  const trimmed = decorated.slice(0, context.numTests);

  // ----------------------------------------------------------
  // 6. Reject empty post-trim (belt and suspenders — parser already
  //    rejects length 0, but a negative/zero numTests from an exotic
  //    caller would slice to nothing).
  // ----------------------------------------------------------
  if (trimmed.length === 0) {
    return err({
      code: "REDTEAM_PLUGIN_ERROR",
      message: "Empty attack batch",
      details: {
        pluginId: plugin.id,
        phase: "empty_batch",
      },
    });
  }

  return ok(trimmed);
}
