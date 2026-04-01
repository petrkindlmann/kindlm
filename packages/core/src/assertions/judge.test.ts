import { describe, it, expect, vi } from "vitest";
import type { AssertionContext } from "./interface.js";
import type { ProviderAdapter, ProviderResponse } from "../types/provider.js";
import { createJudgeAssertion } from "./judge.js";

function mockAdapter(responseText: string): ProviderAdapter {
  return {
    name: "mock",
    initialize: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue({
      text: responseText,
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      raw: null,
      latencyMs: 100,
      modelId: "mock-model",
      finishReason: "stop",
    } satisfies ProviderResponse),
    estimateCost: vi.fn().mockReturnValue(null),
    supportsTools: vi.fn().mockReturnValue(false),
  };
}

function ctx(
  outputText: string,
  adapter?: ProviderAdapter,
  betaJudge?: boolean,
): AssertionContext {
  return {
    outputText,
    toolCalls: [],
    configDir: "/tmp",
    judgeAdapter: adapter,
    judgeModel: adapter ? "mock-model" : undefined,
    betaJudge,
  };
}

describe("createJudgeAssertion", () => {
  it("passes when score meets threshold", async () => {
    const adapter = mockAdapter('{"score": 0.9, "reasoning": "Great response"}');
    const assertion = createJudgeAssertion({
      criteria: "Is helpful",
      minScore: 0.7,
    });
    const results = await assertion.evaluate(ctx("Hello!", adapter));
    expect(results[0]).toMatchObject({ passed: true, score: 0.9 });
  });

  it("fails when score below threshold", async () => {
    const adapter = mockAdapter('{"score": 0.3, "reasoning": "Poor response"}');
    const assertion = createJudgeAssertion({
      criteria: "Is helpful",
      minScore: 0.7,
    });
    const results = await assertion.evaluate(ctx("Bad output", adapter));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "JUDGE_BELOW_THRESHOLD",
      score: 0.3,
    });
  });

  it("handles markdown code blocks in response", async () => {
    const adapter = mockAdapter(
      '```json\n{"score": 0.85, "reasoning": "Good"}\n```',
    );
    const assertion = createJudgeAssertion({
      criteria: "Is helpful",
      minScore: 0.7,
    });
    const results = await assertion.evaluate(ctx("Output", adapter));
    expect(results[0]).toMatchObject({ passed: true, score: 0.85 });
  });

  it("fails gracefully on unparseable response", async () => {
    const adapter = mockAdapter("I cannot evaluate this");
    const assertion = createJudgeAssertion({
      criteria: "Is helpful",
      minScore: 0.7,
    });
    const results = await assertion.evaluate(ctx("Output", adapter));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "JUDGE_PARSE_ERROR",
    });
  });

  it("fails when no judge adapter provided", async () => {
    const assertion = createJudgeAssertion({
      criteria: "Is helpful",
      minScore: 0.7,
    });
    const results = await assertion.evaluate(ctx("Output"));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "INTERNAL_ERROR",
    });
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("judgeAdapter");
  });

  it("passes exactly at threshold", async () => {
    const adapter = mockAdapter('{"score": 0.7, "reasoning": "Meets criteria"}');
    const assertion = createJudgeAssertion({
      criteria: "Is helpful",
      minScore: 0.7,
    });
    const results = await assertion.evaluate(ctx("Output", adapter));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("passes rubric to judge prompt", async () => {
    const adapter = mockAdapter('{"score": 0.8, "reasoning": "Good"}');
    const assertion = createJudgeAssertion({
      criteria: "Is helpful",
      minScore: 0.7,
      rubric: "Must include greeting",
    });
    const results = await assertion.evaluate(ctx("Hello!", adapter));
    expect(results[0]).toMatchObject({ passed: true });
    const calls = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls;
    const firstCall = calls[0] as [{ messages: Array<{ content: string }> }];
    expect(firstCall[0].messages[1]?.content).toContain("Must include greeting");
  });

  it("returns JUDGE_EVAL_ERROR when adapter throws", async () => {
    const adapter: ProviderAdapter = {
      name: "mock",
      initialize: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn().mockRejectedValue(new Error("API rate limited")),
      estimateCost: vi.fn().mockReturnValue(null),
      supportsTools: vi.fn().mockReturnValue(false),
    };
    const assertion = createJudgeAssertion({
      criteria: "Is helpful",
      minScore: 0.7,
    });
    const results = await assertion.evaluate(ctx("Output", adapter));
    expect(results[0]).toMatchObject({
      passed: false,
      score: 0,
      failureCode: "JUDGE_EVAL_ERROR",
    });
    expect(results[0]?.failureMessage).toContain("API rate limited");
  });

  it("includes reasoning in metadata", async () => {
    const adapter = mockAdapter('{"score": 0.9, "reasoning": "Very clear"}');
    const assertion = createJudgeAssertion({
      criteria: "Is clear",
      minScore: 0.5,
    });
    const results = await assertion.evaluate(ctx("Output", adapter));
    expect(results[0]?.metadata).toEqual({ reasoning: "Very clear", threshold: 0.5 });
  });
});

