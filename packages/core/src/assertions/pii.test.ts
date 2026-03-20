import { describe, it, expect } from "vitest";
import type { AssertionContext } from "./interface.js";
import { createPiiAssertion } from "./pii.js";

function ctx(outputText: string): AssertionContext {
  return { outputText, toolCalls: [], configDir: "/tmp" };
}

const DEFAULT_PATTERNS = [
  "\\b\\d{3}-\\d{2}-\\d{4}\\b",
  "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
  "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
];

describe("createPiiAssertion", () => {
  it("passes for clean text", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(ctx("This is a normal sentence."));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("detects SSN pattern", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(
      ctx("My SSN is 123-45-6789"),
    );
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "PII_DETECTED",
    });
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("pii-pattern-1");
  });

  it("detects credit card pattern", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(
      ctx("Card: 4111 1111 1111 1111"),
    );
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "PII_DETECTED",
    });
  });

  it("detects email pattern", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(
      ctx("Contact me at user@example.com"),
    );
    expect(results[0]).toMatchObject({ passed: false });
  });

  it("detects multiple PII matches", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(
      ctx("SSN: 123-45-6789, email: test@example.com"),
    );
    expect(results[0]).toMatchObject({ passed: false });
    const metadata = results[0]?.metadata as { matches: unknown[] } | undefined;
    expect(metadata?.matches.length).toBeGreaterThan(1);
  });

  it("uses custom patterns", async () => {
    const assertion = createPiiAssertion({
      denyPatterns: [],
      customPatterns: [{ name: "api-key", pattern: "sk-[a-zA-Z0-9]{20,}" }],
    });
    const results = await assertion.evaluate(
      ctx("Key: sk-abcdefghijklmnopqrstuvwxyz"),
    );
    expect(results[0]).toMatchObject({ passed: false });
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("api-key");
  });

  it("passes when custom patterns don't match", async () => {
    const assertion = createPiiAssertion({
      denyPatterns: [],
      customPatterns: [{ name: "api-key", pattern: "sk-[a-zA-Z0-9]{20,}" }],
    });
    const results = await assertion.evaluate(ctx("No keys here"));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("redacts matched values in failure message", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(
      ctx("SSN: 123-45-6789"),
    );
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).not.toContain("123-45-6789");
    expect(msg).toContain("****");
  });

  it("redacts short matches with correct length", async () => {
    const assertion = createPiiAssertion({
      denyPatterns: [],
      customPatterns: [{ name: "pin", pattern: "\\b\\d{4}\\b" }],
    });
    const results = await assertion.evaluate(ctx("PIN: 1234"));
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("****");
    expect(msg).not.toContain("1234");
  });

  it("rejects nested quantifier patterns (ReDoS protection)", async () => {
    const assertion = createPiiAssertion({
      denyPatterns: [],
      customPatterns: [{ name: "evil", pattern: "(a+)+$" }],
    });
    const results = await assertion.evaluate(ctx("aaaa"));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "INVALID_PATTERN",
    });
  });

  it("limits matches to prevent runaway scanning", async () => {
    // Pattern that matches every single character
    const assertion = createPiiAssertion({
      denyPatterns: ["[a-z]"],
    });
    // Long input
    const longText = "a".repeat(5000);
    const results = await assertion.evaluate(ctx(longText));
    expect(results[0]).toMatchObject({ passed: false });
    const metadata = results[0]?.metadata as { matches: unknown[] } | undefined;
    // Should be capped at 1000
    expect(metadata?.matches.length).toBeLessThanOrEqual(1000);
  });

  it("passes for empty string input", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(ctx(""));
    expect(results[0]).toMatchObject({ passed: true });
  });
});
