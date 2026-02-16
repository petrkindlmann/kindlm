import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RunnerResult } from "@kindlm/core";

// Mock cwd to a temp directory
const testDir = mkdtempSync(join(tmpdir(), "kindlm-lastrun-test-"));
vi.spyOn(process, "cwd").mockReturnValue(testDir);

import { saveLastRun, loadLastRun, computeConfigHash } from "./last-run.js";

const fakeRunnerResult: RunnerResult = {
  runResult: {
    suites: [{ name: "s1", status: "passed", tests: [] }],
    totalTests: 1,
    passed: 1,
    failed: 0,
    errored: 0,
    skipped: 0,
    durationMs: 500,
  },
  aggregated: [],
};

describe("last-run", () => {
  beforeEach(() => {
    try {
      unlinkSync(join(testDir, ".kindlm", "last-run.json"));
    } catch {
      // ignore
    }
  });

  it("saveLastRun + loadLastRun roundtrip", () => {
    const data = {
      runnerResult: fakeRunnerResult,
      suiteName: "test-suite",
      configHash: "abc123",
      timestamp: "2025-01-01T00:00:00Z",
    };

    saveLastRun(data);
    const loaded = loadLastRun();

    expect(loaded).not.toBeNull();
    expect(loaded?.suiteName).toBe("test-suite");
    expect(loaded?.configHash).toBe("abc123");
    expect(loaded?.runnerResult.runResult.totalTests).toBe(1);
  });

  it("loadLastRun returns null when file is missing", () => {
    expect(loadLastRun()).toBeNull();
  });

  it("loadLastRun handles corrupt JSON gracefully", () => {
    const dir = join(testDir, ".kindlm");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "last-run.json"), "not valid json {{{");

    expect(loadLastRun()).toBeNull();
  });
});

describe("computeConfigHash", () => {
  it("returns consistent SHA-256 hex", () => {
    const hash1 = computeConfigHash("version: 1\nsuites: []");
    const hash2 = computeConfigHash("version: 1\nsuites: []");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns different hash for different content", () => {
    const hash1 = computeConfigHash("content-a");
    const hash2 = computeConfigHash("content-b");
    expect(hash1).not.toBe(hash2);
  });
});
