import type { Reporter, ReporterOutput } from "./interface.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function createComplianceReporter(): Reporter {
  return {
    name: "compliance",
    async generate(runResult: RunResult, gateEvaluation: GateEvaluation): Promise<ReporterOutput> {
      const timestamp = new Date().toISOString();
      const sections: string[] = [];

      sections.push("# EU AI Act — Annex IV Compliance Report");
      sections.push("");
      sections.push(`**Generated:** ${timestamp}`);
      sections.push(`**Framework:** EU AI Act (Regulation 2024/1689)`);
      sections.push(`**Tool:** KindLM v1.0.0`);
      sections.push("");

      // Article 9 — Risk Management
      sections.push("## Article 9 — Risk Management System");
      sections.push("");
      sections.push("Testing demonstrates ongoing risk identification and mitigation through automated behavioral regression tests.");
      sections.push("");
      sections.push(formatGateEvidence(gateEvaluation, ["passRateMin"]));

      // Article 10 — Data and Data Governance
      sections.push("## Article 10 — Data and Data Governance");
      sections.push("");
      sections.push("PII detection guardrails verify that personal data is not exposed in AI system outputs.");
      sections.push("");
      sections.push(formatGateEvidence(gateEvaluation, ["piiFailuresMax", "keywordFailuresMax"]));

      // Article 12 — Record-Keeping / Logging
      sections.push("## Article 12 — Record-Keeping");
      sections.push("");
      sections.push("### Test Execution Log");
      sections.push("");
      sections.push(`| Metric | Value |`);
      sections.push(`|--------|-------|`);
      sections.push(`| Total Tests | ${runResult.totalTests} |`);
      sections.push(`| Passed | ${runResult.passed} |`);
      sections.push(`| Failed | ${runResult.failed} |`);
      sections.push(`| Errored | ${runResult.errored} |`);
      sections.push(`| Duration | ${runResult.durationMs}ms |`);
      sections.push("");
      sections.push("### Suite Results");
      sections.push("");
      for (const suite of runResult.suites) {
        sections.push(`**${suite.name}** — ${suite.status}`);
        for (const test of suite.tests) {
          const icon = test.status === "passed" ? "PASS" : "FAIL";
          sections.push(`- [${icon}] ${test.name}`);
        }
        sections.push("");
      }

      // Article 13 — Transparency
      sections.push("## Article 13 — Transparency and Provision of Information");
      sections.push("");
      sections.push("This report provides transparent documentation of AI system testing methodology, results, and quality gate evaluations as required under Article 13.");
      sections.push("");
      sections.push(formatGateEvidence(gateEvaluation, ["judgeAvgMin", "driftScoreMax"]));

      // Article 15 — Accuracy, Robustness and Cybersecurity
      sections.push("## Article 15 — Accuracy, Robustness and Cybersecurity");
      sections.push("");
      sections.push("Schema validation and behavioral assertions verify output accuracy and robustness.");
      sections.push("");
      sections.push(formatGateEvidence(gateEvaluation, ["schemaFailuresMax", "costMaxUsd", "latencyMaxMs"]));

      // Gate Summary
      sections.push("## Quality Gate Summary");
      sections.push("");
      sections.push(`| Gate | Result | Actual | Threshold |`);
      sections.push(`|------|--------|--------|-----------|`);
      for (const gate of gateEvaluation.gates) {
        const result = gate.passed ? "PASS" : "FAIL";
        sections.push(`| ${gate.gateName} | ${result} | ${fmtNum(gate.actual)} | ${fmtNum(gate.threshold)} |`);
      }
      sections.push("");

      const verdict = gateEvaluation.passed ? "PASS" : "FAIL";
      sections.push(`**Overall Verdict:** ${verdict}`);
      sections.push("");

      // Hash — computed over everything above
      const contentAboveHash = sections.join("\n");
      const hash = await sha256Hex(contentAboveHash);

      sections.push("---");
      sections.push(`**Tamper Evidence Hash (SHA-256):** \`${hash}\``);
      sections.push("");

      return { content: sections.join("\n"), format: "markdown" };
    },
  };
}

function formatGateEvidence(
  gateEvaluation: GateEvaluation,
  gateNames: string[],
): string {
  const relevant = gateEvaluation.gates.filter((g) =>
    gateNames.includes(g.gateName),
  );
  if (relevant.length === 0) return "";

  const lines: string[] = [];
  lines.push("**Gate Evidence:**");
  for (const gate of relevant) {
    const icon = gate.passed ? "PASS" : "FAIL";
    lines.push(`- [${icon}] ${gate.message}`);
  }
  lines.push("");
  return lines.join("\n");
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(4);
}
