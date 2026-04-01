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
  writeBaselineVersioned: vi.fn(),
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

vi.mock("../utils/file-reader.js", () => ({
  createNodeFileReader: vi.fn(() => ({
    readFile: vi.fn().mockReturnValue({ success: true, data: "" }),
  })),
}));

import {
  listBaselines,
  deserializeBaseline,
  writeBaseline,
  writeBaselineVersioned,
  buildBaselineData,
  readBaseline,
  compareBaseline,
  parseConfig,
} from "@kindlm/core";
const mockListBaselines = vi.mocked(listBaselines);
const mockDeserializeBaseline = vi.mocked(deserializeBaseline);
const mockWriteBaseline = vi.mocked(writeBaseline);
const mockWriteBaselineVersioned = vi.mocked(writeBaselineVersioned);
const mockBuildBaselineData = vi.mocked(buildBaselineData);
const mockReadBaseline = vi.mocked(readBaseline);
const mockCompareBaseline = vi.mocked(compareBaseline);
const mockParseConfig = vi.mocked(parseConfig);

import { runTests } from "../utils/run-tests.js";
const mockRunTests = vi.mocked(runTests);

import { readFileSync } from "node:fs";
const mockReadFileSync = vi.mocked(readFileSync);

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

describe("baseline set command", () => {
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

  it("saves baseline after successful test run", async () => {
    const baselineData = {
      version: "1" as const,
      suiteName: "my-suite",
      createdAt: "2026-01-15T12:00:00Z",
      results: {
        "test-a::gpt-4o": { passRate: 1, outputText: "", failureCodes: [], latencyAvgMs: 100, costUsd: 0.01, runCount: 3 },
      },
    };

    mockRunTests.mockResolvedValue({
      config: { suite: { name: "my-suite" } },
      runnerResult: {
        runResult: { totalTests: 1, passed: 1, failed: 0, errored: 0, skipped: 0, durationMs: 100, suites: [] },
        aggregated: [],
      },
      configDir: "/tmp",
      yamlContent: "version: 1",
    } as never);

    mockBuildBaselineData.mockReturnValue(baselineData as never);
    mockWriteBaselineVersioned.mockReturnValue({ success: true, data: undefined });

    try {
      await program.parseAsync(["node", "kindlm", "baseline", "set"]);
    } catch {
      // process.exit throws
    }

    expect(mockRunTests).toHaveBeenCalled();
    expect(mockBuildBaselineData).toHaveBeenCalled();
    expect(mockWriteBaselineVersioned).toHaveBeenCalled();
    // Success path should NOT call process.exit
    expect(exitCodes.length).toBe(0);
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Baseline saved");
    expect(allOutput).toContain("my-suite");
  });

  it("exits 1 when runTests rejects (e.g. config not found)", async () => {
    mockRunTests.mockRejectedValue(new Error("Config file not found: kindlm.yaml"));

    try {
      await program.parseAsync(["node", "kindlm", "baseline", "set"]);
    } catch {
      // process.exit throws
    }

    expect(exitCodes[0]).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("Config file not found");
  });

  it("exits 1 when writeBaseline fails", async () => {
    mockRunTests.mockResolvedValue({
      config: { suite: { name: "my-suite" } },
      runnerResult: {
        runResult: { totalTests: 1, passed: 1, failed: 0, errored: 0, skipped: 0, durationMs: 100, suites: [] },
        aggregated: [],
      },
      configDir: "/tmp",
      yamlContent: "version: 1",
    } as never);

    mockBuildBaselineData.mockReturnValue({
      version: "1",
      suiteName: "my-suite",
      createdAt: "2026-01-15T12:00:00Z",
      results: {},
    } as never);

    mockWriteBaselineVersioned.mockReturnValue({
      success: false,
      error: { code: "UNKNOWN_ERROR", message: "Disk full" },
    });

    try {
      await program.parseAsync(["node", "kindlm", "baseline", "set"]);
    } catch {
      // process.exit throws
    }

    expect(exitCodes[0]).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("Disk full");
  });
});

