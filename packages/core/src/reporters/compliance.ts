import type { Reporter, ReporterOutput } from "./interface.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

// ============================================================
// Types
// ============================================================

export interface ComplianceRunMetadata {
  runId: string;
  kindlmVersion: string;
  gitCommitSha?: string;
  modelIds: string[];
  configHash?: string;
  systemName?: string;
  operator?: string;
  riskLevel?: string;
  intendedPurpose?: string;
}

// ============================================================
// Hashing helpers
// ============================================================

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, sortDeep(v)]);
    return Object.fromEntries(entries);
  }
  return value;
}

function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

// ============================================================
// Reporter
// ============================================================

export function createComplianceReporter(metadata?: ComplianceRunMetadata): Reporter {
  return {
    name: "compliance",
    async generate(runResult: RunResult, gateEvaluation: GateEvaluation): Promise<ReporterOutput> {
      const timestamp = new Date().toISOString();
      const versionLabel = metadata?.kindlmVersion ?? "unknown";
      const sections: string[] = [];

      sections.push("# EU AI Act — Annex IV Documentation Draft");
      sections.push("");
      sections.push(
        "> **Not legal advice.** This is an automatically generated *documentation draft* that maps " +
          "automated test and quality-gate results to selected EU AI Act articles. It does not constitute " +
          "legal advice, does not assert conformity, and does not replace a conformity assessment. See the " +
          "Limitations & Disclaimer section at the end before relying on this document.",
      );
      sections.push("");
      sections.push(`**Generated:** ${timestamp}`);
      sections.push(`**Framework:** EU AI Act (Regulation 2024/1689) — selected articles only`);
      sections.push(`**Tool:** KindLM v${versionLabel}`);
      if (metadata?.systemName) {
        sections.push(`**System Name:** ${metadata.systemName}`);
      }
      if (metadata?.operator) {
        sections.push(`**Operator:** ${metadata.operator}`);
      }
      if (metadata?.riskLevel) {
        sections.push(`**Risk Level:** ${metadata.riskLevel}`);
      }
      if (metadata?.intendedPurpose) {
        sections.push(`**Intended Purpose:** ${metadata.intendedPurpose}`);
      }
      sections.push("");

      // Article 9 — Risk Management
      sections.push("## Article 9 — Risk Management System");
      sections.push("");
      sections.push("Testing demonstrates ongoing risk identification and mitigation through automated behavioral regression tests.");
      sections.push("");
      sections.push(formatGateEvidence(gateEvaluation, ["passRateMin"]));

      // Article 10 — Output PII guardrail evidence (NOT full data governance)
      sections.push("## Article 10 — Output PII Guardrail Evidence");
      sections.push("");
      sections.push(
        "PII detection guardrails verify that personal data is not exposed in AI system *outputs* at runtime. " +
          "**Note:** Annex IV data-governance requirements (training-data provenance, quality, and bias controls) " +
          "are **out of scope** for KindLM and are NOT covered by this evidence.",
      );
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

      // Limitations & Disclaimer — mandated by 06-COMPLIANCE_SPEC.md. Included
      // ABOVE the tamper hash so it is covered by the hash and rendered into the
      // PDF; the report must never present itself as a legal/conformity artifact.
      sections.push("## Limitations & Disclaimer");
      sections.push("");
      sections.push(
        "This document is a **documentation aid**, not a legal compliance solution. It maps automated " +
          "behavioral test results to selected EU AI Act articles (9, 10, 12, 13, 15) and does **not** " +
          "cover the full Annex IV.",
      );
      sections.push("");
      sections.push("- It does **not** cover all Annex IV requirements (e.g., training-data governance, human-oversight processes).");
      sections.push("- It does **not** provide legal interpretation of the EU AI Act.");
      sections.push("- It does **not** replace a conformity assessment by notified bodies.");
      sections.push("- It **does** provide structured, timestamped, hashable test evidence.");
      sections.push("- It **does** map test results to relevant regulatory requirements.");
      sections.push("");
      sections.push(
        `*This report was generated automatically by KindLM v${versionLabel}. It does not constitute ` +
          "legal advice. Organizations should consult a qualified legal professional for EU AI Act " +
          "compliance interpretation, and the report should be reviewed before submission to regulatory authorities.*",
      );
      sections.push("");

      // Content hash — same results always produce the same hash (reproducibility)
      const contentAboveHash = sections.join("\n");
      const contentHash = await sha256Hex(contentAboveHash);

      // Run hash — unique per execution, includes metadata (traceability)
      const runHash = metadata
        ? await sha256Hex(canonicalize({ content: contentAboveHash, metadata }))
        : contentHash;

      sections.push("---");
      sections.push(`**Tamper Evidence Hash (SHA-256):** \`${contentHash}\``);
      sections.push(`**Run Identity Hash (SHA-256):** \`${runHash}\``);
      sections.push(`**Run ID:** ${metadata?.runId ?? "N/A"}`);
      sections.push(`**KindLM Version:** ${metadata?.kindlmVersion ?? "N/A"}`);
      sections.push(`**Git Commit:** ${metadata?.gitCommitSha ?? "N/A"}`);
      sections.push(`**Models:** ${metadata?.modelIds?.join(", ") ?? "N/A"}`);
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
