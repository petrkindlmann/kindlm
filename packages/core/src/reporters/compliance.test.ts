import { describe, it, expect } from "vitest";
import { createComplianceReporter } from "./compliance.js";
import type { ComplianceRunMetadata } from "./compliance.js";
import type { RunResult } from "../engine/runner.js";
import type { GateEvaluation } from "../engine/gate.js";

function makeRunResult(): RunResult {
  return {
    totalTests: 3,
    passed: 2,
    failed: 1,
    errored: 0,
    skipped: 0,
    durationMs: 2500,
    suites: [
      {
        name: "refund-agent",
        status: "failed",
        tests: [
          { name: "happy-path", modelId: "", status: "passed", assertions: [], latencyMs: 800, costUsd: 0.01 },
          { name: "edge-case", modelId: "", status: "passed", assertions: [], latencyMs: 700, costUsd: 0.01 },
          { name: "pii-leak", modelId: "", status: "failed", assertions: [], latencyMs: 500, costUsd: 0.005 },
        ],
      },
    ],
  };
}

function makeGateEval(): GateEvaluation {
  return {
    passed: false,
    gates: [
      { gateName: "passRateMin", passed: false, actual: 0.67, threshold: 0.95, message: "Pass rate 66.7% below minimum 95.0%" },
      { gateName: "schemaFailuresMax", passed: true, actual: 0, threshold: 0, message: "Schema failures 0 within limit 0" },
      { gateName: "piiFailuresMax", passed: false, actual: 1, threshold: 0, message: "PII failures 1 exceed limit 0" },
      { gateName: "keywordFailuresMax", passed: true, actual: 0, threshold: 0, message: "Keyword failures 0 within limit 0" },
    ],
  };
}

function makeMetadata(): ComplianceRunMetadata {
  return {
    runId: "run-abc123",
    kindlmVersion: "0.4.0",
    gitCommitSha: "deadbeef1234567890abcdef",
    modelIds: ["openai:gpt-4o", "anthropic:claude-sonnet-4-5-20250929"],
    configHash: "cfghash999",
  };
}

describe("createComplianceReporter", () => {
  it("generates markdown format", async () => {
    const reporter = createComplianceReporter(makeMetadata());
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.format).toBe("markdown");
  });

  it("includes all article sections", async () => {
    const reporter = createComplianceReporter(makeMetadata());
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Article 9");
    expect(output.content).toContain("Article 10");
    expect(output.content).toContain("Article 12");
    expect(output.content).toContain("Article 13");
    expect(output.content).toContain("Article 15");
  });

  it("includes SHA-256 tamper evidence hash", async () => {
    const reporter = createComplianceReporter(makeMetadata());
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Tamper Evidence Hash (SHA-256)");
    // SHA-256 hex is 64 characters
    const hashMatches = output.content.match(/`([a-f0-9]{64})`/g);
    expect(hashMatches).not.toBeNull();
    expect(hashMatches?.length).toBeGreaterThanOrEqual(2);
  });

  it("includes run identity hash separate from content hash", async () => {
    const reporter = createComplianceReporter(makeMetadata());
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Tamper Evidence Hash (SHA-256)");
    expect(output.content).toContain("Run Identity Hash (SHA-256)");

    // Extract both hashes
    const contentHashMatch = output.content.match(/Tamper Evidence Hash \(SHA-256\):\*\* `([a-f0-9]{64})`/);
    const runHashMatch = output.content.match(/Run Identity Hash \(SHA-256\):\*\* `([a-f0-9]{64})`/);
    expect(contentHashMatch).not.toBeNull();
    expect(runHashMatch).not.toBeNull();

    // With metadata, run hash should differ from content hash
    expect(contentHashMatch?.[1]).not.toBe(runHashMatch?.[1]);
  });

  it("includes metadata fields in the report footer", async () => {
    const meta = makeMetadata();
    const reporter = createComplianceReporter(meta);
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain(`**Run ID:** ${meta.runId}`);
    expect(output.content).toContain(`**KindLM Version:** ${meta.kindlmVersion}`);
    expect(output.content).toContain(`**Git Commit:** ${meta.gitCommitSha}`);
    expect(output.content).toContain("openai:gpt-4o, anthropic:claude-sonnet-4-5-20250929");
  });

  it("uses metadata version in the tool header", async () => {
    const reporter = createComplianceReporter(makeMetadata());
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("**Tool:** KindLM v0.4.0");
  });

  it("maps gate results to relevant articles", async () => {
    const reporter = createComplianceReporter(makeMetadata());
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    // PII gate should appear under Article 10
    const article10Section = output.content.split("## Article 10")[1]?.split("## Article 12")[0] ?? "";
    expect(article10Section).toContain("PII failures");
  });

  it("includes test execution log", async () => {
    const reporter = createComplianceReporter(makeMetadata());
    const output = await reporter.generate(makeRunResult(), makeGateEval());
    expect(output.content).toContain("Total Tests | 3");
    expect(output.content).toContain("Passed | 2");
    expect(output.content).toContain("Failed | 1");
  });

  describe("without metadata", () => {
    it("falls back to N/A for missing metadata fields", async () => {
      const reporter = createComplianceReporter();
      const output = await reporter.generate(makeRunResult(), makeGateEval());
      expect(output.content).toContain("**Run ID:** N/A");
      expect(output.content).toContain("**KindLM Version:** N/A");
      expect(output.content).toContain("**Git Commit:** N/A");
      expect(output.content).toContain("**Models:** N/A");
    });

    it("uses 'unknown' for version in tool header", async () => {
      const reporter = createComplianceReporter();
      const output = await reporter.generate(makeRunResult(), makeGateEval());
      expect(output.content).toContain("**Tool:** KindLM vunknown");
    });

    it("makes content hash and run hash identical when no metadata", async () => {
      const reporter = createComplianceReporter();
      const output = await reporter.generate(makeRunResult(), makeGateEval());
      const contentHashMatch = output.content.match(/Tamper Evidence Hash \(SHA-256\):\*\* `([a-f0-9]{64})`/);
      const runHashMatch = output.content.match(/Run Identity Hash \(SHA-256\):\*\* `([a-f0-9]{64})`/);
      expect(contentHashMatch).not.toBeNull();
      expect(runHashMatch).not.toBeNull();
      expect(contentHashMatch?.[1]).toBe(runHashMatch?.[1]);
    });
  });
});
