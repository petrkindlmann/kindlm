import type { Reporter, ReporterOutput } from "./interface.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

export function createJsonReporter(version?: string): Reporter {
  return {
    name: "json",
    async generate(runResult: RunResult, gateEvaluation: GateEvaluation): Promise<ReporterOutput> {
      const report = {
        kindlm: {
          version: version ?? "0.0.0",
          timestamp: new Date().toISOString(),
        },
        summary: {
          totalTests: runResult.totalTests,
          passed: runResult.passed,
          failed: runResult.failed,
          errored: runResult.errored,
          skipped: runResult.skipped,
          durationMs: runResult.durationMs,
        },
        gates: {
          passed: gateEvaluation.passed,
          results: gateEvaluation.gates,
        },
        suites: runResult.suites.map((suite) => ({
          name: suite.name,
          status: suite.status,
          tests: suite.tests.map((test) => ({
            name: test.name,
            modelId: test.modelId,
            status: test.status,
            assertions: test.assertions.map((a) => ({
              ...a,
              ...(a.metadata?.turnLabel ? { turnLabel: a.metadata.turnLabel } : {}),
            })),
            latencyMs: test.latencyMs,
            costUsd: test.costUsd,
            // Statistical fields (additive; present only for executed tests).
            ...(test.runCount !== undefined && {
              runCount: test.runCount,
              passRate: test.passRate,
              passK: test.passK,
              passAtK: test.passAtK,
              passRateCI: test.passRateCI,
              latency: test.latency,
              efficiency: test.efficiency,
            }),
          })),
        })),
      };

      return { content: JSON.stringify(report, null, 2), format: "json" };
    },
  };
}
