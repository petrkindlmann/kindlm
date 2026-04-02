import { describe, it, expect } from "vitest";
import type { ModelPricing } from "./pricing.js";
import { lookupModelPricing, KINDLM_PRICING, estimateDryRunCost } from "./pricing.js";

const TABLE: Record<string, ModelPricing> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-sonnet": { input: 3, output: 15 },
  "claude-haiku": { input: 0.25, output: 1.25 },
};

describe("lookupModelPricing", () => {
  it("returns exact match", () => {
    const result = lookupModelPricing("gpt-4o", TABLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matchType).toBe("exact");
    expect(result.matchedModel).toBe("gpt-4o");
    expect(result.price).toEqual({ input: 2.5, output: 10 });
  });

  it("returns prefix match for model with date suffix", () => {
    const result = lookupModelPricing("claude-sonnet-20250929", TABLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matchType).toBe("prefix");
    expect(result.matchedModel).toBe("claude-sonnet");
    expect(result.price).toEqual({ input: 3, output: 15 });
  });

  it("returns prefix match with colon separator", () => {
    const result = lookupModelPricing("gpt-4o:latest", TABLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matchType).toBe("prefix");
    expect(result.matchedModel).toBe("gpt-4o");
  });

  it("returns ok:false for ambiguous prefix (two matches)", () => {
    // "claude" is a prefix of both "claude-sonnet" and "claude-haiku"
    // but those keys themselves are the entries. Let's create ambiguity:
    const ambiguousTable: Record<string, ModelPricing> = {
      "model-a": { input: 1, output: 2 },
      "model-ab": { input: 3, output: 4 },
    };
    // "model-abc" starts with both "model-a-" (no) and "model-ab-" (no)
    // Need to find input that triggers multiple prefix matches
    // "model-a-v2" starts with "model-a-" which matches "model-a"
    const result = lookupModelPricing("model-a-v2", ambiguousTable);
    // Only "model-a" matches as prefix (model-a-v2 starts with "model-a-")
    expect(result.ok).toBe(true);

    // True ambiguous case: two keys where input starts with both followed by separator
    const ambiguous2: Record<string, ModelPricing> = {
      "gpt": { input: 1, output: 2 },
      "gpt-4": { input: 3, output: 4 },
    };
    // "gpt-4-turbo" starts with "gpt-" AND "gpt-4-"
    const result2 = lookupModelPricing("gpt-4-turbo", ambiguous2);
    expect(result2.ok).toBe(false);
  });

  it("returns ok:false when no match found", () => {
    const result = lookupModelPricing("llama-3-70b", TABLE);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for empty pricing table", () => {
    const result = lookupModelPricing("gpt-4o", {});
    expect(result.ok).toBe(false);
  });

  it("prefers exact match over prefix match", () => {
    const tableWithBoth: Record<string, ModelPricing> = {
      "gpt-4o": { input: 2.5, output: 10 },
      "gpt": { input: 1, output: 5 },
    };
    const result = lookupModelPricing("gpt-4o", tableWithBoth);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.matchType).toBe("exact");
    expect(result.matchedModel).toBe("gpt-4o");
  });
});

describe("KINDLM_PRICING", () => {
  it("contains gpt-4o with correct output price", () => {
    expect(KINDLM_PRICING["gpt-4o"]).toEqual({ input: 2.5, output: 10.0 });
  });

  it("contains gpt-4o-mini", () => {
    expect(KINDLM_PRICING["gpt-4o-mini"]).toBeDefined();
  });

  it("contains claude-sonnet-4-5-20250929", () => {
    expect(KINDLM_PRICING["claude-sonnet-4-5-20250929"]).toBeDefined();
  });

  it("contains gemini-2.0-flash", () => {
    expect(KINDLM_PRICING["gemini-2.0-flash"]).toBeDefined();
  });
});

describe("estimateDryRunCost", () => {
  it("returns correct cost for gpt-4o with 1024 tokens, repeat=1", () => {
    // (1024 / 1_000_000) * 10.0 * 1 = 0.01024
    const result = estimateDryRunCost("gpt-4o", 1024, 1);
    expect(result).toBeCloseTo(0.01024, 10);
  });

  it("scales linearly with repeat", () => {
    const single = estimateDryRunCost("gpt-4o", 1024, 1);
    const triple = estimateDryRunCost("gpt-4o", 1024, 3);
    expect(triple).toBeCloseTo((single ?? 0) * 3, 10);
  });

  it("returns null for unknown model", () => {
    expect(estimateDryRunCost("unknown-model-xyz", 1024, 1)).toBeNull();
  });

  it("returns null for command modelId", () => {
    expect(estimateDryRunCost("command", 1024, 1)).toBeNull();
  });

  it("returns correct value for gpt-4o with repeat=3", () => {
    // (1024/1_000_000) * 10.0 * 3 = 0.03072
    const result = estimateDryRunCost("gpt-4o", 1024, 3);
    expect(result).toBeCloseTo(0.03072, 10);
  });
});
