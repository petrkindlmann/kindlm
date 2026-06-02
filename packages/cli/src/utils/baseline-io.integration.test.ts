import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  writeBaselineVersioned,
  readBaseline,
  listBaselines,
  type BaselineData,
} from "@kindlm/core";
import { createFileBaselineIO } from "./baseline-io.js";

// Real on-disk integration test for the `kindlm baseline set` -> `compare` path.
// This exercises the real file IO adapter together with the real store functions
// (no mocks) — the exact combination that C4 regressed: `set` wrote a
// `{suite}-latest` pointer + versioned file, while `compare` read `{suite}.json`,
// which is never written, so compare always failed BASELINE_NOT_FOUND.

function makeBaseline(): BaselineData {
  return {
    version: "1",
    suiteName: "refund-agent",
    createdAt: "2026-01-15T10:00:00.000Z",
    results: {
      "happy-path::openai:gpt-4o": {
        passRate: 1,
        outputText: "Order #12345 found",
        failureCodes: [],
        latencyAvgMs: 150,
        costUsd: 0.05,
        runCount: 3,
      },
    },
  };
}

describe("baseline set -> compare (real file IO)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "kindlm-baseline-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a versioned baseline and reads it back through the -latest pointer", () => {
    const io = createFileBaselineIO(dir);

    const writeResult = writeBaselineVersioned(makeBaseline(), io);
    expect(writeResult.success).toBe(true);

    const readResult = readBaseline("refund-agent", io);
    expect(readResult.success).toBe(true);
    if (readResult.success) {
      expect(readResult.data.suiteName).toBe("refund-agent");
      expect(readResult.data.results["happy-path::openai:gpt-4o"]?.outputText).toBe(
        "Order #12345 found",
      );
    }
  });

  it("returns BASELINE_NOT_FOUND for a suite that was never saved", () => {
    const io = createFileBaselineIO(dir);
    const readResult = readBaseline("never-saved", io);
    expect(readResult.success).toBe(false);
    if (!readResult.success) {
      expect(readResult.error.code).toBe("BASELINE_NOT_FOUND");
    }
  });

  it("lists the saved baseline (versioned file + pointer present)", () => {
    const io = createFileBaselineIO(dir);
    writeBaselineVersioned(makeBaseline(), io);

    const listResult = listBaselines(io);
    expect(listResult.success).toBe(true);
    if (listResult.success) {
      expect(listResult.data.some((n) => n === "refund-agent-latest")).toBe(true);
      expect(listResult.data.some((n) => /^refund-agent-\d{14}/.test(n))).toBe(true);
    }
  });
});
