import type { RedTeamPlugin } from "../plugins/interface.js";
import type { Attack, AttackVerdict, RedTeamPluginContext } from "../types.js";
import type { Result, KindlmError } from "../../types/result.js";
import type { ProviderAdapter, ProviderMessage } from "../../types/provider.js";
import { ok, err } from "../../types/result.js";
import { ProviderError } from "../../types/provider.js";
import { withRetry } from "../../providers/retry.js";
import { buildGradeSystemPrompt, buildGradeUserPrompt } from "./prompts.js";

// ============================================================
// Grading engine — shared by all 9 built-in plugins
// ============================================================
//
// This is the single delegate every plugin's `grade` method forwards to.
// Mirrors generateAttacksForPlugin in structure: adapter selection,
// model selection, message construction, retry-wrapped provider call,
// parse + validate, return structured result.
//
// Temperature 0.2 (vs 0.9 for generation) — grading needs determinism,
// not diversity. The judge should reliably reach the same verdict on the
// same input.
//
// All failure paths carry a `phase` discriminator (`adapter_call` or
// `parse`) in `details` so CLI callers can report root cause without
// string-matching on the message.
// ============================================================

const GRADE_TEMPERATURE = 0.2;
const GRADE_MAX_TOKENS = 256;
const RAW_PREVIEW_MAX_CHARS = 500;

/**
 * Grade a single attack response using an LLM-as-judge.
 *
 * Every built-in plugin delegates here so grading logic stays in one place.
 * The function is NOT exported from `redteam/index.ts` — it is internal
 * infrastructure; only `plugin.grade()` is part of the public surface.
 */
export async function gradeAttackResponse(
  plugin: RedTeamPlugin,
  attack: Attack,
  outputText: string,
  context: RedTeamPluginContext,
): Promise<Result<AttackVerdict, KindlmError>> {
  // ----------------------------------------------------------
  // 1. Select grader adapter
  // ----------------------------------------------------------
  // Prefer judgeAdapter — typically a stronger/safer model. Fall back
  // to targetAdapter so configs without a judge still work.
  const grader: ProviderAdapter | undefined =
    context.judgeAdapter ?? context.targetAdapter;

  if (!grader) {
    return err({
      code: "INTERNAL_ERROR",
      message:
        "No adapter available for grading (need judgeAdapter or targetAdapter)",
      details: { pluginId: plugin.id },
    });
  }

  // ----------------------------------------------------------
  // 2. Select model
  // ----------------------------------------------------------
  const model =
    context.judgeAdapter !== undefined && context.judgeModel !== undefined
      ? context.judgeModel
      : context.targetModel;

  // ----------------------------------------------------------
  // 3. Build messages
  // ----------------------------------------------------------
  const systemPrompt = buildGradeSystemPrompt(plugin.id);
  const userPrompt = buildGradeUserPrompt(attack, outputText, context.pluginConfig);
  const messages: ProviderMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // ----------------------------------------------------------
  // 4. Call provider (with retry for transient failures)
  // ----------------------------------------------------------
  let responseText: string;
  try {
    const response = await withRetry(
      () =>
        grader.complete({
          model,
          messages,
          params: {
            temperature: GRADE_TEMPERATURE,
            maxTokens: GRADE_MAX_TOKENS,
          },
        }),
      {
        maxRetries: 2,
        shouldRetry: (e: unknown) =>
          e instanceof ProviderError && e.retryable,
      },
    );
    responseText = response.text;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return err({
      code: "REDTEAM_PLUGIN_ERROR",
      message: `Grading provider call failed: ${message}`,
      details: {
        pluginId: plugin.id,
        phase: "adapter_call",
      },
      cause: error instanceof Error ? error : undefined,
    });
  }

  // ----------------------------------------------------------
  // 5. Parse grading response
  // ----------------------------------------------------------
  // Accept fenced JSON (```json{...}```) or bare JSON. The judge prompt
  // asks for bare JSON but models sometimes wrap it in a code fence.
  let parsed: unknown;
  try {
    const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? (fenced[1] ?? "").trim() : responseText.trim();
    parsed = JSON.parse(candidate);
  } catch {
    return err({
      code: "REDTEAM_PLUGIN_ERROR",
      message: "Failed to parse grading response",
      details: {
        pluginId: plugin.id,
        phase: "parse",
        raw: responseText.slice(0, RAW_PREVIEW_MAX_CHARS),
      },
    });
  }

  // Validate the parsed shape — a structurally invalid object from the
  // judge is treated as a parse failure.
  if (
    typeof (parsed as Record<string, unknown>).passed !== "boolean" ||
    typeof (parsed as Record<string, unknown>).score !== "number" ||
    typeof (parsed as Record<string, unknown>).reason !== "string"
  ) {
    return err({
      code: "REDTEAM_PLUGIN_ERROR",
      message: "Failed to parse grading response",
      details: {
        pluginId: plugin.id,
        phase: "parse",
        raw: responseText.slice(0, RAW_PREVIEW_MAX_CHARS),
      },
    });
  }

  const result = parsed as { passed: boolean; score: number; reason: string };

  // ----------------------------------------------------------
  // 6. Return verdict
  // ----------------------------------------------------------
  return ok({
    attack,
    passed: result.passed,
    score: result.score,
    reason: result.reason,
  });
}
