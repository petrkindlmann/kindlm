import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface LatencyAssertionConfig {
  maxMs: number;
}

export function createLatencyAssertion(config: LatencyAssertionConfig): Assertion {
  return {
    type: "latency",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const latencyMs = context.latencyMs ?? 0;
      const passed = latencyMs <= config.maxMs;
      return Promise.resolve([
        {
          assertionType: "latency",
          label: `Latency <= ${config.maxMs}ms`,
          passed,
          score: passed ? 1 : 0,
          failureCode: passed ? undefined : "PROVIDER_TIMEOUT",
          failureMessage: passed
            ? undefined
            : `Latency ${latencyMs}ms exceeds max ${config.maxMs}ms`,
          metadata: { latencyMs },
        },
      ]);
    },
  };
}
