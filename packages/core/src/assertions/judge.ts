import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface JudgeAssertionConfig {
  criteria: string;
  minScore: number;
  rubric?: string;
}

const JUDGE_SYSTEM_PROMPT = `You are an impartial AI judge evaluating an AI assistant's response.
You will be given:
- The assistant's response
- Evaluation criteria
- An optional rubric

Score the response from 0.0 to 1.0 based on how well it meets the criteria.

Respond ONLY with a JSON object in this exact format:
{"score": <number between 0.0 and 1.0>, "reasoning": "<brief explanation>"}`;

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

function parseJudgeResponse(text: string): { score: number; reasoning: string } | null {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch?.[1]) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
    if (typeof parsed.score === "number" && typeof parsed.reasoning === "string") {
      return { score: parsed.score, reasoning: parsed.reasoning };
    }
    return null;
  } catch {
    return null;
  }
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

      const response = await context.judgeAdapter.complete({
        model: context.judgeModel,
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

      const parsed = parseJudgeResponse(response.text);
      if (!parsed) {
        return [
          {
            assertionType: "judge",
            label: `Judge: ${config.criteria}`,
            passed: false,
            score: 0,
            failureCode: "INTERNAL_ERROR",
            failureMessage: `Failed to parse judge response: ${response.text.slice(0, 200)}`,
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
          metadata: { reasoning: parsed.reasoning },
        },
      ];
    },
  };
}