describe("betaJudge multi-pass scoring", () => {
  it("passes with median of 3 scores above threshold", async () => {
    // scores: [0.7, 0.8, 0.9] sorted → median index Math.floor(3/2)=1 → 0.8
    const adapter: ProviderAdapter = {
      name: "mock",
      initialize: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn()
        .mockResolvedValueOnce({ text: '{"score": 0.8, "reasoning": "Good"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse)
        .mockResolvedValueOnce({ text: '{"score": 0.9, "reasoning": "Great"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse)
        .mockResolvedValueOnce({ text: '{"score": 0.7, "reasoning": "OK"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse),
      estimateCost: vi.fn().mockReturnValue(null),
      supportsTools: vi.fn().mockReturnValue(false),
    };
    const assertion = createJudgeAssertion({ criteria: "Is helpful", minScore: 0.7 });
    const results = await assertion.evaluate(ctx("Hello!", adapter, true));
    expect(results[0]).toMatchObject({ passed: true, score: 0.8 });
  });

  it("fails with median of 3 scores below threshold", async () => {
    // scores: [0.3, 0.4, 0.5] sorted → median index 1 → 0.4
    const adapter: ProviderAdapter = {
      name: "mock",
      initialize: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn()
        .mockResolvedValueOnce({ text: '{"score": 0.3, "reasoning": "Bad"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse)
        .mockResolvedValueOnce({ text: '{"score": 0.5, "reasoning": "Mediocre"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse)
        .mockResolvedValueOnce({ text: '{"score": 0.4, "reasoning": "Poor"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse),
      estimateCost: vi.fn().mockReturnValue(null),
      supportsTools: vi.fn().mockReturnValue(false),
    };
    const assertion = createJudgeAssertion({ criteria: "Is helpful", minScore: 0.7 });
    const results = await assertion.evaluate(ctx("Bad output", adapter, true));
    expect(results[0]).toMatchObject({ passed: false, score: 0.4, failureCode: "JUDGE_BELOW_THRESHOLD" });
  });

  it("uses median of 2 valid scores when 1/3 passes throws", async () => {
    // successful scores: [0.8, 0.9] sorted → median index Math.floor(2/2)=1 → 0.9
    const adapter: ProviderAdapter = {
      name: "mock",
      initialize: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn()
        .mockResolvedValueOnce({ text: '{"score": 0.8, "reasoning": "Good"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse)
        .mockRejectedValueOnce(new Error("transient error"))
        .mockResolvedValueOnce({ text: '{"score": 0.9, "reasoning": "Great"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse),
      estimateCost: vi.fn().mockReturnValue(null),
      supportsTools: vi.fn().mockReturnValue(false),
    };
    const assertion = createJudgeAssertion({ criteria: "Is helpful", minScore: 0.7 });
    const results = await assertion.evaluate(ctx("Output", adapter, true));
    expect(results[0]).toMatchObject({ passed: true, score: 0.9 });
  });

  it("returns JUDGE_EVAL_ERROR when only 1/3 passes succeed", async () => {
    const adapter: ProviderAdapter = {
      name: "mock",
      initialize: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn()
        .mockResolvedValueOnce({ text: '{"score": 0.8, "reasoning": "Good"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse)
        .mockRejectedValueOnce(new Error("API error"))
        .mockRejectedValueOnce(new Error("API error 2")),
      estimateCost: vi.fn().mockReturnValue(null),
      supportsTools: vi.fn().mockReturnValue(false),
    };
    const assertion = createJudgeAssertion({ criteria: "Is helpful", minScore: 0.7 });
    const results = await assertion.evaluate(ctx("Output", adapter, true));
    expect(results[0]).toMatchObject({ passed: false, score: 0, failureCode: "JUDGE_EVAL_ERROR" });
    expect(results[0]?.failureMessage).toContain("only 1/3 passes succeeded (need 2)");
  });

  it("returns JUDGE_EVAL_ERROR when all 3 passes fail", async () => {
    const adapter: ProviderAdapter = {
      name: "mock",
      initialize: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockRejectedValueOnce(new Error("fail 3")),
      estimateCost: vi.fn().mockReturnValue(null),
      supportsTools: vi.fn().mockReturnValue(false),
    };
    const assertion = createJudgeAssertion({ criteria: "Is helpful", minScore: 0.7 });
    const results = await assertion.evaluate(ctx("Output", adapter, true));
    expect(results[0]).toMatchObject({ passed: false, score: 0, failureCode: "JUDGE_EVAL_ERROR" });
  });

  it("uses median of 2 valid scores when 1/3 returns parse error", async () => {
    // successful scores: [0.7, 0.9] sorted → median index 1 → 0.9
    const adapter: ProviderAdapter = {
      name: "mock",
      initialize: vi.fn().mockResolvedValue(undefined),
      complete: vi.fn()
        .mockResolvedValueOnce({ text: '{"score": 0.7, "reasoning": "OK"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse)
        .mockResolvedValueOnce({ text: "not valid json", toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse)
        .mockResolvedValueOnce({ text: '{"score": 0.9, "reasoning": "Great"}', toolCalls: [], usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, raw: null, latencyMs: 100, modelId: "mock-model", finishReason: "stop" } satisfies ProviderResponse),
      estimateCost: vi.fn().mockReturnValue(null),
      supportsTools: vi.fn().mockReturnValue(false),
    };
    const assertion = createJudgeAssertion({ criteria: "Is helpful", minScore: 0.7 });
    const results = await assertion.evaluate(ctx("Output", adapter, true));
    expect(results[0]).toMatchObject({ passed: true, score: 0.9 });
  });

  it("includes betaJudge metadata with passes, successful, and scores", async () => {
    const adapter = mockAdapter('{"score": 0.8, "reasoning": "Good"}');
    const assertion = createJudgeAssertion({ criteria: "Is helpful", minScore: 0.7 });
    const results = await assertion.evaluate(ctx("Output", adapter, true));
    const meta = results[0]?.metadata as Record<string, unknown>;
    expect(meta?.betaJudge).toMatchObject({ passes: 3, successful: 3 });
    expect((meta?.betaJudge as { scores: number[] }).scores).toHaveLength(3);
  });

  it("calls adapter.complete exactly 3 times when betaJudge is true", async () => {
    const adapter = mockAdapter('{"score": 0.8, "reasoning": "Good"}');
    const assertion = createJudgeAssertion({ criteria: "Is helpful", minScore: 0.7 });
    await assertion.evaluate(ctx("Output", adapter, true));
    expect(adapter.complete).toHaveBeenCalledTimes(3);
  });

  it("calls adapter.complete exactly once when betaJudge is false", async () => {
    const adapter = mockAdapter('{"score": 0.8, "reasoning": "Good"}');
    const assertion = createJudgeAssertion({ criteria: "Is helpful", minScore: 0.7 });
    await assertion.evaluate(ctx("Output", adapter, false));
    expect(adapter.complete).toHaveBeenCalledTimes(1);
  });
});
