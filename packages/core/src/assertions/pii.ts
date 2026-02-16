import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface PiiAssertionConfig {
  denyPatterns: string[];
  customPatterns?: Array<{ name: string; pattern: string }>;
}

const MAX_PII_MATCHES = 1000;
const REGEX_TIMEOUT_MS = 100;

function redact(match: string): string {
  if (match.length <= 4) return "*".repeat(match.length);
  return match.slice(0, 2) + "*".repeat(match.length - 4) + match.slice(-2);
}

const NESTED_QUANTIFIER_RE = /(\+|\*|\{[^}]+\})\)?(\+|\*|\{[^}]+\})/;

export function hasNestedQuantifiers(pattern: string): boolean {
  return NESTED_QUANTIFIER_RE.test(pattern);
}

function safeRegexExec(
  regex: RegExp,
  text: string,
  maxMatches: number,
): string[] {
  const results: string[] = [];
  const start = Date.now();
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    results.push(m[0]);
    if (results.length >= maxMatches) break;
    if (Date.now() - start > REGEX_TIMEOUT_MS) break;
  }
  return results;
}

export function createPiiAssertion(config: PiiAssertionConfig): Assertion {
  return {
    type: "pii",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const allPatterns: Array<{ name: string; regex: RegExp }> = [];

      for (let i = 0; i < config.denyPatterns.length; i++) {
        const pattern = config.denyPatterns[i];
        if (pattern === undefined) continue;
        allPatterns.push({
          name: `pii-pattern-${i + 1}`,
          regex: new RegExp(pattern, "gi"),
        });
      }

      if (config.customPatterns) {
        for (const cp of config.customPatterns) {
          if (hasNestedQuantifiers(cp.pattern)) {
            return Promise.resolve([
              {
                assertionType: "pii",
                label: "No PII detected",
                passed: false,
                score: 0,
                failureCode: "INVALID_PATTERN",
                failureMessage: `Custom pattern "${cp.name}" contains nested quantifiers and may cause catastrophic backtracking`,
              },
            ]);
          }
          allPatterns.push({
            name: cp.name,
            regex: new RegExp(cp.pattern, "gi"),
          });
        }
      }

      const matches: Array<{ name: string; redacted: string }> = [];
      let totalMatches = 0;

      for (const { name, regex } of allPatterns) {
        if (totalMatches >= MAX_PII_MATCHES) break;
        const remaining = MAX_PII_MATCHES - totalMatches;
        const found = safeRegexExec(regex, context.outputText, remaining);
        for (const m of found) {
          matches.push({ name, redacted: redact(m) });
        }
        totalMatches += found.length;
      }

      const passed = matches.length === 0;
      return Promise.resolve([
        {
          assertionType: "pii",
          label: "No PII detected",
          passed,
          score: passed ? 1 : 0,
          failureCode: passed ? undefined : "PII_DETECTED",
          failureMessage: passed
            ? undefined
            : `Found ${matches.length} PII match(es): ${matches.map((m) => `${m.name}=${m.redacted}`).join(", ")}`,
          metadata: passed ? undefined : { matches },
        },
      ]);
    },
  };
}
