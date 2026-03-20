/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it, expect, vi } from "vitest";
import { createRunner } from "./runner.js";
import type { RunnerDeps, ProgressEvent } from "./runner.js";
import type { KindLMConfig } from "../types/config.js";
import type { ProviderAdapter, ProviderResponse, ProviderRequest } from "../types/provider.js";
import type { FileReader } from "../config/parser.js";

// ============================================================
// Test Helpers
// ============================================================

function makeAdapter(overrides?: Partial<ProviderResponse>): ProviderAdapter {
  const defaultResponse: ProviderResponse = {
    text: "Hello, I can help with that.",
    toolCalls: [],
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    raw: {},
    latencyMs: 100,
    modelId: "gpt-4o",
    finishReason: "stop",
    ...overrides,
  };

  return {
    name: "openai",
    initialize: vi.fn(),
    complete: vi.fn().mockResolvedValue(defaultResponse),
    estimateCost: vi.fn().mockReturnValue(0.001),
    supportsTools: vi.fn().mockReturnValue(true),
  };
}

function makeFileReader(files?: Record<string, string>): FileReader {
  return {
    readFile(path: string) {
      const content = files?.[path];
      if (content !== undefined) {
        return { success: true as const, data: content };
      }
      return {
        success: false as const,
        error: { code: "CONFIG_FILE_REF_ERROR" as const, message: `File not found: ${path}` },
      };
    },
  };
}

