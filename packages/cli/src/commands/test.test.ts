import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerTestCommand } from "./test.js";

vi.mock("../utils/run-tests.js", () => ({
  runTests: vi.fn(),
}));

vi.mock("../utils/last-run.js", () => ({
  saveLastRun: vi.fn(),
  computeConfigHash: vi.fn().mockReturnValue("abc123"),
}));

vi.mock("../utils/pdf-renderer.js", () => ({
  renderCompliancePdf: vi.fn(),
}));

vi.mock("@kindlm/core", () => ({
  evaluateGates: vi.fn().mockReturnValue({ passed: true, gates: [] }),
  createPrettyReporter: vi.fn().mockReturnValue({
    name: "pretty",
    generate: vi.fn().mockResolvedValue({ content: "report output", format: "text" }),
  }),
  createJsonReporter: vi.fn().mockReturnValue({
    name: "json",
    generate: vi.fn().mockResolvedValue({ content: "{}", format: "json" }),
  }),
  createJunitReporter: vi.fn().mockReturnValue({
    name: "junit",
    generate: vi.fn().mockResolvedValue({ content: "<xml/>", format: "xml" }),
  }),
  createComplianceReporter: vi.fn().mockReturnValue({
    name: "compliance",
    generate: vi.fn().mockResolvedValue({ content: "# Compliance", format: "markdown" }),
  }),
  ProviderError: class ProviderError extends Error {
    code: string;
    retryable: boolean;
    constructor(message: string, code: string, retryable = false) {
      super(message);
      this.code = code;
      this.retryable = retryable;
    }
  },
}));

import { runTests } from "../utils/run-tests.js";
const mockRunTests = vi.mocked(runTests);

class ExitSentinel extends Error {
  readonly exitCode: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.exitCode = code;
  }
}

function makeRunTestsResult(suiteName = "my-suite") {
  return {
    config: {
      suite: { name: suiteName },
      gates: { passRateMin: 0.8, schemaFailuresMax: 0, piiFailuresMax: 0, keywordFailuresMax: 0 },
    },
    runnerResult: {
      runResult: {
        suites: [{ name: suiteName, status: "passed", tests: [] }],
        totalTests: 1,
        passed: 1,
        failed: 0,
        errored: 0,
        skipped: 0,
        durationMs: 100,
      },
      aggregated: [],
    },
    configDir: "/tmp",
    yamlContent: "kindlm: 1",
  };
}

describe("test command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCodes: number[];

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerTestCommand(program);

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

  it("passes suite option to runTests", async () => {
    mockRunTests.mockResolvedValue(makeRunTestsResult() as never);

    try {
      await program.parseAsync(["node", "kindlm", "test", "-s", "my-suite"]);
    } catch {
      // process.exit throws
    }

    expect(mockRunTests).toHaveBeenCalledWith(
      expect.objectContaining({ suite: "my-suite" }),
    );
  });

  it("does not pass suite when flag is omitted", async () => {
    mockRunTests.mockResolvedValue(makeRunTestsResult() as never);

    try {
      await program.parseAsync(["node", "kindlm", "test"]);
    } catch {
      // process.exit throws
    }

    expect(mockRunTests).toHaveBeenCalledWith(
      expect.objectContaining({ suite: undefined }),
    );
  });

  it("exits 0 when all tests pass", async () => {
    mockRunTests.mockResolvedValue(makeRunTestsResult() as never);

    try {
      await program.parseAsync(["node", "kindlm", "test"]);
    } catch {
      // process.exit throws
    }

    expect(exitCodes).toContain(0);
  });

  it("exits 1 when tests fail", async () => {
    const result = makeRunTestsResult();
    result.runnerResult.runResult.failed = 1;
    mockRunTests.mockResolvedValue(result as never);

    try {
      await program.parseAsync(["node", "kindlm", "test"]);
    } catch {
      // process.exit throws
    }

    expect(exitCodes).toContain(1);
  });

  it("exits 1 when --pdf is used without --compliance", async () => {
    try {
      await program.parseAsync(["node", "kindlm", "test", "--pdf", "out.pdf"]);
    } catch {
      // process.exit throws
    }

    expect(exitCodes[0]).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("--pdf requires --compliance");
  });
});
