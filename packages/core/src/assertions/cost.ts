import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface CostAssertionConfig {
  maxUsd: number;
}

export function createCostAssertion(config: CostAssertionConfig): Assertion {
  return {
    type: "cost",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void config;
      throw new Error("Not implemented");
    },
  };
}
