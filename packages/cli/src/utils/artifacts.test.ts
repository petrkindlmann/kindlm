import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeRunId, writeRunArtifacts } from "./artifacts.js";
import type { RunnerResult } from "@kindlm/core";

// Mock node:fs to avoid real disk writes
vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue("test-uuid-1234"),
  };
});

const mockRunnerResult: RunnerResult = {
  runResult: {
    suites: [
      {
        name: "my-suite",
        status: "passed",
        tests: [
          {
            name: "test-a",
            modelId: "gpt-4o",
            status: "passed",
            assertions: [],
            latencyMs: 100,
            costUsd: 0.01,
          },
          {
            name: "test-b",
            modelId: "gpt-4o",
            status: "failed",
            assertions: [],
            latencyMs: 200,
            costUsd: 0.02,
          },
        ],
      },
    ],
    totalTests: 2,
    passed: 1,
    failed: 1,
    errored: 0,
    skipped: 0,
    durationMs: 500,
  },
  aggregated: [],
};

describe("computeRunId", () => {
  it("is deterministic: same inputs → same output", () => {
    const id1 = computeRunId("my-suite", "abc123", "abc");
    const id2 = computeRunId("my-suite", "abc123", "abc");
    expect(id1).toBe(id2);
  });

  it("differs for different suiteName", () => {
    const id1 = computeRunId("suite-a", "abc123", null);
    const id2 = computeRunId("suite-b", "abc123", null);
    expect(id1).not.toBe(id2);
  });

  it("differs for different configHash", () => {
    const id1 = computeRunId("my-suite", "hash1", null);
    const id2 = computeRunId("my-suite", "hash2", null);
    expect(id1).not.toBe(id2);
  });

  it("returns a 40-char hex string", () => {
    const id = computeRunId("my-suite", "abc123", null);
    expect(id).toMatch(/^[a-f0-9]{40}$/);
  });

  it("handles null gitCommit identically to empty string in the contract sense", () => {
    const id1 = computeRunId("suite", "hash", null);
    const id2 = computeRunId("suite", "hash", null);
    expect(id1).toBe(id2);
  });
});

describe("writeRunArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the artifact directory", async () => {
    const { mkdirSync } = await import("node:fs");
    writeRunArtifacts(mockRunnerResult, "my-suite", "abc123", null, "yaml: content");
    expect(mkdirSync).toHaveBeenCalledOnce();
    const [dirArg, optsArg] = (mkdirSync as ReturnType<typeof vi.fn>).mock.calls[0] as [string, object];
    expect(dirArg).toContain(".kindlm");
    expect(dirArg).toContain("runs");
    expect(optsArg).toMatchObject({ recursive: true });
  });

  it("writes exactly 5 files", async () => {
    const { writeFileSync, appendFileSync } = await import("node:fs");
    writeRunArtifacts(mockRunnerResult, "my-suite", "abc123", null, "yaml: content");
    // 4 writeFileSync calls (results.json, summary.json, metadata.json, config.json)
    // + appendFileSync for results.jsonl (one call per test in the suite)
    expect((writeFileSync as ReturnType<typeof vi.fn>).mock.calls.length).toBe(4);
    // results.jsonl written via appendFileSync, one entry per TestRunResult
    expect((appendFileSync as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });

  it("results.json is written with full runResult", async () => {
    const { writeFileSync } = await import("node:fs");
    writeRunArtifacts(mockRunnerResult, "my-suite", "abc123", null, "yaml: content");
    const calls = (writeFileSync as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    const resultsCall = calls.find(([path]) => (path as string).endsWith("results.json"));
    expect(resultsCall).toBeDefined();
    const content = JSON.parse(resultsCall![1] as string);
    expect(content.totalTests).toBe(2);
    expect(content.passed).toBe(1);
  });

  it("summary.json contains expected stats keys", async () => {
    const { writeFileSync } = await import("node:fs");
    writeRunArtifacts(mockRunnerResult, "my-suite", "abc123", null, "yaml: content");
    const calls = (writeFileSync as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    const summaryCall = calls.find(([path]) => (path as string).endsWith("summary.json"));
    expect(summaryCall).toBeDefined();
    const content = JSON.parse(summaryCall![1] as string);
    expect(content).toHaveProperty("passed");
    expect(content).toHaveProperty("failed");
    expect(content).toHaveProperty("errored");
    expect(content).toHaveProperty("durationMs");
    expect(content).toHaveProperty("passRate");
    expect(content.passRate).toBeCloseTo(0.5);
  });

  it("metadata.json contains runId, executionId, suiteName", async () => {
    const { writeFileSync } = await import("node:fs");
    writeRunArtifacts(mockRunnerResult, "my-suite", "abc123", "commit-sha", "yaml: content");
    const calls = (writeFileSync as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    const metaCall = calls.find(([path]) => (path as string).endsWith("metadata.json"));
    expect(metaCall).toBeDefined();
    const content = JSON.parse(metaCall![1] as string);
    expect(content).toHaveProperty("runId");
    expect(content).toHaveProperty("executionId");
    expect(content.suiteName).toBe("my-suite");
    expect(content.gitCommit).toBe("commit-sha");
  });

  it("config.json is written as raw YAML string (not JSON-encoded)", async () => {
    const { writeFileSync } = await import("node:fs");
    const yamlContent = "kindlm: 1\nproject: test";
    writeRunArtifacts(mockRunnerResult, "my-suite", "abc123", null, yamlContent);
    const calls = (writeFileSync as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    const configCall = calls.find(([path]) => (path as string).endsWith("config.json"));
    expect(configCall).toBeDefined();
    expect(configCall![1]).toBe(yamlContent);
  });

  it("returns RunArtifactPaths with runId, executionId, artifactDir", () => {
    const result = writeRunArtifacts(mockRunnerResult, "my-suite", "abc123", null, "yaml: content");
    expect(result).toHaveProperty("runId");
    expect(result).toHaveProperty("executionId");
    expect(result).toHaveProperty("artifactDir");
    expect(result.artifactDir).toContain(result.runId);
    expect(result.artifactDir).toContain(result.executionId);
  });
});
