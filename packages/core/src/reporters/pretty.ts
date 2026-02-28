import type { Colorize, Reporter, ReporterOutput } from "./interface.js";
import { noColor } from "./interface.js";
import type { RunResult, SuiteRunResult, TestRunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

export function createPrettyReporter(colorize: Colorize = noColor): Reporter {
  return {
    name: "pretty",
    generate(runResult: RunResult, gateEvaluation: GateEvaluation): ReporterOutput {
      const lines: string[] = [];
      const c = colorize;

      lines.push("");
      lines.push(c.bold("  KindLM Test Results"));
      lines.push("");

      for (const suite of runResult.suites) {
        lines.push(formatSuite(suite, c));
        for (const test of suite.tests) {
          lines.push(formatTest(test, c));
          for (const a of test.assertions) {
            if (!a.passed) {
              lines.push(`      ${c.red("✗")} ${c.dim(a.label)}: ${a.failureMessage ?? "failed"}`);
            }
          }
        }
        lines.push("");
      }

      // Summary
      lines.push(c.bold("  Summary"));
      const passStr = c.green(`${runResult.passed} passed`);
      const failStr =
        runResult.failed > 0
          ? c.red(`${runResult.failed} failed`)
          : `${runResult.failed} failed`;
      const errorStr =
        runResult.errored > 0
          ? c.yellow(`${runResult.errored} errored`)
          : `${runResult.errored} errored`;
      lines.push(`    ${passStr}, ${failStr}, ${errorStr} (${runResult.totalTests} total)`);
      lines.push(`    Duration: ${formatDuration(runResult.durationMs)}`);
      lines.push("");

      // Gates
      if (gateEvaluation.gates.length > 0) {
        lines.push(c.bold("  Quality Gates"));
        for (const gate of gateEvaluation.gates) {
          const icon = gate.passed ? c.green("✓") : c.red("✗");
          lines.push(`    ${icon} ${gate.message}`);
        }
        lines.push("");
      }

      // Verdict
      const allPassed = runResult.failed === 0 && runResult.errored === 0 && gateEvaluation.passed;
      if (allPassed) {
        lines.push(c.greenBold("  ✓ All tests passed"));
      } else {
        lines.push(c.redBold("  ✗ Some tests failed"));
      }
      lines.push("");

      return { content: lines.join("\n"), format: "text" };
    },
  };
}

function formatSuite(suite: SuiteRunResult, c: Colorize): string {
  const icon =
    suite.status === "passed"
      ? c.green("✓")
      : suite.status === "skipped"
        ? c.yellow("○")
        : c.red("✗");
  return `  ${icon} ${c.bold(suite.name)}`;
}

function formatTest(test: TestRunResult, c: Colorize): string {
  const icon =
    test.status === "passed"
      ? c.green("✓")
      : test.status === "skipped"
        ? c.yellow("○")
        : c.red("✗");
  return `    ${icon} ${test.name}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