function makeDeps(overrides?: Partial<RunnerDeps>): RunnerDeps {
  const adapter = makeAdapter();
  return {
    adapters: new Map([["openai", adapter]]),
    configDir: "/project",
    fileReader: makeFileReader(),
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<KindLMConfig>): KindLMConfig {
  return {
    kindlm: 1,
    project: "test-project",
    suite: { name: "test-suite" },
    providers: { openai: { apiKeyEnv: "OPENAI_API_KEY" } },
    models: [
      {
        id: "gpt-4o",
        provider: "openai",
        model: "gpt-4o",
        params: { temperature: 0, maxTokens: 1024 },
      },
    ],
    prompts: {
      greeting: { user: "Hello {{name}}" },
    },
    tests: [
      {
        name: "basic-test",
        prompt: "greeting",
        vars: { name: "World" },
        skip: false,
        expect: {
          output: {
            format: "text",
            contains: ["Hello"],
          },
        },
      },
    ],
    gates: {
      passRateMin: 0.95,
      schemaFailuresMax: 0,
      piiFailuresMax: 0,
      keywordFailuresMax: 0,
    },
    upload: { enabled: false, apiUrl: "https://api.kindlm.com/v1" },
    defaults: {
      repeat: 1,
      concurrency: 4,
      timeoutMs: 60000,
    },
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe("createRunner", () => {
  it("runs a single test with single model and returns RunResult", async () => {
    const config = makeConfig();
    const deps = makeDeps();
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { runResult, aggregated } = result.data;
    expect(runResult.totalTests).toBe(1);
    expect(runResult.suites).toHaveLength(1);
    expect(runResult.suites[0]!.name).toBe("test-suite");
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]!.testCaseName).toBe("basic-test");
    expect(aggregated[0]!.modelId).toBe("gpt-4o");
  });

  it("runs test against multiple models", async () => {
    const adapter2 = makeAdapter({ modelId: "claude-sonnet" });
    const config = makeConfig({
      providers: {
        openai: { apiKeyEnv: "OPENAI_API_KEY" },
        anthropic: { apiKeyEnv: "ANTHROPIC_API_KEY" },
      },
      models: [
        { id: "gpt-4o", provider: "openai", model: "gpt-4o", params: { temperature: 0, maxTokens: 1024 } },
        { id: "claude", provider: "anthropic", model: "claude-sonnet", params: { temperature: 0, maxTokens: 1024 } },
      ],
    });
    const deps = makeDeps({
      adapters: new Map([
        ["openai", makeAdapter()],
        ["anthropic", adapter2],
      ]),
    });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.aggregated).toHaveLength(2);
    const modelIds = result.data.aggregated.map((a) => a.modelId).sort();
    expect(modelIds).toEqual(["claude", "gpt-4o"]);
  });

  it("aggregates multiple runs with passRate", async () => {
    let callCount = 0;
    const adapter: ProviderAdapter = {
      name: "openai",
      initialize: vi.fn(),
      complete: vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          text: callCount % 2 === 0 ? "Hello, I can help" : "no match here",
          toolCalls: [],
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          raw: {},
          latencyMs: 100,
          modelId: "gpt-4o",
          finishReason: "stop",
        } satisfies ProviderResponse;
      }),
      estimateCost: vi.fn().mockReturnValue(0.001),
      supportsTools: vi.fn().mockReturnValue(true),
    };

    const config = makeConfig({
      defaults: { repeat: 4, concurrency: 1, timeoutMs: 60000 },
    });
    const deps = makeDeps({ adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.aggregated[0]!.runCount).toBe(4);
    // 2 of 4 contain "Hello" → passRate = 0.5
    expect(result.data.aggregated[0]!.passRate).toBe(0.5);
  });

  it("skips tests marked with skip: true", async () => {
    const config = makeConfig({
      tests: [
        {
          name: "skipped-test",
          prompt: "greeting",
          vars: { name: "World" },
          skip: true,
          expect: { output: { format: "text", contains: ["Hello"] } },
        },
      ],
    });
    const adapter = makeAdapter();
    const deps = makeDeps({ adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.runResult.skipped).toBe(1);
    expect(result.data.runResult.suites[0]!.tests[0]!.status).toBe("skipped");
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it("records tool calls from conversation", async () => {
    const adapter = makeAdapter({
      toolCalls: [{ id: "tc1", name: "lookup_order", arguments: { order_id: "123" } }],
    });
    // First call returns tool call, second returns final text
    (adapter.complete as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [{ id: "tc1", name: "lookup_order", arguments: { order_id: "123" } }],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        raw: {},
        latencyMs: 50,
        modelId: "gpt-4o",
        finishReason: "tool_calls",
      } satisfies ProviderResponse)
      .mockResolvedValueOnce({
        text: "Order found.",
        toolCalls: [],
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        raw: {},
        latencyMs: 50,
        modelId: "gpt-4o",
        finishReason: "stop",
      } satisfies ProviderResponse);

    const config = makeConfig({
      tests: [
        {
          name: "tool-test",
          prompt: "greeting",
          vars: { name: "Order #123" },
          skip: false,
          tools: [
            {
              name: "lookup_order",
              defaultResponse: { status: "found", id: "123" },
            },
          ],
          expect: {},
        },
      ],
    });
    const deps = makeDeps({ adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.aggregated[0]!.runs[0]!.outputText).toBe("Order found.");
  });

  it("propagates assertion failures as status failed", async () => {
    const adapter = makeAdapter({ text: "no matching content" });
    const config = makeConfig({
      tests: [
        {
          name: "fail-test",
          prompt: "greeting",
          vars: { name: "World" },
          skip: false,
          expect: {
            output: { format: "text", contains: ["MUST_CONTAIN_THIS"] },
          },
        },
      ],
    });
    const deps = makeDeps({ adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.runResult.failed).toBe(1);
    expect(result.data.runResult.suites[0]!.tests[0]!.status).toBe("failed");
  });

  it("fires progress callback events", async () => {
    const events: ProgressEvent[] = [];
    const config = makeConfig();
    const deps = makeDeps({ onProgress: (e) => events.push(e) });
    const runner = createRunner(config, deps);
    await runner.run();

    expect(events.length).toBe(2);
    expect(events[0]!.type).toBe("test_start");
    expect(events[1]!.type).toBe("test_complete");
  });

  it("pre-loads schema files via fileReader", async () => {
    const schema = { type: "object", properties: { name: { type: "string" } }, required: ["name"] };
    const adapter = makeAdapter({ text: '{"name":"test"}' });
    const fileReader = makeFileReader({
      "/project/schemas/output.json": JSON.stringify(schema),
    });

    const config = makeConfig({
      tests: [
        {
          name: "schema-test",
          prompt: "greeting",
          vars: { name: "World" },
          skip: false,
          expect: {
            output: {
              format: "json",
              schemaFile: "schemas/output.json",
            },
          },
        },
      ],
    });
    const deps = makeDeps({ fileReader, adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.runResult.passed).toBe(1);
  });

  it("returns error when schema file cannot be read", async () => {
    const config = makeConfig({
      tests: [
        {
          name: "missing-schema",
          prompt: "greeting",
          vars: { name: "World" },
          skip: false,
          expect: {
            output: {
              format: "json",
              schemaFile: "missing.json",
            },
          },
        },
      ],
    });
    const deps = makeDeps();
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.code).toBe("SCHEMA_FILE_ERROR");
  });

  it("completes all tasks with concurrency", async () => {
    const callCount = { value: 0 };
    const adapter: ProviderAdapter = {
      name: "openai",
      initialize: vi.fn(),
      complete: vi.fn().mockImplementation(async () => {
        callCount.value++;
        return {
          text: "Hello!",
          toolCalls: [],
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          raw: {},
          latencyMs: 10,
          modelId: "gpt-4o",
          finishReason: "stop",
        } satisfies ProviderResponse;
      }),
      estimateCost: vi.fn().mockReturnValue(0.001),
      supportsTools: vi.fn().mockReturnValue(true),
    };

    const config = makeConfig({
      defaults: { repeat: 3, concurrency: 2, timeoutMs: 60000 },
    });
    const deps = makeDeps({ adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    expect(callCount.value).toBe(3);
  });

  it("handles provider error gracefully", async () => {
    const adapter: ProviderAdapter = {
      name: "openai",
      initialize: vi.fn(),
      complete: vi.fn().mockRejectedValue(new Error("API rate limited")),
      estimateCost: vi.fn().mockReturnValue(null),
      supportsTools: vi.fn().mockReturnValue(true),
    };

    const config = makeConfig();
    const deps = makeDeps({ adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.runResult.errored).toBe(1);
    expect(result.data.runResult.suites[0]!.tests[0]!.status).toBe("errored");
    const assertions = result.data.aggregated[0]!.runs[0]!.assertions;
    expect(assertions[0]!.failureCode).toBe("INTERNAL_ERROR");
    expect(assertions[0]!.failureMessage).toContain("API rate limited");
  });

  it("handles all tests skipped gracefully", async () => {
    const config = makeConfig({
      tests: [
        {
          name: "skipped-1",
          prompt: "greeting",
          vars: { name: "A" },
          skip: true,
          expect: { output: { format: "text", contains: ["Hello"] } },
        },
        {
          name: "skipped-2",
          prompt: "greeting",
          vars: { name: "B" },
          skip: true,
          expect: { output: { format: "text", contains: ["Hello"] } },
        },
      ],
    });
    const adapter = makeAdapter();
    const deps = makeDeps({ adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.runResult.skipped).toBe(2);
    expect(result.data.runResult.passed).toBe(0);
    expect(result.data.runResult.failed).toBe(0);
    expect(result.data.runResult.errored).toBe(0);
    expect(result.data.runResult.totalTests).toBe(2);
    // No calls should have been made
    expect(adapter.complete).not.toHaveBeenCalled();
  });

  it("interpolates prompt variables correctly", async () => {
    const adapter = makeAdapter();
    const config = makeConfig({
      prompts: {
        greeting: {
          system: "You are {{role}}",
          user: "Hi, I am {{name}}",
        },
      },
      tests: [
        {
          name: "interp-test",
          prompt: "greeting",
          vars: { name: "Alice", role: "a helper" },
          skip: false,
          expect: {},
        },
      ],
    });
    const deps = makeDeps({ adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    await runner.run();

    const call = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0] as ProviderRequest;
    expect(call.messages[0]!.content).toBe("You are a helper");
    expect(call.messages[1]!.content).toBe("Hi, I am Alice");
  });

  it("does not crash when onProgress callback throws", async () => {
    const config = makeConfig();
    const deps = makeDeps({
      onProgress: () => {
        throw new Error("Progress callback exploded");
      },
    });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    // Runner should complete despite the throwing callback
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.runResult.totalTests).toBe(1);
  });

  it("populates error field on errored TestRunResult", async () => {
    const adapter: ProviderAdapter = {
      name: "openai",
      initialize: vi.fn(),
      complete: vi.fn().mockRejectedValue(new Error("Connection refused")),
      estimateCost: vi.fn().mockReturnValue(null),
      supportsTools: vi.fn().mockReturnValue(true),
    };

    const config = makeConfig();
    const deps = makeDeps({ adapters: new Map([["openai", adapter]]) });
    const runner = createRunner(config, deps);
    const result = await runner.run();

    expect(result.success).toBe(true);
    if (!result.success) return;

    const testResult = result.data.runResult.suites[0]!.tests[0]!;
    expect(testResult.status).toBe("errored");
    expect(testResult.error).toBeDefined();
    expect(testResult.error!.message).toContain("Connection refused");
    expect(testResult.error!.code).toBe("UNKNOWN_ERROR");
  });
});
