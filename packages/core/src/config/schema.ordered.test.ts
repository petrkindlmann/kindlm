import { describe, it, expect } from "vitest";
import { validateConfig } from "./schema.js";

// Regression coverage for #3 (opt-in ordered tool calls). These tests live in a
// dedicated file so the strict round-trip suite in schema.test.ts is untouched.

function baseConfig(expectBlock: Record<string, unknown>) {
  return {
    kindlm: 1 as const,
    project: "test-project",
    suite: { name: "test-suite" },
    providers: { openai: { apiKeyEnv: "OPENAI_API_KEY" } },
    models: [
      {
        id: "gpt-4o",
        provider: "openai" as const,
        model: "gpt-4o",
        params: { temperature: 0, maxTokens: 1024 },
      },
    ],
    prompts: { greeting: { user: "Hello {{name}}" } },
    tests: [
      {
        name: "basic",
        prompt: "greeting",
        expect: expectBlock,
      },
    ],
  };
}

describe("toolCallsOrdered opt-in schema (#3)", () => {
  it("accepts toolCallsOrdered: true alongside a plain toolCalls list", () => {
    const result = validateConfig(
      baseConfig({
        toolCallsOrdered: true,
        toolCalls: [{ tool: "lookup" }, { tool: "refund" }],
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      const test0 = result.data.tests[0];
      expect(test0?.expect.toolCallsOrdered).toBe(true);
    }
  });

  it("accepts a plain toolCalls list with no ordered flag (back-compat)", () => {
    const result = validateConfig(
      baseConfig({ toolCalls: [{ tool: "lookup" }, { tool: "refund" }] }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tests[0]?.expect.toolCallsOrdered).toBeUndefined();
    }
  });

  it("rejects an unknown sibling key under expect (strict mode preserved from plan 01)", () => {
    const result = validateConfig(
      baseConfig({
        toolCalls: [{ tool: "lookup" }],
        toolCallOrdered: true, // typo'd key — must be rejected by .strict()
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean toolCallsOrdered value", () => {
    const result = validateConfig(
      baseConfig({
        toolCalls: [{ tool: "lookup" }],
        toolCallsOrdered: "yes",
      }),
    );
    expect(result.success).toBe(false);
  });
});
