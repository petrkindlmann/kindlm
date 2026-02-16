import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface JudgeAssertionConfig {
  criteria: string;
  minScore: number;
  rubric?: string;
}

export function createJudgeAssertion(config: JudgeAssertionConfig): Assertion {
  return {
    type: "judge",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void config;
      throw new Error("Not implemented");
    },
  };
}
