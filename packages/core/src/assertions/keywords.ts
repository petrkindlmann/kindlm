import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export function createKeywordsPresentAssertion(keywords: string[]): Assertion {
  return {
    type: "keywords_present",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const lower = context.outputText.toLowerCase();
      const found = keywords.some((kw) => lower.includes(kw.toLowerCase()));
      return Promise.resolve([
        {
          assertionType: "keywords_present",
          label: "Required keyword present",
          passed: found,
          score: found ? 1 : 0,
          failureCode: found ? undefined : "KEYWORD_MISSING",
          failureMessage: found
            ? undefined
            : `Expected at least one of [${keywords.join(", ")}] in output`,
        },
      ]);
    },
  };
}

export function createKeywordsAbsentAssertion(keywords: string[]): Assertion {
  return {
    type: "keywords_absent",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const lower = context.outputText.toLowerCase();
      const results: AssertionResult[] = [];

      for (const keyword of keywords) {
        const found = lower.includes(keyword.toLowerCase());
        results.push({
          assertionType: "keywords_absent",
          label: `Keyword "${keyword}" absent`,
          passed: !found,
          score: found ? 0 : 1,
          failureCode: found ? "KEYWORD_DENIED" : undefined,
          failureMessage: found
            ? `Denied keyword "${keyword}" found in output`
            : undefined,
        });
      }

      return Promise.resolve(results);
    },
  };
}
