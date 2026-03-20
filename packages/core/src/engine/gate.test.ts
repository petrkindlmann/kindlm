import { describe, it, expect } from "vitest";
import { evaluateGates } from "./gate.js";
import type { GatesConfig } from "../types/config.js";
import type { AggregatedTestResult } from "./aggregator.js";

function makeGatesConfig(overrides: Partial<GatesConfig> = {}): GatesConfig {
  return {
    passRateMin: 0.95,
    schemaFailuresMax: 0,
    piiFailuresMax: 0,
    keywordFailuresMax: 0,
    ...overrides,
  };
}

function makeResult(overrides: Partial<AggregatedTestResult> = {}): AggregatedTestResult {
  return {
    testCaseName: "test-1",
    modelId: "openai:gpt-4o",
    runCount: 1,
    passed: true,
    errored: false,
    passRate: 1,
    assertionScores: {},
    failureCodes: [],
    latencyAvgMs: 100,
    totalCostUsd: 0.01,
    totalTokens: 100,
    runs: [],
    ...overrides,
  };
}

describe("evaluateGates", () => {
  it("passes when all gates are met", () => {
    const config = makeGatesConfig();
    const results = [makeResult()];
    const evaluation = evaluateGates(config, results);
    expect(evaluation.passed).toBe(true);
    expect(evaluation.gates.every((g) => g.passed)).toBe(true);
  });

  it("fails when pass rate is below minimum", () => {
    const config = makeGatesConfig({ passRateMin: 0.9 });
    const results = [
      makeResult({ passRate: 0.5, runCount: 2 }),
    ];
    const evaluation = evaluateGates(config, results);
    const gate = evaluation.gates.find((g) => g.gateName === "passRateMin");
    expect(gate?.passed).toBe(false);
    expect(evaluation.passed).toBe(false);
  });

  it("fails when schema failures exceed limit", () => {
    const config = makeGatesConfig({ schemaFailuresMax: 0 });
    const results = [
      makeResult({
        failureCodes: ["SCHEMA_INVALID"],
        runs: [
          {
            testCaseName: "test-1",
            modelId: "openai:gpt-4o",
            runIndex: 0,
            outputText: "",
            assertions: [
              { assertionType: "schema", label: "schema", passed: false, score: 0, failureCode: "SCHEMA_INVALID" },
            ],
            latencyMs: 100,
            tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            costEstimateUsd: 0.01,
          },
        ],
      }),
    ];
    const evaluation = evaluateGates(config, results);
    const gate = evaluation.gates.find((g) => g.gateName === "schemaFailuresMax");
    expect(gate?.passed).toBe(false);
  });

  it("evaluates optional judgeAvgMin gate with composite keys", () => {
    const config = makeGatesConfig({ judgeAvgMin: 0.8 });
    const results = [
      makeResult({
        assertionScores: {
          "judge:Is empathetic": { mean: 0.6, min: 0.5, max: 0.7 },
          "judge:Is accurate": { mean: 0.7, min: 0.6, max: 0.8 },
        },
      }),
    ];
    const evaluation = evaluateGates(config, results);
    const gate = evaluation.gates.find((g) => g.gateName === "judgeAvgMin");
    expect(gate).toBeDefined();
    expect(gate?.passed).toBe(false);
    // Average of 0.6 and 0.7 = 0.65 < 0.8
    expect(gate?.actual).toBeCloseTo(0.65);
  });

  it("evaluates optional driftScoreMax gate with composite keys", () => {
    const config = makeGatesConfig({ driftScoreMax: 0.1 });
    const results = [
      makeResult({ assertionScores: { "drift:baseline comparison": { mean: 0.15, min: 0.1, max: 0.2 } } }),
    ];
    const evaluation = evaluateGates(config, results);
    const gate = evaluation.gates.find((g) => g.gateName === "driftScoreMax");
    expect(gate?.passed).toBe(false);
  });

  it("collects scores from both exact and prefixed assertion keys", () => {
    const config = makeGatesConfig({ judgeAvgMin: 0.7 });
    const results = [
      makeResult({
        assertionScores: {
          "judge": { mean: 0.8, min: 0.7, max: 0.9 },
          "judge:Is empathetic": { mean: 0.6, min: 0.5, max: 0.7 },
        },
      }),
    ];
    const evaluation = evaluateGates(config, results);
    const gate = evaluation.gates.find((g) => g.gateName === "judgeAvgMin");
    expect(gate).toBeDefined();
    // Average of 0.8 and 0.6 = 0.7
    expect(gate?.actual).toBeCloseTo(0.7);
    expect(gate?.passed).toBe(true);
  });

  it("evaluates pii and keyword failure gates", () => {
    const config = makeGatesConfig({ piiFailuresMax: 0, keywordFailuresMax: 1 });
    const results = [
      makeResult({
        failureCodes: ["PII_DETECTED", "KEYWORD_DENIED"],
        runs: [
          {
            testCaseName: "test-1",
            modelId: "openai:gpt-4o",
            runIndex: 0,
            outputText: "",
            assertions: [
              { assertionType: "pii", label: "pii", passed: false, score: 0, failureCode: "PII_DETECTED" },
              { assertionType: "keywords", label: "keywords", passed: false, score: 0, failureCode: "KEYWORD_DENIED" },
            ],
            latencyMs: 100,
            tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            costEstimateUsd: 0.01,
          },
        ],
      }),
    ];
    const evaluation = evaluateGates(config, results);
    const piiGate = evaluation.gates.find((g) => g.gateName === "piiFailuresMax");
    const kwGate = evaluation.gates.find((g) => g.gateName === "keywordFailuresMax");
    expect(piiGate?.passed).toBe(false);
    expect(kwGate?.passed).toBe(true);
  });

  it("evaluates optional costMaxUsd gate", () => {
    const config = makeGatesConfig({ costMaxUsd: 0.05 });
    const results = [
      makeResult({ totalCostUsd: 0.03 }),
      makeResult({ totalCostUsd: 0.04 }),
    ];
    const evaluation = evaluateGates(config, results);
    const gate = evaluation.gates.find((g) => g.gateName === "costMaxUsd");
    expect(gate?.passed).toBe(false);
    expect(gate?.actual).toBeCloseTo(0.07);
  });

  it("evaluates optional latencyMaxMs gate", () => {
    const config = makeGatesConfig({ latencyMaxMs: 500 });
    const results = [
      makeResult({ latencyAvgMs: 300 }),
      makeResult({ latencyAvgMs: 800 }),
    ];
    const evaluation = evaluateGates(config, results);
    const gate = evaluation.gates.find((g) => g.gateName === "latencyMaxMs");
    expect(gate?.passed).toBe(false);
    expect(gate?.actual).toBe(550);
  });
});
