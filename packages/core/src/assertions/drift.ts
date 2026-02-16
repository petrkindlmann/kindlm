import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface DriftAssertionConfig {
  maxScore: number;
  method: "judge" | "embedding" | "field-diff";
  fields?: string[];
}

export function createDriftAssertion(config: DriftAssertionConfig): Assertion {
  return {
    type: "drift",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void config;
      throw new Error("Not implemented");
    },
  };
}
