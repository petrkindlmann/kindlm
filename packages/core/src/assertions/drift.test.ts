import { describe, it, expect, vi } from "vitest";
import type { AssertionContext } from "./interface.js";
import type { ProviderAdapter, ProviderResponse } from "../types/provider.js";
import { createDriftAssertion, cosineSimilarity } from "./drift.js";

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
  getEmbedding?: (text: string) => Promise<number[]>,
): AssertionContext {
  return {
    outputText,
    toolCalls: [],
    configDir: "/tmp",
    baselineText,
    judgeAdapter: adapter,
    judgeModel: adapter ? "mock-model" : undefined,
    getEmbedding,
  };
}

describe("createDriftAssertion", () => {
  it("fails when no baseline available", async () => {
    const assertion = createDriftAssertion({
      maxScore: 0.15,
      method: "judge",
    });
    const results = await assertion.evaluate(ctx("New output"));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "DRIFT_EXCEEDED",
    });
    expect(results[0]?.failureMessage).toContain("No baseline available");
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
    it("fails with INTERNAL_ERROR when getEmbedding is not provided", async () => {
      const assertion = createDriftAssertion({
        maxScore: 0.15,
        method: "embedding",
      });
      const results = await assertion.evaluate(
        ctx("New output", "Old output"),
      );
      expect(results[0]).toMatchObject({
        passed: false,
        score: 0,
        failureCode: "INTERNAL_ERROR",
      });
      expect(results[0]?.failureMessage).toContain("getEmbedding");
    });

    it("passes when embeddings are similar (low drift)", async () => {
      const getEmbedding = vi.fn()
        .mockResolvedValueOnce([1, 0, 0])   // baseline
        .mockResolvedValueOnce([0.98, 0.1, 0.05]); // output (very similar)

      const assertion = createDriftAssertion({
        maxScore: 0.15,
        method: "embedding",
      });
      const results = await assertion.evaluate(
        ctx("New output", "Old output", undefined, getEmbedding),
      );
      expect(results[0]?.passed).toBe(true);
      expect(results[0]?.score).toBeGreaterThan(0.9);
      expect(getEmbedding).toHaveBeenCalledTimes(2);
      expect(getEmbedding).toHaveBeenCalledWith("Old output");
      expect(getEmbedding).toHaveBeenCalledWith("New output");
    });

    it("fails when embeddings diverge (high drift)", async () => {
      const getEmbedding = vi.fn()
        .mockResolvedValueOnce([1, 0, 0])   // baseline
        .mockResolvedValueOnce([0, 1, 0]);  // output (orthogonal)

      const assertion = createDriftAssertion({
        maxScore: 0.15,
        method: "embedding",
      });
      const results = await assertion.evaluate(
        ctx("New output", "Old output", undefined, getEmbedding),
      );
      expect(results[0]).toMatchObject({
        passed: false,
        failureCode: "DRIFT_EXCEEDED",
      });
      expect(results[0]?.score).toBeCloseTo(0);
      const meta = results[0]?.metadata as Record<string, unknown>;
      expect(meta?.driftScore).toBeCloseTo(1);
      expect(meta?.similarity).toBeCloseTo(0);
    });

    it("passes with identical embeddings (zero drift)", async () => {
      const getEmbedding = vi.fn()
        .mockResolvedValue([0.5, 0.3, 0.8]);

      const assertion = createDriftAssertion({
        maxScore: 0.01,
        method: "embedding",
      });
      const results = await assertion.evaluate(
        ctx("Same output", "Same output", undefined, getEmbedding),
      );
      expect(results[0]?.passed).toBe(true);
      expect(results[0]?.score).toBeCloseTo(1);
      const meta = results[0]?.metadata as Record<string, unknown>;
      expect(meta?.driftScore).toBeCloseTo(0);
    });

    it("reports metadata with driftScore, similarity, and threshold", async () => {
      const getEmbedding = vi.fn()
        .mockResolvedValueOnce([1, 0])
        .mockResolvedValueOnce([0.7071, 0.7071]); // 45-degree angle → similarity ~0.707

      const assertion = createDriftAssertion({
        maxScore: 0.5,
        method: "embedding",
      });
      const results = await assertion.evaluate(
        ctx("B", "A", undefined, getEmbedding),
      );
      const meta = results[0]?.metadata as Record<string, unknown>;
      expect(meta).toHaveProperty("driftScore");
      expect(meta).toHaveProperty("similarity");
      expect(meta?.threshold).toBe(0.5);
    });
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it("returns 0 for zero vector", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("handles normalized vectors", () => {
    const a = [1 / Math.sqrt(2), 1 / Math.sqrt(2)];
    const b = [1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1 / Math.sqrt(2));
  });
});
