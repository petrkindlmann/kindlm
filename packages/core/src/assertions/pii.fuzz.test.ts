import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createPiiAssertion, hasNestedQuantifiers } from "./pii.js";
import type { AssertionContext } from "./interface.js";

function makeContext(text: string): AssertionContext {
  return {
    outputText: text,
    toolCalls: [],
    configDir: "/tmp",
  };
}

describe("createPiiAssertion — property-based fuzz tests", () => {
  it("random strings with embedded SSN patterns always return result array", () => {
    const ssnPattern = "\\b\\d{3}-\\d{2}-\\d{4}\\b";

    fc.assert(
      fc.asyncProperty(fc.string({ minLength: 0, maxLength: 5000 }), async (text) => {
        const assertion = createPiiAssertion({
          denyPatterns: [ssnPattern],
        });
        try {
          const results = await assertion.evaluate(makeContext(text));
          expect(Array.isArray(results)).toBe(true);
          expect(results.length).toBeGreaterThan(0);
          for (const r of results) {
            expect(r).toHaveProperty("assertionType", "pii");
            expect(r).toHaveProperty("passed");
            expect(typeof r.passed).toBe("boolean");
          }
        } catch (e: unknown) {
          expect.unreachable(
            `PII assertion threw: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }),
      { numRuns: 300 },
    );
  });

  it("random strings with embedded CC patterns always return result array", () => {
    const ccPattern = "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b";

    fc.assert(
      fc.asyncProperty(fc.string({ minLength: 0, maxLength: 5000 }), async (text) => {
        const assertion = createPiiAssertion({
          denyPatterns: [ccPattern],
        });
        try {
          const results = await assertion.evaluate(makeContext(text));
          expect(Array.isArray(results)).toBe(true);
          expect(results.length).toBeGreaterThan(0);
        } catch (e: unknown) {
          expect.unreachable(
            `PII assertion threw on CC pattern: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }),
      { numRuns: 300 },
    );
  });

  it("detects SSN when embedded in random text", () => {
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        async (prefix, suffix) => {
          const ssn = "123-45-6789";
          const text = `${prefix} ${ssn} ${suffix}`;
          const assertion = createPiiAssertion({
            denyPatterns: ["\\b\\d{3}-\\d{2}-\\d{4}\\b"],
          });
          const results = await assertion.evaluate(makeContext(text));
          expect(results[0]?.passed).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("hasNestedQuantifiers — property-based fuzz tests", () => {
  it("random regex patterns return boolean, never throw", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (pattern) => {
        try {
          const result = hasNestedQuantifiers(pattern);
          expect(typeof result).toBe("boolean");
        } catch (e: unknown) {
          expect.unreachable(
            `hasNestedQuantifiers threw: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }),
      { numRuns: 500 },
    );
  });

  it("known dangerous pattern (a+)+$ returns true", () => {
    expect(hasNestedQuantifiers("(a+)+$")).toBe(true);
  });

  it("known dangerous pattern (a*)*b returns true", () => {
    expect(hasNestedQuantifiers("(a*)*b")).toBe(true);
  });

  it("known dangerous pattern (a+){2,} returns true", () => {
    expect(hasNestedQuantifiers("(a+){2,}")).toBe(true);
  });

  it("safe patterns return false", () => {
    expect(hasNestedQuantifiers("\\d{3}-\\d{2}-\\d{4}")).toBe(false);
    expect(hasNestedQuantifiers("[a-z]+")).toBe(false);
    expect(hasNestedQuantifiers("^hello$")).toBe(false);
  });
});