describe("baseline compare command", () => {
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

  it("prints regression report when baseline has regressions", async () => {
    mockReadFileSync.mockReturnValue("version: 1" as never);
    mockParseConfig.mockReturnValue({
      success: true,
      data: { suite: { name: "my-suite" } },
    } as never);

    const baselineData = {
      version: "1" as const,
      suiteName: "my-suite",
      createdAt: "2026-01-01T00:00:00Z",
      results: {
        "test-a::gpt-4o": { passRate: 1, outputText: "", failureCodes: [], latencyAvgMs: 100, costUsd: 0.01, runCount: 3 },
      },
    };

    mockReadBaseline.mockReturnValue({ success: true, data: baselineData } as never);

    mockRunTests.mockResolvedValue({
      config: { suite: { name: "my-suite" } },
      runnerResult: { aggregated: [] },
      configDir: "/tmp",
      yamlContent: "version: 1",
    } as never);

    mockBuildBaselineData.mockReturnValue({
      ...baselineData,
      results: {
        "test-a::gpt-4o": { passRate: 0.5, outputText: "", failureCodes: ["SCHEMA_FAIL"], latencyAvgMs: 200, costUsd: 0.02, runCount: 3 },
      },
    } as never);

    mockCompareBaseline.mockReturnValue({
      regressions: [
        { testName: "test-a::gpt-4o", baselinePassRate: 1, currentPassRate: 0.5, newFailureCodes: ["SCHEMA_FAIL"] },
      ],
      improvements: [],
      unchanged: [],
      newTests: [],
      removedTests: [],
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "baseline", "compare"]);
    } catch {
      // process.exit throws
    }

    // Regressions found → exit 1
    expect(exitCodes[0]).toBe(1);
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Regressions");
    expect(allOutput).toContain("test-a::gpt-4o");
  });

  it("exits 1 with error when no baseline exists", async () => {
    mockReadFileSync.mockReturnValue("version: 1" as never);
    mockParseConfig.mockReturnValue({
      success: true,
      data: { suite: { name: "my-suite" } },
    } as never);

    mockReadBaseline.mockReturnValue({
      success: false,
      error: { code: "BASELINE_NOT_FOUND", message: "No baseline found" },
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "baseline", "compare"]);
    } catch {
      // process.exit throws
    }

    expect(exitCodes[0]).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("No baseline found");
    expect(allErrors).toContain("kindlm baseline set");
  });

  it("exits 0 when comparison has no regressions", async () => {
    mockReadFileSync.mockReturnValue("version: 1" as never);
    mockParseConfig.mockReturnValue({
      success: true,
      data: { suite: { name: "my-suite" } },
    } as never);

    const baselineData = {
      version: "1" as const,
      suiteName: "my-suite",
      createdAt: "2026-01-01T00:00:00Z",
      results: {
        "test-a::gpt-4o": { passRate: 1, outputText: "", failureCodes: [], latencyAvgMs: 100, costUsd: 0.01, runCount: 3 },
      },
    };

    mockReadBaseline.mockReturnValue({ success: true, data: baselineData } as never);

    mockRunTests.mockResolvedValue({
      config: { suite: { name: "my-suite" } },
      runnerResult: { aggregated: [] },
      configDir: "/tmp",
      yamlContent: "version: 1",
    } as never);

    mockBuildBaselineData.mockReturnValue(baselineData as never);

    mockCompareBaseline.mockReturnValue({
      regressions: [],
      improvements: [],
      unchanged: [{ testName: "test-a::gpt-4o", passRate: 1 }],
      newTests: [],
      removedTests: [],
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "baseline", "compare"]);
    } catch {
      // process.exit throws
    }

    expect(exitCodes[0]).toBe(0);
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Unchanged");
  });
});
