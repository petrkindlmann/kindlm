import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface DriftAssertionConfig {
  maxScore: number;
  method: "judge" | "embedding" | "field-diff";
  fields?: string[];
}

const DRIFT_JUDGE_SYSTEM = `You are an impartial AI judge comparing two AI assistant responses.
You will be given a baseline response and a new response.
Evaluate how much the new response has drifted from the baseline.

Score from 0.0 to 1.0 where:
- 0.0 = responses are semantically identical
- 0.5 = moderate differences in tone, detail, or structure
- 1.0 = completely different meaning or contradictory

Respond ONLY with a JSON object in this exact format:
{"driftScore": <number between 0.0 and 1.0>, "reasoning": "<brief explanation>"}`;

function parseDriftResponse(text: string): { driftScore: number; reasoning: string } | null {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch?.[1]) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    if (typeof parsed.driftScore === "number" && typeof parsed.reasoning === "string") {
      return { driftScore: parsed.driftScore, reasoning: parsed.reasoning };
    }
    return null;
  } catch {
    return null;
  }
}

function getNestedField(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function fieldDiff(
  baselineText: string,
  outputText: string,
  fields: string[],
): { driftScore: number; mismatched: string[] } {
  let baselineObj: unknown;
  let outputObj: unknown;
  try {
    baselineObj = JSON.parse(baselineText);
    outputObj = JSON.parse(outputText);
  } catch {
    return { driftScore: 1, mismatched: ["(parse error)"] };
  }

  const mismatched: string[] = [];
  for (const field of fields) {
    const baseVal = getNestedField(baselineObj, field);
    const outVal = getNestedField(outputObj, field);
    if (JSON.stringify(baseVal) !== JSON.stringify(outVal)) {
      mismatched.push(field);
    }
  }
  const driftScore = fields.length > 0 ? mismatched.length / fields.length : 0;
  return { driftScore, mismatched };
}

export function createDriftAssertion(config: DriftAssertionConfig): Assertion {
  return {
    type: "drift",
    async evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      if (!context.baselineText) {
        return [
          {
            assertionType: "drift",
            label: "Drift check",
            passed: true,
            score: 1,
            metadata: { reason: "No baseline available" },
          },
        ];
      }

      if (config.method === "embedding") {
        return [
          {
            assertionType: "drift",
            label: "Drift check (embedding)",
            passed: true,
            score: 1,
            metadata: { reason: "Embedding method not yet implemented" },
          },
        ];
      }

      if (config.method === "field-diff") {
        const fields = config.fields ?? [];
        const { driftScore, mismatched } = fieldDiff(
          context.baselineText,
          context.outputText,
          fields,
        );
        const score = 1 - driftScore;
        const passed = driftScore <= config.maxScore;
        return [
          {
            assertionType: "drift",
            label: "Drift check (field-diff)",
            passed,
            score,
            failureCode: passed ? undefined : "DRIFT_EXCEEDED",
            failureMessage: passed
              ? undefined
              : `Drift score ${driftScore.toFixed(2)} exceeds max ${config.maxScore}. Mismatched: [${mismatched.join(", ")}]`,
            metadata: { driftScore, mismatched },
          },
        ];
      }

      // method === "judge"
      if (!context.judgeAdapter || !context.judgeModel) {
        return [
          {
            assertionType: "drift",
            label: "Drift check (judge)",
            passed: false,
            score: 0,
            failureCode: "INTERNAL_ERROR",
            failureMessage:
              "Drift judge method requires judgeAdapter and judgeModel in context",
          },
        ];
      }

      const response = await context.judgeAdapter.complete({
        model: context.judgeModel,
        messages: [
          { role: "system", content: DRIFT_JUDGE_SYSTEM },
          {
            role: "user",
            content: `## Baseline Response\n${context.baselineText}\n\n## New Response\n${context.outputText}`,
          },
        ],
        params: { temperature: 0, maxTokens: 512 },
      });

      const parsed = parseDriftResponse(response.text);
      if (!parsed) {
        return [
          {
            assertionType: "drift",
            label: "Drift check (judge)",
            passed: false,
            score: 0,
            failureCode: "INTERNAL_ERROR",
            failureMessage: `Failed to parse drift judge response: ${response.text.slice(0, 200)}`,
          },
        ];
      }

      const score = 1 - parsed.driftScore;
      const passed = parsed.driftScore <= config.maxScore;
      return [
        {
          assertionType: "drift",
          label: "Drift check (judge)",
          passed,
          score,
          failureCode: passed ? undefined : "DRIFT_EXCEEDED",
          failureMessage: passed
            ? undefined
            : `Drift score ${parsed.driftScore.toFixed(2)} exceeds max ${config.maxScore}: ${parsed.reasoning}`,
          metadata: { driftScore: parsed.driftScore, reasoning: parsed.reasoning },
        },
      ];
    },
  };
}
