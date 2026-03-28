import { describe, it, expect } from "vitest";
import type { KindLMConfig } from "../types/config.js";
import { buildTestPlan } from "./test-plan.js";

function createMinimalConfig(overrides?: Partial<KindLMConfig>): KindLMConfig {
  return {
    kindlm: 1,
    project: "test-project",
    suite: { name: "test-suite", description: "A test suite" },
    providers: { openai: { apiKeyEnv: "OPENAI_API_KEY" } },
    models: [
      { id: "gpt-4o", provider: "openai", model: "gpt-4o", params: { temperature: 0, maxTokens: 1024 } },
    ],
    prompts: { greeting: { user: "Hello" } },
    tests: [
      {
        name: "basic-test",
        prompt: "greeting",
        vars: {},
        expect: { output: { format: "text", contains: ["hello"] } },
        skip: false,
      },
    ],
    gates: { passRateMin: 0.95, schemaFailuresMax: 0, piiFailuresMax: 0, keywordFailuresMax: 0 },
    upload: { enabled: false, apiUrl: "https://api.kindlm.com/v1" },
    defaults: { repeat: 1, concurrency: 4, timeoutMs: 60000 },
    ...overrides,
  } as KindLMConfig;
}

describe("buildTestPlan", () => {
  it("builds a plan from minimal config", () => {
    const config = createMinimalConfig();
    const plan = buildTestPlan(config);

    expect(plan.suiteName).toBe("test-suite");
    expect(plan.suiteDescription).toBe("A test suite");
    expect(plan.project).toBe("test-project");
    expect(plan.concurrency).toBe(4);
    expect(plan.timeoutMs).toBe(60000);
    expect(plan.entries).toHaveLength(1);
    expect(plan.totalExecutionUnits).toBe(1);

    const entry = plan.entries[0]!;
    expect(entry.testName).toBe("basic-test");
    expect(entry.modelId).toBe("gpt-4o");
    expect(entry.provider).toBe("openai");
    expect(entry.repeat).toBe(1);
    expect(entry.isCommand).toBe(false);
    expect(entry.skip).toBe(false);
    expect(entry.assertionTypes).toContain("keywords");
  });

  it("multiplies by models and repeat count", () => {
    const config = createMinimalConfig({
      models: [
        { id: "gpt-4o", provider: "openai", model: "gpt-4o", params: { temperature: 0, maxTokens: 1024 } },
        { id: "gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", params: { temperature: 0, maxTokens: 1024 } },
      ],
      defaults: { repeat: 3, concurrency: 4, timeoutMs: 60000 },
    });

    const plan = buildTestPlan(config);
    // 1 test x 2 models = 2 entries, each with repeat 3
    expect(plan.entries).toHaveLength(2);
    expect(plan.totalExecutionUnits).toBe(6); // 2 entries x 3 repeats
    expect(plan.entries[0]!.repeat).toBe(3);
    expect(plan.entries[1]!.repeat).toBe(3);
  });

  it("marks skipped tests and excludes them from execution count", () => {
    const config = createMinimalConfig({
      tests: [
        {
          name: "active-test",
          prompt: "greeting",
          vars: {},
          expect: { output: { format: "text", contains: ["hello"] } },
          skip: false,
        },
        {
          name: "skipped-test",
          prompt: "greeting",
          vars: {},
          expect: { output: { format: "text", contains: ["hello"] } },
          skip: true,
        },
      ] as KindLMConfig["tests"],
    });

    const plan = buildTestPlan(config);
    expect(plan.entries).toHaveLength(2);
    expect(plan.totalExecutionUnits).toBe(1);

    const skipped = plan.entries.find((e) => e.testName === "skipped-test")!;
    expect(skipped.skip).toBe(true);
    expect(skipped.repeat).toBe(0);
  });

  it("handles command tests", () => {
    const config = createMinimalConfig({
      tests: [
        {
          name: "cmd-test",
          command: "echo hello",
          vars: {},
          expect: { output: { format: "text", contains: ["hello"] } },
          skip: false,
        },
      ] as KindLMConfig["tests"],
    });

    const plan = buildTestPlan(config);
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]!.isCommand).toBe(true);
    expect(plan.entries[0]!.modelId).toBe("command");
    expect(plan.entries[0]!.provider).toBe("shell");
    expect(plan.totalExecutionUnits).toBe(1);
  });

  it("filters by tags", () => {
    const config = createMinimalConfig({
      tests: [
        {
          name: "regression-test",
          prompt: "greeting",
          vars: {},
          expect: { output: { format: "text", contains: ["hello"] } },
          skip: false,
          tags: ["regression"],
        },
        {
          name: "smoke-test",
          prompt: "greeting",
          vars: {},
          expect: { output: { format: "text", contains: ["hello"] } },
          skip: false,
          tags: ["smoke"],
        },
      ] as KindLMConfig["tests"],
    });

    const plan = buildTestPlan(config, ["regression"]);
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]!.testName).toBe("regression-test");
    expect(plan.totalExecutionUnits).toBe(1);
  });

  it("extracts assertion types correctly", () => {
    const config = createMinimalConfig({
      tests: [
        {
          name: "full-assertions",
          prompt: "greeting",
          vars: {},
          expect: {
            output: { format: "text", contains: ["x"], maxLength: 100 },
            guardrails: { pii: { enabled: true, denyPatterns: [] } },
            judge: [{ criteria: "Is it good?", minScore: 0.7 }],
            toolCalls: [{ tool: "search", shouldNotCall: false }],
            latency: { maxMs: 5000 },
            cost: { maxUsd: 0.01 },
          },
          skip: false,
        },
      ] as KindLMConfig["tests"],
    });

    const plan = buildTestPlan(config);
    const types = plan.entries[0]!.assertionTypes;
    expect(types).toContain("keywords");
    expect(types).toContain("maxLength");
    expect(types).toContain("pii");
    expect(types).toContain("judge");
    expect(types).toContain("toolCalls");
    expect(types).toContain("latency");
    expect(types).toContain("cost");
  });

  it("returns empty plan when all tests are filtered out", () => {
    const config = createMinimalConfig();
    const plan = buildTestPlan(config, ["nonexistent-tag"]);
    expect(plan.entries).toHaveLength(0);
    expect(plan.totalExecutionUnits).toBe(0);
  });

  it("handles test-specific model override", () => {
    const config = createMinimalConfig({
      models: [
        { id: "gpt-4o", provider: "openai", model: "gpt-4o", params: { temperature: 0, maxTokens: 1024 } },
        { id: "gpt-4o-mini", provider: "openai", model: "gpt-4o-mini", params: { temperature: 0, maxTokens: 1024 } },
      ],
      tests: [
        {
          name: "specific-model-test",
          prompt: "greeting",
          vars: {},
          models: ["gpt-4o-mini"],
          expect: { output: { format: "text", contains: ["hello"] } },
          skip: false,
        },
      ] as KindLMConfig["tests"],
    });

    const plan = buildTestPlan(config);
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]!.modelId).toBe("gpt-4o-mini");
    expect(plan.totalExecutionUnits).toBe(1);
  });
});
