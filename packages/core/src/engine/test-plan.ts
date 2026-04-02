import type { KindLMConfig, TestCase, ModelConfig } from "../types/config.js";
import { estimateDryRunCost } from "../providers/pricing.js";

// ============================================================
// Test Plan Types
// ============================================================

export interface TestPlanEntry {
  testName: string;
  modelId: string;
  provider: string;
  repeat: number;
  assertionTypes: string[];
  isCommand: boolean;
  skip: boolean;
  tags: string[];
  estimatedCostUsd: number | null;
}

export interface TestPlan {
  suiteName: string;
  suiteDescription: string | undefined;
  project: string;
  entries: TestPlanEntry[];
  totalExecutionUnits: number;
  concurrency: number;
  timeoutMs: number;
  totalEstimatedCostUsd: number | null;
}

// ============================================================
// Build Test Plan (pure function - zero I/O)
// ============================================================

/** Extracts assertion type labels from a test case's expect config. */
function extractAssertionTypes(test: TestCase): string[] {
  const types: string[] = [];
  const expect = test.expect;

  if (expect.output) {
    if (expect.output.contains || expect.output.notContains) types.push("keywords");
    if (expect.output.format === "json" && expect.output.schemaFile) types.push("schema");
    if (expect.output.maxLength) types.push("maxLength");
  }
  if (expect.guardrails?.pii) types.push("pii");
  if (expect.guardrails?.keywords) types.push("keywords");
  if (expect.judge && expect.judge.length > 0) types.push("judge");
  if (expect.toolCalls && expect.toolCalls.length > 0) types.push("toolCalls");
  if (expect.baseline?.drift) types.push("drift");
  if (expect.latency) types.push("latency");
  if (expect.cost) types.push("cost");

  return types;
}

/**
 * Builds a test plan from a validated config without making any API calls.
 * Used by --dry-run to show what would execute, and for cache key computation.
 */
export function buildTestPlan(
  config: KindLMConfig,
  tagFilter?: string[],
): TestPlan {
  const entries: TestPlanEntry[] = [];
  let totalExecutionUnits = 0;

  for (const test of config.tests) {
    const assertionTypes = extractAssertionTypes(test);
    const repeat = test.repeat ?? config.defaults.repeat;
    const tags = test.tags ?? [];

    if (test.skip) {
      entries.push({
        testName: test.name,
        modelId: "",
        provider: "",
        repeat: 0,
        assertionTypes,
        isCommand: !!test.command,
        skip: true,
        tags,
        estimatedCostUsd: null,
      });
      continue;
    }

    // Apply tag filter
    if (tagFilter && tagFilter.length > 0) {
      const hasMatch = tagFilter.some((t) => tags.includes(t));
      if (!hasMatch) continue;
    }

    if (test.command) {
      entries.push({
        testName: test.name,
        modelId: "command",
        provider: "shell",
        repeat,
        assertionTypes,
        isCommand: true,
        skip: false,
        tags,
        estimatedCostUsd: null,
      });
      totalExecutionUnits += repeat;
    } else {
      const modelIds = test.models ?? config.models.map((m: ModelConfig) => m.id);
      for (const modelId of modelIds) {
        const modelConfig = config.models.find((m: ModelConfig) => m.id === modelId);
        if (!modelConfig) continue;

        const maxTokens = modelConfig.params.maxTokens ?? 1024;
        entries.push({
          testName: test.name,
          modelId: modelConfig.id,
          provider: modelConfig.provider,
          repeat,
          assertionTypes,
          isCommand: false,
          skip: false,
          tags,
          estimatedCostUsd: estimateDryRunCost(modelConfig.id, maxTokens, repeat),
        });
        totalExecutionUnits += repeat;
      }
    }
  }

  const pricedCosts = entries
    .filter((e) => !e.skip && e.estimatedCostUsd !== null)
    .map((e) => e.estimatedCostUsd as number);

  const totalEstimatedCostUsd =
    pricedCosts.length === 0 ? null : pricedCosts.reduce((sum, c) => sum + c, 0);

  return {
    suiteName: config.suite.name,
    suiteDescription: config.suite.description,
    project: config.project,
    entries,
    totalExecutionUnits,
    concurrency: config.defaults.concurrency,
    timeoutMs: config.defaults.timeoutMs,
    totalEstimatedCostUsd,
  };
}
