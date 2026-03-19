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
): AssertionContext {
  return {
    outputText,
    toolCalls: [],
    configDir: "/tmp",
    judgeAdapter: adapter,
    judgeModel: adapter ? "mock-model" : undefined,
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

  it("includes reasoning in metadata", async () => {
    const adapter = mockAdapter('{"score": 0.9, "reasoning": "Very clear"}');
    const assertion = createJudgeAssertion({
      criteria: "Is clear",
      minScore: 0.5,
    });
    const results = await assertion.evaluate(ctx("Output", adapter));
    expect(results[0]?.metadata).toEqual({ reasoning: "Very clear" });
  });
});
