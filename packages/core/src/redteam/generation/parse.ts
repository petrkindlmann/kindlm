import { z } from "zod";

// ============================================================
// Attack draft — the raw element shape the attacker LLM returns
// ============================================================
//
// A "draft" is the minimal `{ label, prompt }` pair the attacker model
// is asked to produce. The aggregator in `generate.ts` (T02) decorates
// each draft with `pluginId`, `category`, `severity`, and
// `systemPrompt` to produce a full `Attack`. Keeping the draft shape
// narrow lets us validate the LLM's output in isolation without
// polluting the runtime `Attack` type.

const AttackDraftSchema = z.object({
  label: z.string().min(1),
  prompt: z.string().min(1),
});

export type AttackDraft = z.infer<typeof AttackDraftSchema>;

// Discriminated union so callers can `if (result.ok)` without throwing.
export type AttackParseResult =
  | { ok: true; drafts: AttackDraft[] }
  | { ok: false; reason: string };

// ============================================================
// Response parser
// ============================================================

/**
 * Extract and validate the JSON array of attack drafts from a raw LLM
 * response.
 *
 * The attacker prompt instructs the model to emit a bare JSON array,
 * but models frequently wrap their output in markdown fences or
 * preamble. This parser mirrors the same lenient extraction the judge
 * assertion uses:
 *
 *   1. Prefer a ```json fenced block if present.
 *   2. Fall back to the first `[ ... ]` that appears in the text.
 *   3. `JSON.parse` the capture.
 *   4. Validate each element with Zod — first failure short-circuits
 *      with a structured reason.
 *   5. Empty arrays are rejected with `'Empty attack batch'` so
 *      downstream callers can map it to `REDTEAM_PLUGIN_ERROR`.
 *
 * Never throws. All failures come back as `{ ok: false, reason }` so
 * the caller can decide how to surface them.
 *
 * @param text The raw text returned by the attacker LLM.
 * @param pluginId The plugin id — currently only used to scope error
 *   messages, but reserved so we can specialize extraction per plugin
 *   later without a signature change.
 */
export function parseAttackJsonResponse(
  text: string,
  // pluginId is accepted for future per-plugin extraction tweaks; the
  // current implementation is plugin-agnostic.
  _pluginId: string,
): AttackParseResult {
  const arrayText = extractFirstJsonArray(text);
  if (arrayText === undefined) {
    return { ok: false, reason: "No JSON array found in attack response" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(arrayText);
  } catch {
    return { ok: false, reason: "Invalid JSON in attack response" };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      reason: "Attack response JSON is not an array",
    };
  }

  if (parsed.length === 0) {
    return { ok: false, reason: "Empty attack batch" };
  }

  const drafts: AttackDraft[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const candidate = parsed[i];
    const result = AttackDraftSchema.safeParse(candidate);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const issueMessage = firstIssue
        ? firstIssue.message
        : "invalid shape";
      return {
        ok: false,
        reason: `Attack draft ${i}: ${issueMessage}`,
      };
    }
    drafts.push(result.data);
  }

  return { ok: true, drafts };
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Extract the first JSON array from a raw LLM response.
 *
 * Mirrors `parseJudgeResponse` in `assertions/judge.ts`: prefer a
 * fenced code block when present, otherwise fall back to the first
 * `[ ... ]` span in the text. The fence matcher ignores the language
 * tag so both ```json and bare ``` wrappers work.
 *
 * Returns the extracted substring (still JSON text, not parsed) or
 * `undefined` when no candidate array shape is found.
 */
function extractFirstJsonArray(text: string): string | undefined {
  // Fenced block (with or without `json` language tag). Non-greedy so
  // we stop at the first closing fence.
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch?.[1]) {
    const inner = fencedMatch[1].trim();
    // Only accept the fenced content when it actually looks like an
    // array — otherwise fall through to the bracket scan.
    if (inner.startsWith("[")) {
      return inner;
    }
  }

  // Bare bracket fallback: greedy so we capture nested arrays too.
  const bracketMatch = text.match(/(\[[\s\S]*\])/);
  if (bracketMatch?.[1]) {
    return bracketMatch[1];
  }

  return undefined;
}
