import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface CostAssertionConfig {
  maxUsd: number;
}

export function createCostAssertion(config: CostAssertionConfig): Assertion {
  return {
    type: "cost",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const costUsd = context.costUsd;

      // Unknown cost must NOT silently pass. Unpriced providers (Mistral,
      // Cohere, HTTP) and unpriced models report `undefined` here. Coercing
      // that to $0 would make any `maxUsd` gate trivially pass while the user
      // spends arbitrarily — worse than no gate, because it looks enforced.
      if (costUsd === undefined) {
        return Promise.resolve([
          {
            assertionType: "cost",
            label: `Cost <= $${config.maxUsd}`,
            passed: false,
            score: 0,
            failureCode: "COST_UNKNOWN",
            failureMessage: `Cost is unknown for this model (no pricing data), so the $${config.maxUsd} budget cannot be enforced. Use a priced provider/model or remove the cost gate.`,
            metadata: {},
          },
        ]);
      }

      const passed = costUsd <= config.maxUsd;
      return Promise.resolve([
        {
          assertionType: "cost",
          label: `Cost <= $${config.maxUsd}`,
          passed,
          score: passed ? 1 : 0,
          failureCode: passed ? undefined : "BUDGET_EXCEEDED",
          failureMessage: passed
            ? undefined
            : `Cost $${costUsd.toFixed(4)} exceeds max $${config.maxUsd}`,
          metadata: { costUsd },
        },
      ]);
    },
  };
}
