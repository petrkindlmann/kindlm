import type { KindLMConfig, TestCase, ModelConfig } from "../types/config.js";
import type { Result, KindlmError } from "../types/result.js";
import { ok, err } from "../types/result.js";
import type { ProviderAdapter, ProviderRequest, ProviderMessage, ProviderToolDefinition } from "../providers/interface.js";
import type { FileReader } from "../config/parser.js";
import type { AssertionContext, AssertionResult } from "../assertions/interface.js";
import { createAssertionsFromExpect } from "../assertions/registry.js";
import type { AssertionOverrides } from "../assertions/registry.js";
import { interpolate } from "../config/interpolation.js";
import { runConversation } from "../providers/conversation.js";
import type { TestCaseRunResult, AggregatedTestResult } from "./aggregator.js";
import { aggregateRuns } from "./aggregator.js";
import type { BaselineData } from "../baseline/store.js";

// ============================================================
// Public Types
// ============================================================

export interface RunnerDeps {
  adapters: Map<string, ProviderAdapter>;
  configDir: string;
  fileReader: FileReader;
  onProgress?: (event: ProgressEvent) => void;
  baselineData?: BaselineData;
}

export type ProgressEvent =
  | { type: "test_start"; test: string; model: string; run: number }
  | { type: "test_complete"; test: string; model: string; run: number; passed: boolean };

export interface RunResult {
  suites: SuiteRunResult[];
  totalTests: number;
  passed: number;
  failed: number;
  errored: number;
  skipped: number;
  durationMs: number;
}

export interface SuiteRunResult {
  name: string;
  status: "passed" | "failed" | "errored" | "skipped";
  tests: TestRunResult[];
  error?: string;
}

export interface TestRunResult {
  name: string;
  modelId: string;
  status: "passed" | "failed" | "errored" | "skipped";
  assertions: AssertionResult[];
  error?: KindlmError;
  latencyMs: number;
  costUsd: number;
}

export interface RunnerResult {
  runResult: RunResult;
  aggregated: AggregatedTestResult[];
}

// ============================================================
// Runner Implementation
// ============================================================

interface ExecutionUnit {
  test: TestCase;
  modelConfig: ModelConfig;
  runIndex: number;
}

