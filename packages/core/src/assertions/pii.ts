import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface PiiAssertionConfig {
  denyPatterns: string[];
  customPatterns?: Array<{ name: string; pattern: string }>;
}

export function createPiiAssertion(config: PiiAssertionConfig): Assertion {
  return {
    type: "pii",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void config;
      throw new Error("Not implemented");
    },
  };
}
