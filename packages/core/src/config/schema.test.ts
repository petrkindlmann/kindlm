import { describe, it, expect } from "vitest";
import { validateConfig, formatZodPath } from "./schema.js";

function minimalConfig(overrides: Record<string, unknown> = {}) {
  return {
    kindlm: 1,
    project: "test-project",
    suite: { name: "test-suite" },
    providers: { openai: { apiKeyEnv: "OPENAI_API_KEY" } },
    models: [{ id: "gpt-4o", provider: "openai", model: "gpt-4o" }],
    prompts: { greeting: { user: "Hello {{name}}" } },
    tests: [
      {
        name: "test-1",
        prompt: "greeting",
        vars: { name: "World" },
        expect: {},
      },
    ],
    ...overrides,
  };
}

describe("validateConfig", () => {
  it("accepts a valid minimal config", () => {
    const result = validateConfig(minimalConfig());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.project).toBe("test-project");
      expect(result.data.models).toHaveLength(1);
    }
  });

  it("accepts a valid full config", () => {
    const result = validateConfig(
      minimalConfig({
        gates: {
          passRateMin: 0.9,
          schemaFailuresMax: 1,
          judgeAvgMin: 0.8,
          driftScoreMax: 0.2,
          piiFailuresMax: 0,
          keywordFailuresMax: 0,
          costMaxUsd: 10,
          latencyMaxMs: 5000,
        },
        compliance: {
          enabled: true,
          framework: "eu-ai-act",
          outputDir: "./reports",
          metadata: {
            systemName: "TestBot",
            systemVersion: "1.0",
            riskLevel: "limited",
            operator: "ACME",
            intendedPurpose: "Testing",
          },
        },
        defaults: {
          repeat: 3,
          concurrency: 8,
          timeoutMs: 30000,
          judgeModel: "gpt-4o",
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("populates defaults when fields are omitted", () => {
    const result = validateConfig(minimalConfig());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaults.repeat).toBe(1);
      expect(result.data.defaults.concurrency).toBe(4);
      expect(result.data.defaults.timeoutMs).toBe(60000);
      expect(result.data.gates.passRateMin).toBe(0.95);
      expect(result.data.gates.schemaFailuresMax).toBe(0);
      expect(result.data.upload.enabled).toBe(false);
      expect(result.data.upload.apiUrl).toBe("https://api.kindlm.com/v1");
    }
  });

  it("rejects missing kindlm field", () => {
    const { kindlm: _, ...rest } = minimalConfig();
    const result = validateConfig(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid version (not 1)", () => {
    const result = validateConfig(minimalConfig({ kindlm: 2 }));
    expect(result.success).toBe(false);
  });

  it("rejects missing project", () => {
    const { project: _, ...rest } = minimalConfig();
    const result = validateConfig(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty providers (none configured)", () => {
    const result = validateConfig(minimalConfig({ providers: {} }));
    expect(result.success).toBe(false);
  });

  it("rejects missing models", () => {
    const result = validateConfig(minimalConfig({ models: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects empty prompts", () => {
    const result = validateConfig(minimalConfig({ prompts: {} }));
    expect(result.success).toBe(false);
  });

  it("rejects empty tests", () => {
    const result = validateConfig(minimalConfig({ tests: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects json format without schemaFile", () => {
    const result = validateConfig(
      minimalConfig({
        tests: [
          {
            name: "json-test",
            prompt: "greeting",
            expect: { output: { format: "json" } },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts json format with schemaFile", () => {
    const result = validateConfig(
      minimalConfig({
        tests: [
          {
            name: "json-test",
            prompt: "greeting",
            expect: {
              output: {
                format: "json",
                schemaFile: "./schema.json",
              },
            },
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects invalid regex in PII denyPatterns", () => {
    const result = validateConfig(
      minimalConfig({
        tests: [
          {
            name: "pii-test",
            prompt: "greeting",
            expect: {
              guardrails: {
                pii: { enabled: true, denyPatterns: ["[invalid"] },
              },
            },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects temperature out of bounds", () => {
    const result = validateConfig(
      minimalConfig({
        models: [
          {
            id: "gpt-4o",
            provider: "openai",
            model: "gpt-4o",
            params: { temperature: 3 },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects judge score out of 0-1 range", () => {
    const result = validateConfig(
      minimalConfig({
        tests: [
          {
            name: "judge-test",
            prompt: "greeting",
            expect: {
              judge: [{ criteria: "Be nice", minScore: 1.5 }],
            },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects repeat above 100 in defaults", () => {
    const result = validateConfig(
      minimalConfig({ defaults: { repeat: 101 } }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts repeat at 100 in defaults", () => {
    const result = validateConfig(
      minimalConfig({ defaults: { repeat: 100 } }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects per-test repeat above 100", () => {
    const result = validateConfig(
      minimalConfig({
        tests: [
          {
            name: "repeat-test",
            prompt: "greeting",
            repeat: 101,
            expect: {},
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("returns error details with field paths", () => {
    const result = validateConfig({ kindlm: "wrong" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CONFIG_VALIDATION_ERROR");
      expect(result.error.details?.errors).toBeDefined();
      const errors = (result.error.details?.errors ?? []) as string[];
      expect(errors.length).toBeGreaterThan(0);
    }
  });
});

describe("formatZodPath", () => {
  it("returns empty string for empty path", () => {
    expect(formatZodPath([])).toBe("");
  });

  it("returns single string segment as-is", () => {
    expect(formatZodPath(["tests"])).toBe("tests");
  });

  it("wraps numeric segment in brackets", () => {
    expect(formatZodPath(["tests", 2])).toBe("tests[2]");
  });

  it("formats deeply nested path with multiple array indices", () => {
    expect(
      formatZodPath(["tests", 2, "expect", "judge", 0, "minScore"]),
    ).toBe("tests[2].expect.judge[0].minScore");
  });

  it("formats object-only path with dot notation", () => {
    expect(formatZodPath(["suite", "name"])).toBe("suite.name");
  });
});

describe("validateConfig error path format", () => {
  it("uses bracket notation for array indices in error paths", () => {
    const result = validateConfig(
      minimalConfig({
        tests: [
          {
            name: "test-1",
            prompt: "greeting",
            expect: {},
          },
          {
            name: "judge-test",
            prompt: "greeting",
            expect: {
              judge: [{ criteria: "Be nice", minScore: 2 }],
            },
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = (result.error.details?.errors ?? []) as string[];
      const judgeError = errors.find((e) => e.includes("minScore"));
      expect(judgeError).toBeDefined();
      // Must use bracket notation: tests[1].expect.judge[0].minScore
      expect(judgeError).toMatch(/tests\[1\]/);
      expect(judgeError).toMatch(/judge\[0\]/);
      // Must NOT use dot notation for array indices
      expect(judgeError).not.toMatch(/tests\.1\./);
    }
  });
});

describe("conversation schema", () => {
  function testWithConversation(overrides: Record<string, unknown> = {}) {
    return {
      kindlm: 1,
      project: "test-project",
      suite: { name: "test-suite" },
      providers: { openai: { apiKeyEnv: "OPENAI_API_KEY" } },
      models: [{ id: "gpt-4o", provider: "openai", model: "gpt-4o" }],
      prompts: { greeting: { user: "Hello {{name}}" } },
      tests: [
        {
          name: "conv-test",
          prompt: "greeting",
          vars: { name: "World" },
          expect: {},
          ...overrides,
        },
      ],
    };
  }

  it("parses a test case with conversation array containing labeled turns with expect", () => {
    const result = validateConfig(
      testWithConversation({
        conversation: [
          {
            turn: "turn-1",
            expect: { output: { contains: ["hello"] } },
          },
          {
            turn: "turn-2",
            user: "Follow-up question",
            expect: { output: { contains: ["world"] } },
          },
        ],
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tests[0]?.conversation).toHaveLength(2);
      expect(result.data.tests[0]?.conversation?.[0]?.turn).toBe("turn-1");
      expect(result.data.tests[0]?.conversation?.[1]?.user).toBe("Follow-up question");
    }
  });

  it("rejects duplicate turn labels with clear error message", () => {
    const result = validateConfig(
      testWithConversation({
        conversation: [
          { turn: "same-label", expect: {} },
          { turn: "same-label", expect: {} },
        ],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = (result.error.details?.errors ?? []) as string[];
      const dupError = errors.find((e) => e.includes("Duplicate turn label"));
      expect(dupError).toBeDefined();
      expect(dupError).toContain("same-label");
    }
  });

  it("allows test case without conversation field (backward compat)", () => {
    const result = validateConfig(testWithConversation());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tests[0]?.conversation).toBeUndefined();
    }
  });

  it("rejects maxTurns: 21 (exceeds max 20)", () => {
    const result = validateConfig(testWithConversation({ maxTurns: 21 }));
    expect(result.success).toBe(false);
  });

  it("accepts maxTurns: 20 (boundary)", () => {
    const result = validateConfig(testWithConversation({ maxTurns: 20 }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tests[0]?.maxTurns).toBe(20);
    }
  });

  it("rejects maxTurns: 0 (below min 1)", () => {
    const result = validateConfig(testWithConversation({ maxTurns: 0 }));
    expect(result.success).toBe(false);
  });

  it("allows turn without expect (assertion is optional per turn)", () => {
    const result = validateConfig(
      testWithConversation({
        conversation: [
          { turn: "no-assertions-turn" },
          { turn: "with-assertions-turn", expect: { output: { contains: ["ok"] } } },
        ],
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tests[0]?.conversation?.[0]?.expect).toBeUndefined();
    }
  });

  it("allows turn with user message override", () => {
    const result = validateConfig(
      testWithConversation({
        conversation: [
          { turn: "user-turn", user: "What is the weather?" },
        ],
      }),
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tests[0]?.conversation?.[0]?.user).toBe("What is the weather?");
    }
  });
});
