import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export function createKeywordsPresentAssertion(keywords: string[]): Assertion {
  return {
    type: "keywords_present",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void keywords;
      throw new Error("Not implemented");
    },
  };
}

export function createKeywordsAbsentAssertion(keywords: string[]): Assertion {
  return {
    type: "keywords_absent",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void keywords;
      throw new Error("Not implemented");
    },
  };
}
