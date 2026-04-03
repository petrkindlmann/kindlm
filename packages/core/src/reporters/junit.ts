import type { Reporter, ReporterOutput } from "./interface.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

export function createJunitReporter(): Reporter {
  return {
    name: "junit",
    async generate(runResult: RunResult, gateEvaluation: GateEvaluation): Promise<ReporterOutput> {
      const totalTime = runResult.durationMs / 1000;
      const lines: string[] = [];

      lines.push('<?xml version="1.0" encoding="UTF-8"?>');
      lines.push(
        `<testsuites name="KindLM" tests="${runResult.totalTests}" failures="${runResult.failed}" errors="${runResult.errored}" time="${totalTime.toFixed(3)}">`,
      );

      for (const suite of runResult.suites) {
        const suiteFailures = suite.tests.filter(
          (t) => t.status === "failed",
        ).length;
        const suiteErrors = suite.tests.filter(
          (t) => t.status === "errored",
        ).length;
        const suiteTime =
          suite.tests.reduce((s, t) => s + t.latencyMs, 0) / 1000;

        lines.push(
          `  <testsuite name="${esc(suite.name)}" tests="${suite.tests.length}" failures="${suiteFailures}" errors="${suiteErrors}" time="${suiteTime.toFixed(3)}">`,
        );

        for (const test of suite.tests) {
          const testTime = test.latencyMs / 1000;
          lines.push(
            `    <testcase name="${esc(test.name)}" classname="${esc(suite.name)}" time="${testTime.toFixed(3)}">`,
          );

          if (test.status === "skipped") {
            lines.push("      <skipped/>");
          } else if (test.status === "errored" && test.error) {
            lines.push(
              `      <error message="${esc(test.error.message)}" type="${esc(test.error.code)}">${esc(test.error.message)}</error>`,
            );
          } else if (test.status === "failed") {
            const failedAssertions = test.assertions.filter(
              (a) => !a.passed,
            );
            for (const a of failedAssertions) {
              const turnLabel = a.metadata?.turnLabel as string | undefined;
              const labelPrefix = turnLabel ? `[Turn: ${turnLabel}] ` : "";
              lines.push(
                `      <failure message="${esc(`${labelPrefix}${a.label}`)}" type="${esc(a.failureCode ?? "ASSERTION_FAILED")}">${esc(a.failureMessage ?? "Assertion failed")}</failure>`,
              );
            }
          }

          lines.push("    </testcase>");
        }

        lines.push("  </testsuite>");
      }

      // Quality gates as a separate test suite
      if (gateEvaluation.gates.length > 0) {
        const gateFailures = gateEvaluation.gates.filter(
          (g) => !g.passed,
        ).length;
        lines.push(
          `  <testsuite name="Quality Gates" tests="${gateEvaluation.gates.length}" failures="${gateFailures}" errors="0" time="0.000">`,
        );
        for (const gate of gateEvaluation.gates) {
          lines.push(
            `    <testcase name="${esc(gate.gateName)}" classname="Quality Gates" time="0.000">`,
          );
          if (!gate.passed) {
            lines.push(
              `      <failure message="${esc(gate.message)}" type="GATE_FAILED">${esc(gate.message)}</failure>`,
            );
          }
          lines.push("    </testcase>");
        }
        lines.push("  </testsuite>");
      }

      lines.push("</testsuites>");

      return { content: lines.join("\n"), format: "xml" };
    },
  };
}

function esc(s: string): string {
  // Strip XML-illegal control characters (U+0000-U+0008, U+000B, U+000C, U+000E-U+001F, U+FFFE, U+FFFF)
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
