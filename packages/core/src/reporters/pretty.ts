import chalk from "chalk";
import type { Reporter, ReporterOutput } from "./interface.js";
import type { RunResult, SuiteRunResult, TestRunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

export function createPrettyReporter(): Reporter {
  return {
    name: "pretty",
    generate(runResult: RunResult, gateEvaluation: GateEvaluation): ReporterOutput {
      const lines: string[] = [];

      lines.push("");
      lines.push(chalk.bold("  KindLM Test Results"));
      lines.push("");

      for (const suite of runResult.suites) {
        lines.push(formatSuite(suite));
        for (const test of suite.tests) {
          lines.push(formatTest(test));
          for (const a of test.assertions) {
            if (!a.passed) {
              lines.push(`      ${chalk.red("✗")} ${chalk.dim(a.label)}: ${a.failureMessage ?? "failed"}`);
            }
          }
        }
        lines.push("");
      }

      // Summary
      lines.push(chalk.bold("  Summary"));
      const passStr = chalk.green(`${runResult.passed} passed`);
      const failStr =
        runResult.failed > 0
          ? chalk.red(`${runResult.failed} failed`)
          : `${runResult.failed} failed`;
      const errorStr =
        runResult.errored > 0
          ? chalk.yellow(`${runResult.errored} errored`)
          : `${runResult.errored} errored`;
      lines.push(`    ${passStr}, ${failStr}, ${errorStr} (${runResult.totalTests} total)`);
      lines.push(`    Duration: ${formatDuration(runResult.durationMs)}`);
      lines.push("");

      // Gates
      if (gateEvaluation.gates.length > 0) {
        lines.push(chalk.bold("  Quality Gates"));
        for (const gate of gateEvaluation.gates) {
          const icon = gate.passed ? chalk.green("✓") : chalk.red("✗");
          lines.push(`    ${icon} ${gate.message}`);
        }
        lines.push("");
      }

      // Verdict
      const allPassed = runResult.failed === 0 && runResult.errored === 0 && gateEvaluation.passed;
      if (allPassed) {
        lines.push(chalk.green.bold("  ✓ All tests passed"));
      } else {
        lines.push(chalk.red.bold("  ✗ Some tests failed"));
      }
      lines.push("");

      return { content: lines.join("\n"), format: "text" };
    },
  };
}

function formatSuite(suite: SuiteRunResult): string {
  const icon =
    suite.status === "passed"
      ? chalk.green("✓")
      : suite.status === "skipped"
        ? chalk.yellow("○")
        : chalk.red("✗");
  return `  ${icon} ${chalk.bold(suite.name)}`;
}

function formatTest(test: TestRunResult): string {
  const icon =
    test.status === "passed"
      ? chalk.green("✓")
      : test.status === "skipped"
        ? chalk.yellow("○")
        : chalk.red("✗");
  return `    ${icon} ${test.name}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