export function createRunner(
  config: KindLMConfig,
  deps: RunnerDeps,
): { run(): Promise<Result<RunnerResult>> } {
  return {
    async run(): Promise<Result<RunnerResult>> {
      const startTime = Date.now();

      // 1. Pre-load schema files
      const schemaCache = new Map<string, Record<string, unknown>>();
      for (const test of config.tests) {
        if (test.expect.output?.schemaFile) {
          const fullPath = joinPath(deps.configDir, test.expect.output.schemaFile);
          const readResult = deps.fileReader.readFile(fullPath);
          if (!readResult.success) {
            return err({
              code: "SCHEMA_FILE_ERROR",
              message: `Failed to read schema file "${test.expect.output.schemaFile}": ${readResult.error.message}`,
            });
          }
          try {
            schemaCache.set(test.name, JSON.parse(readResult.data) as Record<string, unknown>);
          } catch (e) {
            return err({
              code: "SCHEMA_FILE_ERROR",
              message: `Failed to parse schema file "${test.expect.output.schemaFile}" as JSON: ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }
      }

      // 2. Build execution plan
      const units: ExecutionUnit[] = [];
      for (const test of config.tests) {
        if (test.skip) continue;

        const modelIds = test.models ?? config.models.map((m) => m.id);
        const repeat = test.repeat ?? config.defaults.repeat;

        for (const modelId of modelIds) {
          const modelConfig = config.models.find((m) => m.id === modelId);
          if (!modelConfig) continue;

          for (let runIndex = 0; runIndex < repeat; runIndex++) {
            units.push({ test, modelConfig, runIndex });
          }
        }
      }

      // 3. Execute with concurrency pool
      const caseResults = await runWithConcurrency(
        units.map((unit) => () => executeUnit(config, deps, unit, schemaCache)),
        config.defaults.concurrency,
      );

      // 4. Group by (testName, modelId) and aggregate
      const groupKey = (r: TestCaseRunResult) => `${r.testCaseName}::${r.modelId}`;
      const groups = new Map<string, TestCaseRunResult[]>();
      for (const r of caseResults) {
        const key = groupKey(r);
        let arr = groups.get(key);
        if (!arr) {
          arr = [];
          groups.set(key, arr);
        }
        arr.push(r);
      }

      const aggregated: AggregatedTestResult[] = [];
      for (const runs of groups.values()) {
        aggregated.push(aggregateRuns(runs));
      }

      // 5. Build TestRunResults from aggregated
      const testRunResults: TestRunResult[] = aggregated.map((agg) => ({
        name: agg.testCaseName,
        modelId: agg.modelId,
        status: agg.passed ? "passed" as const : "failed" as const,
        assertions: agg.runs[0]?.assertions ?? [],
        latencyMs: agg.latencyAvgMs,
        costUsd: agg.totalCostUsd,
      }));

      // 6. Build skipped test results
      const skippedTests: TestRunResult[] = config.tests
        .filter((t) => t.skip)
        .map((t) => ({
          name: t.name,
          modelId: "",
          status: "skipped" as const,
          assertions: [],
          latencyMs: 0,
          costUsd: 0,
        }));

      const allTests = [...testRunResults, ...skippedTests];

      // 7. Build SuiteRunResult
      const passed = allTests.filter((t) => t.status === "passed").length;
      const failed = allTests.filter((t) => t.status === "failed").length;
      const errored = allTests.filter((t) => t.status === "errored").length;
      const skipped = allTests.filter((t) => t.status === "skipped").length;

      const suiteStatus: SuiteRunResult["status"] =
        errored > 0 ? "errored" : failed > 0 ? "failed" : "passed";

      const suiteResult: SuiteRunResult = {
        name: config.suite.name,
        status: suiteStatus,
        tests: allTests,
      };

      const runResult: RunResult = {
        suites: [suiteResult],
        totalTests: allTests.length,
        passed,
        failed,
        errored,
        skipped,
        durationMs: Date.now() - startTime,
      };

      return ok({ runResult, aggregated });
    },
  };
}

// ============================================================
// Execute a single test × model × run
// ============================================================

async function executeUnit(
  config: KindLMConfig,
  deps: RunnerDeps,
  unit: ExecutionUnit,
  schemaCache: Map<string, Record<string, unknown>>,
): Promise<TestCaseRunResult> {
  const { test, modelConfig, runIndex } = unit;

  deps.onProgress?.({
    type: "test_start",
    test: test.name,
    model: modelConfig.id,
    run: runIndex,
  });

  try {
    // Look up adapter
    const adapter = deps.adapters.get(modelConfig.provider);
    if (!adapter) {
      return errorResult(test.name, modelConfig.id, runIndex, `Provider adapter "${modelConfig.provider}" not found`);
    }

    // Resolve prompt
    const promptDef = config.prompts[test.prompt];
    if (!promptDef) {
      return errorResult(test.name, modelConfig.id, runIndex, `Prompt "${test.prompt}" not defined`);
    }

    const userResult = interpolate(promptDef.user, test.vars);
    if (!userResult.success) {
      return errorResult(test.name, modelConfig.id, runIndex, userResult.error.message);
    }

    const messages: ProviderMessage[] = [];
    if (promptDef.system) {
      const sysResult = interpolate(promptDef.system, test.vars);
      if (!sysResult.success) {
        return errorResult(test.name, modelConfig.id, runIndex, sysResult.error.message);
      }
      messages.push({ role: "system", content: sysResult.data });
    }
    messages.push({ role: "user", content: userResult.data });

    // Build tool definitions from simulations
    const tools: ProviderToolDefinition[] = (test.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const request: ProviderRequest = {
      model: modelConfig.model,
      messages,
      params: {
        temperature: modelConfig.params.temperature,
        maxTokens: modelConfig.params.maxTokens,
        topP: modelConfig.params.topP,
        stopSequences: modelConfig.params.stopSequences,
        seed: modelConfig.params.seed,
      },
      tools: tools.length > 0 ? tools : undefined,
    };

    // Run conversation
    const conversation = await runConversation(adapter, request, test.tools ?? []);

    // Compute cost
    const costEstimate = adapter.estimateCost(modelConfig.model, conversation.totalUsage);

    // Build assertions with schema content override
    const overrides: AssertionOverrides = {};
    if (test.expect.output?.schemaFile && schemaCache.has(test.name)) {
      overrides.schemaContent = schemaCache.get(test.name);
    }
    const assertions = createAssertionsFromExpect(test.expect, overrides);

    // Resolve judge adapter if needed
    const judgeModelId = config.defaults.judgeModel ?? config.models[0]?.id;
    const judgeModelConfig = config.models.find((m) => m.id === judgeModelId);
    const judgeAdapter = judgeModelConfig ? deps.adapters.get(judgeModelConfig.provider) : undefined;

    // Build assertion context
    const context: AssertionContext = {
      outputText: conversation.finalText,
      toolCalls: conversation.allToolCalls,
      configDir: deps.configDir,
      latencyMs: conversation.totalLatencyMs,
      costUsd: costEstimate ?? undefined,
      judgeAdapter,
      judgeModel: judgeModelConfig?.model,
    };

    // Inject baseline text for drift assertions
    if (deps.baselineData) {
      const baselineKey = `${test.name}::${modelConfig.id}`;
      const baselineEntry = deps.baselineData.results[baselineKey];
      if (baselineEntry) {
        context.baselineText = baselineEntry.outputText;
      }
    }

    // Evaluate all assertions
    const allResults = [];
    for (const assertion of assertions) {
      const results = await assertion.evaluate(context);
      allResults.push(...results);
    }

    const allPassed = allResults.every((r) => r.passed);

    deps.onProgress?.({
      type: "test_complete",
      test: test.name,
      model: modelConfig.id,
      run: runIndex,
      passed: allPassed,
    });

    return {
      testCaseName: test.name,
      modelId: modelConfig.id,
      runIndex,
      outputText: conversation.finalText,
      assertions: allResults,
      latencyMs: conversation.totalLatencyMs,
      tokenUsage: conversation.totalUsage,
      costEstimateUsd: costEstimate,
    };
  } catch (e) {
    deps.onProgress?.({
      type: "test_complete",
      test: test.name,
      model: modelConfig.id,
      run: runIndex,
      passed: false,
    });

    return errorResult(
      test.name,
      modelConfig.id,
      runIndex,
      e instanceof Error ? e.message : String(e),
    );
  }
}

function errorResult(
  testCaseName: string,
  modelId: string,
  runIndex: number,
  message: string,
): TestCaseRunResult {
  return {
    testCaseName,
    modelId,
    runIndex,
    outputText: "",
    assertions: [
      {
        assertionType: "internal",
        label: "Execution error",
        passed: false,
        score: 0,
        failureCode: "INTERNAL_ERROR",
        failureMessage: message,
      },
    ],
    latencyMs: 0,
    tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    costEstimateUsd: null,
  };
}

// ============================================================
// Concurrency Helper
// ============================================================

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      const task = tasks[index];
      if (task) results[index] = await task();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ============================================================
// Path Helper
// ============================================================

function joinPath(base: string, relative: string): string {
  if (relative.startsWith("/")) return relative;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/${relative}`;
}
