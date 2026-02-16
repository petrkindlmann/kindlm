import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseConfig } from "./parser.js";

const defaultOptions = { configDir: "/tmp" };

describe("parseConfig — property-based fuzz tests", () => {
  it("valid-shaped configs either succeed or return structured error, never throw", () => {
    const providerArb = fc.record({
      apiKeyEnv: fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9]/.test(c)), { minLength: 1, maxLength: 30 }),
    });

    const modelArb = fc.record({
      id: fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9]/.test(c)), { minLength: 1, maxLength: 20 }),
      provider: fc.constantFrom("openai", "anthropic", "ollama"),
      model: fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9]/.test(c)), { minLength: 1, maxLength: 30 }),
    });

    const _promptArb = fc.record({
      user: fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9]/.test(c)), { minLength: 1, maxLength: 100 }),
    });

    const testCaseArb = fc.record({
      name: fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9]/.test(c)), { minLength: 1, maxLength: 40 }),
      prompt: fc.constant("default"),
      expect: fc.constant({}),
    });

    const configArb = fc.record({
      kindlm: fc.constant(1),
      project: fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9]/.test(c)), { minLength: 1, maxLength: 30 }),
      suite: fc.record({
        name: fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9]/.test(c)), { minLength: 1, maxLength: 30 }),
      }),
      providers: fc.record({
        openai: providerArb,
      }),
      models: fc.array(modelArb, { minLength: 1, maxLength: 5 }),
      prompts: fc.constant({ default: { user: "Hello" } }),
      tests: fc.array(testCaseArb, { minLength: 1, maxLength: 5 }),
    });

    fc.assert(
      fc.property(configArb, (config) => {
        const yaml = JSON.stringify(config);
        try {
          const result = parseConfig(yaml, defaultOptions);
          expect(result).toHaveProperty("success");
        } catch (e: unknown) {
          // If it throws, that is a bug — fail the property
          expect.unreachable(
            `parseConfig threw unexpectedly: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }),
      { numRuns: 200 },
    );
  });

  it("random strings never crash — always return Result", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 5000 }), (input) => {
        try {
          const result = parseConfig(input, defaultOptions);
          expect(result).toHaveProperty("success");
        } catch (e: unknown) {
          expect.unreachable(
            `parseConfig threw on random string: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }),
      { numRuns: 500 },
    );
  });

  it("empty string returns error, not throw", () => {
    try {
      const result = parseConfig("", defaultOptions);
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(false);
    } catch (e: unknown) {
      expect.unreachable(
        `parseConfig threw on empty string: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  it("very long string (1MB+) returns CONFIG_TOO_LARGE error", () => {
    const longString = "a".repeat(1_048_577); // 1MB + 1 byte
    try {
      const result = parseConfig(longString, defaultOptions);
      expect(result).toHaveProperty("success");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CONFIG_TOO_LARGE");
      }
    } catch (e: unknown) {
      expect.unreachable(
        `parseConfig threw on oversized input: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });

  it("deeply nested YAML never crashes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 200 }),
        (depth) => {
          const lines: string[] = [];
          for (let i = 0; i < depth; i++) {
            lines.push(" ".repeat(i * 2) + `level${i}:`);
          }
          lines.push(" ".repeat(depth * 2) + "value: true");
          const yaml = lines.join("\n");

          try {
            const result = parseConfig(yaml, defaultOptions);
            expect(result).toHaveProperty("success");
          } catch (e: unknown) {
            expect.unreachable(
              `parseConfig threw on deep nesting (depth=${depth}): ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("strings with unicode and null bytes never crash", () => {
    fc.assert(
      fc.property(fc.fullUnicode(), (input) => {
        try {
          const result = parseConfig(input, defaultOptions);
          expect(result).toHaveProperty("success");
        } catch (e: unknown) {
          expect.unreachable(
            `parseConfig threw on unicode input: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }),
      { numRuns: 300 },
    );

    // Explicit null byte test
    const withNulls = "kindlm: 1\x00\nproject: test\x00\n";
    try {
      const result = parseConfig(withNulls, defaultOptions);
      expect(result).toHaveProperty("success");
    } catch (e: unknown) {
      expect.unreachable(
        `parseConfig threw on null bytes: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });
});
