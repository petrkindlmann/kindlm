import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface CostAssertionConfig {
  maxUsd: number;
}

export function createCostAssertion(config: CostAssertionConfig): Assertion {
  return {
    type: "cost",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const costUsd = context.costUsd ?? 0;
      const passed = costUsd <= config.maxUsd;
      return Promise.resolve([
        {
          assertionType: "cost",
          label: `Cost <= $${config.maxUsd}`,
          passed,
          score: passed ? 1 : 0,
          failureCode: passed ? undefined : "INTERNAL_ERROR",
          failureMessage: passed
            ? undefined
            : `Cost $${costUsd.toFixed(4)} exceeds max $${config.maxUsd}`,
          metadata: { costUsd },
        },
      ]);
    },
  };
}
