import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface PiiAssertionConfig {
  denyPatterns: string[];
  customPatterns?: Array<{ name: string; pattern: string }>;
}

const MAX_PII_MATCHES = 1000;
const REGEX_TIMEOUT_MS = 100;
const EVALUATION_TIMEOUT_MS = 500;

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
  // Reset lastIndex for global regexes reused across evaluations
  regex.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    results.push(m[0]);
    if (results.length >= maxMatches) break;
    if (Date.now() - start > REGEX_TIMEOUT_MS) break;
  }
  return results;
}

export function createPiiAssertion(config: PiiAssertionConfig): Assertion {
  // Pre-compile all regexes once at assertion creation time
  const compiledPatterns: Array<{ name: string; regex: RegExp }> = [];
  let compilationError: AssertionResult[] | undefined;

  for (let i = 0; i < config.denyPatterns.length; i++) {
    const pattern = config.denyPatterns[i];
    if (pattern === undefined) continue;
    if (hasNestedQuantifiers(pattern)) {
      compilationError = [
        {
          assertionType: "pii",
          label: "No PII detected",
          passed: false,
          score: 0,
          failureCode: "INVALID_PATTERN",
          failureMessage: `Deny pattern "pii-pattern-${i + 1}" contains nested quantifiers and may cause catastrophic backtracking`,
        },
      ];
      break;
    }
    compiledPatterns.push({
      name: `pii-pattern-${i + 1}`,
      regex: new RegExp(pattern, "gi"),
    });
  }

  if (config.customPatterns) {
    for (const cp of config.customPatterns) {
      if (hasNestedQuantifiers(cp.pattern)) {
        compilationError = [
          {
            assertionType: "pii",
            label: "No PII detected",
            passed: false,
            score: 0,
            failureCode: "INVALID_PATTERN",
            failureMessage: `Custom pattern "${cp.name}" contains nested quantifiers and may cause catastrophic backtracking`,
          },
        ];
        break;
      }
      compiledPatterns.push({
        name: cp.name,
        regex: new RegExp(cp.pattern, "gi"),
      });
    }
  }

  return {
    type: "pii",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      if (compilationError) {
        return Promise.resolve(compilationError);
      }

      const matches: Array<{ name: string; redacted: string }> = [];
      let totalMatches = 0;
      const evalStart = Date.now();

      for (const { name, regex } of compiledPatterns) {
        if (totalMatches >= MAX_PII_MATCHES) break;
        if (Date.now() - evalStart > EVALUATION_TIMEOUT_MS) break;
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
