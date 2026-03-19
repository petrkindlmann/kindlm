import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerBaselineCommand } from "./baseline.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("@kindlm/core", () => ({
  parseConfig: vi.fn(),
  readBaseline: vi.fn(),
  writeBaseline: vi.fn(),
  listBaselines: vi.fn(),
  buildBaselineData: vi.fn(),
  compareBaseline: vi.fn(),
  deserializeBaseline: vi.fn(),
}));

vi.mock("../utils/run-tests.js", () => ({
  runTests: vi.fn(),
}));

vi.mock("../utils/baseline-io.js", () => ({
  createFileBaselineIO: vi.fn(() => ({
    read: vi.fn(),
    write: vi.fn(),
    list: vi.fn(),
  })),
}));

import { listBaselines, deserializeBaseline } from "@kindlm/core";
const mockListBaselines = vi.mocked(listBaselines);
const mockDeserializeBaseline = vi.mocked(deserializeBaseline);

import { createFileBaselineIO } from "../utils/baseline-io.js";
const mockCreateFileBaselineIO = vi.mocked(createFileBaselineIO);

// Sentinel class so the source code's `catch (e)` calls `process.exit(1)`
// and we can distinguish between our mock exit and a real error.
class ExitSentinel extends Error {
  readonly exitCode: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.exitCode = code;
  }
}

describe("baseline list command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCodes: number[];

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerBaselineCommand(program);

    logs = [];
    errors = [];
    exitCodes = [];

    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      exitCodes.push(code as number);
      throw new ExitSentinel(code as number);
    });
  });

  it("shows message when no baselines exist", () => {
    mockListBaselines.mockReturnValue({ success: true, data: [] });

    try {
      program.parse(["node", "kindlm", "baseline", "list"]);
    } catch {
      // process.exit throws
    }

    // Success paths should NOT call process.exit — they return normally.
    expect(exitCodes.length).toBe(0);
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("No baselines saved");
  });

  it("lists baselines with test counts", () => {
    const mockIO = {
      read: vi.fn().mockReturnValue({
        success: true,
        data: JSON.stringify({
          version: "1",
          suiteName: "my-suite",
          createdAt: "2026-01-15T12:00:00Z",
          results: { "test-a::gpt-4o": {}, "test-b::gpt-4o": {} },
        }),
      }),
      write: vi.fn(),
      list: vi.fn(),
    };
    mockCreateFileBaselineIO.mockReturnValue(mockIO);

    mockListBaselines.mockReturnValue({
      success: true,
      data: ["my-suite"],
    });
    mockDeserializeBaseline.mockReturnValue({
      success: true,
      data: {
        version: "1",
        suiteName: "my-suite",
        createdAt: "2026-01-15T12:00:00Z",
        results: {
          "test-a::gpt-4o": { passRate: 1, outputText: "", failureCodes: [], latencyAvgMs: 100, costUsd: 0.01, runCount: 3 },
          "test-b::gpt-4o": { passRate: 0.67, outputText: "", failureCodes: [], latencyAvgMs: 200, costUsd: 0.02, runCount: 3 },
        },
      },
    });

    try {
      program.parse(["node", "kindlm", "baseline", "list"]);
    } catch {
      // process.exit throws
    }

    // Success paths should NOT call process.exit — they return normally.
    expect(exitCodes.length).toBe(0);
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("my-suite");
    expect(allOutput).toContain("2 tests");
  });

  it("shows corrupt label for unreadable baseline files", () => {
    const mockIO = {
      read: vi.fn().mockReturnValue({ success: true, data: "not-valid-json{{{" }),
      write: vi.fn(),
      list: vi.fn(),
    };
    mockCreateFileBaselineIO.mockReturnValue(mockIO);

    mockListBaselines.mockReturnValue({
      success: true,
      data: ["broken-suite"],
    });
    mockDeserializeBaseline.mockReturnValue({
      success: false,
      error: { code: "BASELINE_CORRUPT", message: "Baseline file is not valid JSON" },
    });

    try {
      program.parse(["node", "kindlm", "baseline", "list"]);
    } catch {
      // process.exit throws
    }

    // Success paths should NOT call process.exit — they return normally.
    expect(exitCodes.length).toBe(0);
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("corrupt");
  });

  it("reports error when list operation fails", () => {
    mockListBaselines.mockReturnValue({
      success: false,
      error: { code: "UNKNOWN_ERROR", message: "Permission denied" },
    });

    try {
      program.parse(["node", "kindlm", "baseline", "list"]);
    } catch {
      // process.exit throws
    }

    expect(exitCodes[0]).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("Permission denied");
  });
});
