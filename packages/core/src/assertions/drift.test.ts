import { describe, it, expect, vi } from "vitest";
import type { AssertionContext } from "./interface.js";
import type { ProviderAdapter, ProviderResponse } from "../types/provider.js";
import { createDriftAssertion } from "./drift.js";

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
  baselineText?: string,
  adapter?: ProviderAdapter,
): AssertionContext {
  return {
    outputText,
    toolCalls: [],
    configDir: "/tmp",
    baselineText,
    judgeAdapter: adapter,
    judgeModel: adapter ? "mock-model" : undefined,
  };
}

describe("createDriftAssertion", () => {
  it("passes when no baseline available", async () => {
    const assertion = createDriftAssertion({
      maxScore: 0.15,
      method: "judge",
    });
    const results = await assertion.evaluate(ctx("New output"));
    expect(results[0]).toMatchObject({ passed: true });
    expect((results[0]?.metadata as Record<string, unknown>)?.reason).toBe(
      "No baseline available",
    );
  });

  describe("judge method", () => {
    it("passes when drift is low", async () => {
      const adapter = mockAdapter(
        '{"driftScore": 0.05, "reasoning": "Very similar"}',
      );
      const assertion = createDriftAssertion({
        maxScore: 0.15,
        method: "judge",
      });
      const results = await assertion.evaluate(
        ctx("New output", "Old output", adapter),
      );
      expect(results[0]).toMatchObject({ passed: true });
      expect(results[0]?.score).toBeCloseTo(0.95);
    });

    it("fails when drift exceeds threshold", async () => {
      const adapter = mockAdapter(
        '{"driftScore": 0.8, "reasoning": "Very different"}',
      );
      const assertion = createDriftAssertion({
        maxScore: 0.15,
        method: "judge",
      });
      const results = await assertion.evaluate(
        ctx("New output", "Old output", adapter),
      );
      expect(results[0]).toMatchObject({
        passed: false,
        failureCode: "DRIFT_EXCEEDED",
      });
    });
  });

  describe("field-diff method", () => {
    it("passes when fields match", async () => {
      const assertion = createDriftAssertion({
        maxScore: 0.5,
        method: "field-diff",
        fields: ["action", "status"],
      });
      const baseline = JSON.stringify({ action: "refund", status: "ok" });
      const output = JSON.stringify({ action: "refund", status: "ok" });
      const results = await assertion.evaluate(ctx(output, baseline));
      expect(results[0]).toMatchObject({ passed: true, score: 1 });
    });

    it("fails when fields differ", async () => {
      const assertion = createDriftAssertion({
        maxScore: 0.3,
        method: "field-diff",
        fields: ["action", "status"],
      });
      const baseline = JSON.stringify({ action: "refund", status: "ok" });
      const output = JSON.stringify({ action: "deny", status: "error" });
      const results = await assertion.evaluate(ctx(output, baseline));
      expect(results[0]).toMatchObject({
        passed: false,
        failureCode: "DRIFT_EXCEEDED",
      });
    });
  });

  describe("embedding method", () => {
    it("returns pass with stub message", async () => {
      const assertion = createDriftAssertion({
        maxScore: 0.15,
        method: "embedding",
      });
      const results = await assertion.evaluate(
        ctx("New output", "Old output"),
      );
      expect(results[0]).toMatchObject({ passed: true });
      expect((results[0]?.metadata as Record<string, unknown>)?.reason).toBe(
        "Embedding method not yet implemented",
      );
    });
  });
});
