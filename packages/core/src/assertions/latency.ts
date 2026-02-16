import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface LatencyAssertionConfig {
  maxMs: number;
}

export function createLatencyAssertion(config: LatencyAssertionConfig): Assertion {
  return {
    type: "latency",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void config;
      throw new Error("Not implemented");
    },
  };
}
