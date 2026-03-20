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
import type { CommandExecutor } from "./command.js";
import { parseCommandOutput } from "./command.js";

// ============================================================
// Public Types
// ============================================================

export interface RunnerDeps {
  adapters: Map<string, ProviderAdapter>;
  configDir: string;
  fileReader: FileReader;
  onProgress?: (event: ProgressEvent) => void;
  baselineData?: BaselineData;
  commandExecutor?: CommandExecutor;
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
  modelConfig: ModelConfig | null;
  runIndex: number;
}

export interface RunOptions {
  tags?: string[];
}

export function createRunner(
  config: KindLMConfig,
  deps: RunnerDeps,
  options?: RunOptions,
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
      const tagFilter = options?.tags;
      const units: ExecutionUnit[] = [];
      for (const test of config.tests) {
        if (test.skip) continue;

        // Skip tests that don't match the tag filter
        if (tagFilter && tagFilter.length > 0) {
          const testTags = test.tags ?? [];
          const hasMatch = tagFilter.some((t) => testTags.includes(t));
          if (!hasMatch) continue;
        }

        const repeat = test.repeat ?? config.defaults.repeat;

        if (test.command) {
          // Command tests run once per repeat, no model multiplication
          for (let runIndex = 0; runIndex < repeat; runIndex++) {
            units.push({ test, modelConfig: null, runIndex });
          }
        } else {
          const modelIds = test.models ?? config.models.map((m) => m.id);
          for (const modelId of modelIds) {
            const modelConfig = config.models.find((m) => m.id === modelId);
            if (!modelConfig) continue;

            for (let runIndex = 0; runIndex < repeat; runIndex++) {
              units.push({ test, modelConfig, runIndex });
            }
          }
        }
      }

      // 3. Execute with concurrency pool, tracking cumulative cost for mid-run budget enforcement.
      // With concurrency, there may be bounded overshoot — tests already in-flight when
      // the budget is exceeded will still complete. Since JS is single-threaded, the
      // shared mutable state check is safe (no race condition).
      let cumulativeCostUsd = 0;
      let budgetExceeded = false;
      const costBudget = config.gates?.costMaxUsd;

      const caseResults = await runWithConcurrency(
        units.map((unit) => async () => {
          if (budgetExceeded) {
            return budgetExceededResult(
              unit.test.name,
              unit.modelConfig?.id ?? "command",
              unit.runIndex,
              cumulativeCostUsd,
              costBudget ?? 0,
            );
          }

          const result = await executeUnit(config, deps, unit, schemaCache);

          if (result.costEstimateUsd !== null && result.costEstimateUsd !== undefined) {
            cumulativeCostUsd += result.costEstimateUsd;
            if (costBudget !== undefined && cumulativeCostUsd > costBudget) {
              budgetExceeded = true;
            }
          }

          return result;
        }),
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
        const aggResult = aggregateRuns(runs);
        if (!aggResult.success) {
          return err({
            code: "UNKNOWN_ERROR",
            message: aggResult.error,
          });
        }
        aggregated.push(aggResult.data);
      }

      // 5. Build TestRunResults from aggregated
      const testRunResults: TestRunResult[] = aggregated.map((agg) => {
        const status: TestRunResult["status"] = agg.errored
          ? "errored"
          : agg.passed
            ? "passed"
            : "failed";
        return {
          name: agg.testCaseName,
          modelId: agg.modelId,
          status,
          assertions: (agg.passed ? agg.runs[0] : agg.runs.find(r => !r.assertions.every(a => a.passed)) ?? agg.runs[0])?.assertions ?? [],
          latencyMs: agg.latencyAvgMs,
          costUsd: agg.totalCostUsd,
        };
      });

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

  if (test.command) {
    return executeCommandUnit(config, deps, test, runIndex, schemaCache);
  }

  if (!modelConfig) {
    return errorResult(test.name, "unknown", runIndex, "No model config for prompt-based test");
  }

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
    const promptDef = test.prompt ? config.prompts[test.prompt] : undefined;
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

    // Add assistant prefill if configured (Anthropic-style prefill)
    if (promptDef.assistant) {
      const assistantResult = interpolate(promptDef.assistant, test.vars);
      if (!assistantResult.success) {
        return errorResult(test.name, modelConfig.id, runIndex, assistantResult.error.message);
      }
      messages.push({ role: "assistant", content: assistantResult.data });
    }

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
      getEmbedding: adapter.embed
        ? ((fn) => (text: string) => fn(text))(adapter.embed)
        : undefined,
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

async function executeCommandUnit(
  config: KindLMConfig,
  deps: RunnerDeps,
  test: TestCase,
  runIndex: number,
  schemaCache: Map<string, Record<string, unknown>>,
): Promise<TestCaseRunResult> {
  const modelId = "command";

  deps.onProgress?.({
    type: "test_start",
    test: test.name,
    model: modelId,
    run: runIndex,
  });

  try {
    if (!deps.commandExecutor) {
      return errorResult(test.name, modelId, runIndex, "Command executor not available");
    }

    if (!test.command) {
      return errorResult(test.name, modelId, runIndex, "No command specified");
    }

    // Interpolate vars into command string
    const cmdResult = interpolate(test.command, test.vars);
    if (!cmdResult.success) {
      return errorResult(test.name, modelId, runIndex, cmdResult.error.message);
    }

    const startTime = Date.now();
    const execResult = await deps.commandExecutor.execute(cmdResult.data, {
      timeoutMs: config.defaults.timeoutMs,
      cwd: deps.configDir,
    });

    if (!execResult.success) {
      return errorResult(test.name, modelId, runIndex, execResult.error.message);
    }

    const latencyMs = Date.now() - startTime;
    const parsed = parseCommandOutput(execResult.data);

    // Build assertions
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
      outputText: parsed.outputText,
      outputJson: parsed.outputJson,
      toolCalls: parsed.toolCalls,
      configDir: deps.configDir,
      latencyMs,
      judgeAdapter,
      judgeModel: judgeModelConfig?.model,
      getEmbedding: judgeAdapter?.embed
        ? ((fn) => (text: string) => fn(text))(judgeAdapter.embed)
        : undefined,
    };

    // Inject baseline text for drift assertions
    if (deps.baselineData) {
      const baselineKey = `${test.name}::${modelId}`;
      const baselineEntry = deps.baselineData.results[baselineKey];
      if (baselineEntry) {
        context.baselineText = baselineEntry.outputText;
      }
    }

    // Evaluate all assertions
    const allResults: AssertionResult[] = [];
    for (const assertion of assertions) {
      const results = await assertion.evaluate(context);
      allResults.push(...results);
    }

    const allPassed = allResults.every((r) => r.passed);

    deps.onProgress?.({
      type: "test_complete",
      test: test.name,
      model: modelId,
      run: runIndex,
      passed: allPassed,
    });

    return {
      testCaseName: test.name,
      modelId,
      runIndex,
      outputText: parsed.outputText,
      assertions: allResults,
      latencyMs,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      costEstimateUsd: null,
    };
  } catch (e) {
    deps.onProgress?.({
      type: "test_complete",
      test: test.name,
      model: modelId,
      run: runIndex,
      passed: false,
    });

    return errorResult(
      test.name,
      modelId,
      runIndex,
      e instanceof Error ? e.message : String(e),
    );
  }
}

function budgetExceededResult(
  testCaseName: string,
  modelId: string,
  runIndex: number,
  cumulativeCostUsd: number,
  costBudget: number,
): TestCaseRunResult {
  return {
    testCaseName,
    modelId,
    runIndex,
    outputText: "",
    assertions: [
      {
        assertionType: "cost",
        label: "Budget exceeded",
        passed: false,
        score: 0,
        failureCode: "BUDGET_EXCEEDED",
        failureMessage: `Run budget exceeded: $${cumulativeCostUsd.toFixed(4)} > $${costBudget.toFixed(4)}`,
      },
    ],
    latencyMs: 0,
    tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    costEstimateUsd: 0,
  };
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
    errored: true,
  };
}

// ============================================================
// Concurrency Helper
// ============================================================

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = Array.from({ length: tasks.length }) as T[];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      const task = tasks[index];
      if (task === undefined) {
        throw new Error(`Task at index ${index} is undefined`);
      }
      results[index] = await task();
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
