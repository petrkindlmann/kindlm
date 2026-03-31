import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";
import { validateUnitIntervalScore } from "./shared-score.js";

export interface JudgeAssertionConfig {
  criteria: string;
  minScore: number;
  rubric?: string;
  model?: string;
}

// ============================================================
// Static Rubric (cacheable across evaluations)
// ============================================================
// This system prompt is identical for every judge invocation.
// Providers that support prompt caching (Anthropic, OpenAI) can
// cache this prefix to reduce latency and cost on repeated runs.
// ============================================================
const JUDGE_SYSTEM_PROMPT = `You are an impartial AI judge evaluating an AI assistant's response.
You will be given:
- The assistant's response
- Evaluation criteria
- An optional rubric

Score the response from 0.0 to 1.0 based on how well it meets the criteria.

Respond ONLY with a JSON object in this exact format:
{"score": <number between 0.0 and 1.0>, "reasoning": "<brief explanation>"}`;

// ============================================================
// Dynamic Evaluation Payload (changes per test case)
// ============================================================
// Contains the actual assistant response and evaluation criteria.
// This portion MUST NOT be cached — it varies per test invocation.
// ============================================================
function buildUserPrompt(
  outputText: string,
  criteria: string,
  rubric?: string,
): string {
  let prompt = `## Assistant Response\n${outputText}\n\n## Criteria\n${criteria}`;
  if (rubric) {
    prompt += `\n\n## Rubric\n${rubric}`;
  }
  return prompt;
}

type JudgeParseResult =
  | { ok: true; score: number; reasoning: string }
  | { ok: false; reason: string };

function parseJudgeResponse(text: string): JudgeParseResult {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch?.[1]) {
    return { ok: false, reason: "No JSON object found in judge response" };
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "Invalid JSON in judge response" };
  }
  const scoreResult = validateUnitIntervalScore(parsed.score, "score");
  if (!scoreResult.ok) {
    return { ok: false, reason: scoreResult.reason };
  }
  if (typeof parsed.reasoning !== "string") {
    return { ok: false, reason: "reasoning must be a string" };
  }
  return { ok: true, score: scoreResult.score, reasoning: parsed.reasoning };
}

export function createJudgeAssertion(config: JudgeAssertionConfig): Assertion {
  return {
    type: "judge",
    async evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      if (!context.judgeAdapter || !context.judgeModel) {
        return [
          {
            assertionType: "judge",
            label: `Judge: ${config.criteria}`,
            passed: false,
            score: 0,
            failureCode: "INTERNAL_ERROR",
            failureMessage:
              "Judge assertion requires judgeAdapter and judgeModel in context",
          },
        ];
      }

      let response;
      try {
        // ---- Static boundary: system message above is cacheable ----
        // ---- Dynamic payload: user message below changes per test ---
        response = await context.judgeAdapter.complete({
          model: config.model ?? context.judgeModel,
          messages: [
            { role: "system", content: JUDGE_SYSTEM_PROMPT },
            {
              role: "user",
              content: buildUserPrompt(
                context.outputText,
                config.criteria,
                config.rubric,
              ),
            },
          ],
          params: { temperature: 0, maxTokens: 512 },
        });
      } catch (e) {
        return [
          {
            assertionType: "judge",
            label: `Judge: ${config.criteria}`,
            passed: false,
            score: 0,
            failureCode: "JUDGE_EVAL_ERROR",
            failureMessage: `Judge adapter error: ${e instanceof Error ? e.message : String(e)}`,
          },
        ];
      }

      const parsed = parseJudgeResponse(response.text);
      if (!parsed.ok) {
        return [
          {
            assertionType: "judge",
            label: `Judge: ${config.criteria}`,
            passed: false,
            score: 0,
            failureCode: "JUDGE_PARSE_ERROR",
            failureMessage: `Failed to parse judge response: ${parsed.reason}`,
          },
        ];
      }

      const passed = parsed.score >= config.minScore;
      return [
        {
          assertionType: "judge",
          label: `Judge: ${config.criteria}`,
          passed,
          score: parsed.score,
          failureCode: passed ? undefined : "JUDGE_BELOW_THRESHOLD",
          failureMessage: passed
            ? undefined
            : `Score ${parsed.score} below threshold ${config.minScore}: ${parsed.reasoning}`,
          metadata: { reasoning: parsed.reasoning, threshold: config.minScore },
        },
      ];
    },
  };
}
