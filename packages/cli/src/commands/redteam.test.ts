import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerRedTeamCommand } from "./redteam.js";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("@kindlm/core", () => ({
  parseConfig: vi.fn(),
  runAttackGeneration: vi.fn(),
  runRedTeam: vi.fn(),
  formatRedTeamReportPretty: vi.fn(),
  formatRedTeamReportJson: vi.fn(),
}));

vi.mock("../utils/file-reader.js", () => ({
  createNodeFileReader: vi.fn().mockReturnValue({}),
}));

vi.mock("../utils/init-adapters.js", () => ({
  initProviderAdapters: vi.fn(),
}));

import { existsSync, writeFileSync, readFileSync, statSync } from "node:fs";
import {
  parseConfig,
  runAttackGeneration,
  runRedTeam,
  formatRedTeamReportPretty,
  formatRedTeamReportJson,
} from "@kindlm/core";
import { initProviderAdapters } from "../utils/init-adapters.js";

const mockExistsSync = vi.mocked(existsSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockStatSync = vi.mocked(statSync);
const mockParseConfig = vi.mocked(parseConfig);
const mockRunAttackGeneration = vi.mocked(runAttackGeneration);
const mockRunRedTeam = vi.mocked(runRedTeam);
const mockFormatRedTeamReportPretty = vi.mocked(formatRedTeamReportPretty);
const mockFormatRedTeamReportJson = vi.mocked(formatRedTeamReportJson);
const mockInitProviderAdapters = vi.mocked(initProviderAdapters);

// ---------- Shared fixtures ----------

const VALID_YAML = "kindlm: 1\nsuite:\n  name: redteam\n";

const minimalRedTeamConfig = {
  kindlm: 1 as const,
  suite: { name: "redteam", description: "" },
  providers: { openai: { apiKeyEnv: "OPENAI_API_KEY" } },
  models: [
    { id: "gpt-4o", provider: "openai", model: "gpt-4o", params: { temperature: 0, maxTokens: 100 } },
  ],
  prompts: {},
  tests: [],
  defaults: { repeat: 1, concurrency: 1, timeoutMs: 10000 },
  gates: null,
  compliance: null,
  trace: null,
  upload: null,
  redteam: {
    purpose: "A helpful bookstore assistant.",
    target: { model: "gpt-4o", prompt: "You are a bookstore assistant." },
    plugins: [
      { id: "prompt-injection", numTests: 2, severity: "high" as const },
      { id: "pii-disclosure", numTests: 2, severity: "critical" as const },
      { id: "excessive-agency", numTests: 2, severity: "high" as const },
    ],
    strategy: { concurrency: 2 },
    gates: { maxCriticalFailures: 0, maxHighFailures: 0 },
  },
};

const configWithoutRedteam = {
  ...structuredClone(minimalRedTeamConfig),
  redteam: undefined,
};

function makeAttack(pluginId: string, severity: string, label: string) {
  return {
    pluginId,
    category: "prompt_injection" as const,
    severity,
    label,
    prompt: `attack prompt for ${label}`,
    systemPrompt: "You are a bookstore assistant.",
  };
}

function makeSuccessfulGenerationResult() {
  const attacks = [
    makeAttack("prompt-injection", "high", "inj-1"),
    makeAttack("prompt-injection", "high", "inj-2"),
    makeAttack("pii-disclosure", "critical", "pii-1"),
    makeAttack("pii-disclosure", "critical", "pii-2"),
    makeAttack("excessive-agency", "high", "ea-1"),
    makeAttack("excessive-agency", "high", "ea-2"),
  ];
  const perPlugin = new Map<
    string,
    { attackCount: number; error?: { code: string; message: string } }
  >([
    ["prompt-injection#0", { attackCount: 2 }],
    ["pii-disclosure#1", { attackCount: 2 }],
    ["excessive-agency#2", { attackCount: 2 }],
  ]);
  return {
    attacks,
    perPlugin,
    totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  };
}

// ---------- init subcommand (existing tests, unchanged behavior) ----------

describe("redteam init command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerRedTeamCommand(program);

    logs = [];
    errors = [];
    exitCode = undefined;

    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates kindlm-redteam.yaml when file does not exist", async () => {
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "kindlm", "redteam", "init"]);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const call = mockWriteFileSync.mock.calls[0];
    const path = call?.[0];
    const content = call?.[1];
    expect(String(path)).toContain("kindlm-redteam.yaml");
    expect(content).toContain("redteam:");

    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Created kindlm-redteam.yaml");
  });

  it("fails when kindlm-redteam.yaml already exists without --force", async () => {
    mockExistsSync.mockReturnValue(true);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "init"]);
    } catch {
      // process.exit throws
    }

    expect(exitCode).toBe(1);
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("already exists");
  });

  it("overwrites when --force is provided", async () => {
    mockExistsSync.mockReturnValue(true);

    await program.parseAsync(["node", "kindlm", "redteam", "init", "--force"]);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Created kindlm-redteam.yaml");
  });

  it("template contains expected red team config keys", async () => {
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "kindlm", "redteam", "init"]);

    const call = mockWriteFileSync.mock.calls[0];
    const content = call?.[1];
    const yaml = content as string;
    expect(yaml).toContain("redteam:");
    expect(yaml).toContain("target:");
    expect(yaml).toContain("plugins:");
    expect(yaml).toContain("purpose:");
    expect(yaml).toContain("prompt-injection");
    expect(yaml).toContain("policy:");
  });

  it("prints next steps after creation", async () => {
    mockExistsSync.mockReturnValue(false);

    await program.parseAsync(["node", "kindlm", "redteam", "init"]);

    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Next steps");
    expect(allOutput).toContain("kindlm redteam run");
  });
});

// ---------- generate subcommand ----------

describe("redteam generate command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerRedTeamCommand(program);

    logs = [];
    errors = [];
    exitCode = undefined;

    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    class ExitError extends Error {
      constructor(public readonly code: number | string | null | undefined) {
        super(`exit:${String(code)}`);
        this.name = "ExitError";
      }
    }
    vi.spyOn(process, "exit").mockImplementation((code?: number | string | null) => {
      exitCode = code as number;
      throw new ExitError(code);
    });

    // Default happy-path mocks
    mockStatSync.mockReturnValue({ size: 500 } as ReturnType<typeof statSync>);
    mockReadFileSync.mockReturnValue(VALID_YAML as unknown as ReturnType<typeof readFileSync>);
    mockParseConfig.mockReturnValue({
      success: true,
      data: structuredClone(minimalRedTeamConfig),
    } as never);
    mockInitProviderAdapters.mockResolvedValue(new Map());
    mockRunAttackGeneration.mockResolvedValue({
      success: true,
      data: makeSuccessfulGenerationResult(),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints JSON with all attacks and exits 0 on happy path", async () => {
    try {
      await program.parseAsync(["node", "kindlm", "redteam", "generate"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(0);
    const stdout = logs.join("\n");
    // JSON-shaped output
    expect(stdout).toContain('"attacks"');
    expect(stdout).toContain('"perPlugin"');
    expect(stdout).toContain('"totalUsage"');
    // 6 attacks present
    const parsed = JSON.parse(stdout);
    expect(parsed.attacks).toHaveLength(6);
    expect(Object.keys(parsed.perPlugin)).toHaveLength(3);
    expect(mockRunAttackGeneration).toHaveBeenCalledOnce();
  });

  it("prints table format with per-plugin summary lines", async () => {
    try {
      await program.parseAsync([
        "node",
        "kindlm",
        "redteam",
        "generate",
        "--format",
        "table",
      ]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(0);
    const stdout = logs.join("\n");
    expect(stdout).toContain("Red team attack generation summary");
    expect(stdout).toContain("prompt-injection#0: 2 attacks");
    expect(stdout).toContain("pii-disclosure#1: 2 attacks");
    expect(stdout).toContain("excessive-agency#2: 2 attacks");
    expect(stdout).toContain("Total: 6 attacks across 3 plugins");
  });

  it("exits 1 with a dedicated message when config lacks a redteam block", async () => {
    mockParseConfig.mockReturnValue({
      success: true,
      data: structuredClone(configWithoutRedteam),
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "generate"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("No redteam: block");
    // runAttackGeneration should NOT have been reached
    expect(mockRunAttackGeneration).not.toHaveBeenCalled();
  });

  it("exits 1 with bullet-listed errors when parseConfig fails", async () => {
    mockParseConfig.mockReturnValue({
      success: false,
      error: {
        code: "CONFIG_VALIDATION_ERROR",
        message: "schema invalid",
        details: { errors: ["missing field 'providers'", "plugin id 'xxx' unknown"] },
      },
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "generate"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    const combined = errors.join("\n");
    expect(combined).toContain("Config validation failed");
    expect(combined).toContain("missing field 'providers'");
    expect(combined).toContain("plugin id 'xxx' unknown");
    expect(mockRunAttackGeneration).not.toHaveBeenCalled();
  });

  it("exits 1 and surfaces per-plugin errors when runAttackGeneration returns err", async () => {
    mockRunAttackGeneration.mockResolvedValue({
      success: false,
      error: {
        code: "REDTEAM_PLUGIN_ERROR",
        message: "All plugins failed during attack generation",
        details: {
          perPlugin: {
            "prompt-injection#0": {
              attackCount: 0,
              error: { code: "REDTEAM_PLUGIN_ERROR", message: "parse failure" },
            },
            "pii-disclosure#1": {
              attackCount: 0,
              error: { code: "REDTEAM_PLUGIN_ERROR", message: "adapter timeout" },
            },
          },
        },
      },
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "generate"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    const combined = errors.join("\n");
    expect(combined).toContain("Attack generation failed");
    expect(combined).toContain("All plugins failed");
    expect(combined).toContain("prompt-injection#0");
    expect(combined).toContain("parse failure");
    expect(combined).toContain("pii-disclosure#1");
    expect(combined).toContain("adapter timeout");
  });

  it("exits 1 when config file is not found (statSync throws)", async () => {
    mockStatSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "generate"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Config file not found");
    expect(mockParseConfig).not.toHaveBeenCalled();
  });

  it("writes output to --out file when provided and exits 0", async () => {
    try {
      await program.parseAsync([
        "node",
        "kindlm",
        "redteam",
        "generate",
        "--out",
        "attacks.json",
      ]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(0);
    // writeFileSync called twice: once by a possible stub + once by --out;
    // we assert the --out call was made with an absolute path ending in attacks.json.
    const outCalls = mockWriteFileSync.mock.calls.filter((c) =>
      String(c[0]).endsWith("attacks.json"),
    );
    expect(outCalls).toHaveLength(1);
    const written = outCalls[0]?.[1] as string;
    expect(written).toContain('"attacks"');
    // stdout must NOT also print the JSON payload (output went to file)
    expect(logs.join("\n")).not.toContain('"totalUsage"');
  });
});

// ---------- run subcommand ----------

/**
 * Build a minimal `RedTeamRunResult` shape for CLI tests. The command
 * under test doesn't introspect the report beyond `gates.passed` and
 * `perPlugin[].error`, so we can stub the rest with placeholder
 * values. The formatter mocks return their own strings, so the report
 * shape doesn't need to be real — only `gates.passed` matters.
 */
function makeSuccessfulRunResult(
  opts: {
    gatesPassed?: boolean;
    perPluginErrors?: Record<string, { code: string; message: string }>;
  } = {},
) {
  const gatesPassed = opts.gatesPassed ?? true;
  const perPlugin = new Map<
    string,
    {
      attackCount: number;
      verdictCount: number;
      executionErrors: number;
      gradingErrors: number;
      error?: { code: string; message: string };
    }
  >([
    ["prompt-injection#0", { attackCount: 2, verdictCount: 2, executionErrors: 0, gradingErrors: 0 }],
    ["pii-disclosure#1", { attackCount: 2, verdictCount: 2, executionErrors: 0, gradingErrors: 0 }],
  ]);
  if (opts.perPluginErrors) {
    for (const [key, error] of Object.entries(opts.perPluginErrors)) {
      perPlugin.set(key, {
        attackCount: 0,
        verdictCount: 0,
        executionErrors: 0,
        gradingErrors: 0,
        error,
      });
    }
  }
  return {
    report: {
      summary: {
        total: 4,
        passed: gatesPassed ? 4 : 2,
        failed: gatesPassed ? 0 : 2,
        passRate: gatesPassed ? 1 : 0.5,
        avgScore: gatesPassed ? 1 : 0.5,
      },
      categories: [],
      gates: {
        passed: gatesPassed,
        gates: [
          {
            gateName: "maxCriticalFailures",
            passed: gatesPassed,
            actual: gatesPassed ? 0 : 2,
            threshold: 0,
            message: gatesPassed
              ? "Critical failures 0 within limit 0"
              : "Critical failures 2 exceed limit 0",
          },
        ],
      },
      failedVerdicts: [],
    },
    verdicts: [],
    perPlugin,
    totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  };
}

describe("redteam run command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerRedTeamCommand(program);

    logs = [];
    errors = [];
    exitCode = undefined;

    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    class ExitError extends Error {
      constructor(public readonly code: number | string | null | undefined) {
        super(`exit:${String(code)}`);
        this.name = "ExitError";
      }
    }
    vi.spyOn(process, "exit").mockImplementation((code?: number | string | null) => {
      exitCode = code as number;
      throw new ExitError(code);
    });

    // Default happy-path mocks
    mockStatSync.mockReturnValue({ size: 500 } as ReturnType<typeof statSync>);
    mockReadFileSync.mockReturnValue(VALID_YAML as unknown as ReturnType<typeof readFileSync>);
    mockParseConfig.mockReturnValue({
      success: true,
      data: structuredClone(minimalRedTeamConfig),
    } as never);
    mockInitProviderAdapters.mockResolvedValue(new Map());
    mockRunRedTeam.mockResolvedValue({
      success: true,
      data: makeSuccessfulRunResult(),
    } as never);
    // Formatters return distinctive strings so tests can assert which
    // branch ran without reparsing a real pretty or JSON report.
    mockFormatRedTeamReportPretty.mockReturnValue(
      "Red Team Vulnerability Report\n--------\npretty output",
    );
    mockFormatRedTeamReportJson.mockReturnValue(
      '{"summary":{"total":4,"passed":4},"gates":{"passed":true}}',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("happy path with default pretty reporter → exit 0, pretty output on stdout", async () => {
    try {
      await program.parseAsync(["node", "kindlm", "redteam", "run"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(0);
    const stdout = logs.join("\n");
    expect(stdout).toContain("Red Team Vulnerability Report");
    expect(mockFormatRedTeamReportPretty).toHaveBeenCalledOnce();
    expect(mockFormatRedTeamReportJson).not.toHaveBeenCalled();
    expect(mockRunRedTeam).toHaveBeenCalledOnce();
  });

  it("--reporter json → stdout contains JSON, exit 0", async () => {
    try {
      await program.parseAsync([
        "node",
        "kindlm",
        "redteam",
        "run",
        "--reporter",
        "json",
      ]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(0);
    const stdout = logs.join("\n");
    expect(stdout).toContain('"summary"');
    expect(stdout).toContain('"gates"');
    expect(mockFormatRedTeamReportJson).toHaveBeenCalledOnce();
    expect(mockFormatRedTeamReportPretty).not.toHaveBeenCalled();
    // stdout must be parseable as JSON when `--reporter json` is used.
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  it("gates failed → exit 1, report still printed on stdout", async () => {
    mockRunRedTeam.mockResolvedValue({
      success: true,
      data: makeSuccessfulRunResult({ gatesPassed: false }),
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "run"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    expect(logs.join("\n")).toContain("Red Team Vulnerability Report");
  });

  it("runRedTeam returns err → exit 1 with per-plugin error details on stderr", async () => {
    mockRunRedTeam.mockResolvedValue({
      success: false,
      error: {
        code: "REDTEAM_PLUGIN_ERROR",
        message: "All plugins failed during red team run",
        details: {
          perPlugin: {
            "prompt-injection#0": {
              attackCount: 0,
              error: { code: "REDTEAM_PLUGIN_ERROR", message: "adapter timeout" },
            },
            "pii-disclosure#1": {
              attackCount: 0,
              error: { code: "REDTEAM_PLUGIN_ERROR", message: "parse failure" },
            },
          },
        },
      },
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "run"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    const combined = errors.join("\n");
    expect(combined).toContain("Red team run failed");
    expect(combined).toContain("All plugins failed");
    expect(combined).toContain("prompt-injection#0");
    expect(combined).toContain("adapter timeout");
    expect(combined).toContain("pii-disclosure#1");
    expect(combined).toContain("parse failure");
    // Nothing should be printed to stdout on failure.
    expect(mockFormatRedTeamReportPretty).not.toHaveBeenCalled();
    expect(mockFormatRedTeamReportJson).not.toHaveBeenCalled();
  });

  it("exits 1 when config lacks a redteam block", async () => {
    mockParseConfig.mockReturnValue({
      success: true,
      data: structuredClone(configWithoutRedteam),
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "run"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("No redteam: block");
    expect(mockRunRedTeam).not.toHaveBeenCalled();
  });

  it("exits 1 with bullet-listed errors when parseConfig fails", async () => {
    mockParseConfig.mockReturnValue({
      success: false,
      error: {
        code: "CONFIG_VALIDATION_ERROR",
        message: "schema invalid",
        details: { errors: ["missing field 'providers'", "plugin id 'xxx' unknown"] },
      },
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "run"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    const combined = errors.join("\n");
    expect(combined).toContain("Config validation failed");
    expect(combined).toContain("missing field 'providers'");
    expect(combined).toContain("plugin id 'xxx' unknown");
    expect(mockRunRedTeam).not.toHaveBeenCalled();
  });

  it("exits 1 when config file is not found (statSync throws)", async () => {
    mockStatSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "run"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Config file not found");
    expect(mockParseConfig).not.toHaveBeenCalled();
  });

  it("exits 1 with 'Unknown reporter' for invalid --reporter value", async () => {
    try {
      await program.parseAsync([
        "node",
        "kindlm",
        "redteam",
        "run",
        "--reporter",
        "junit",
      ]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Unknown reporter");
    // Must fail BEFORE spending tokens on the pipeline.
    expect(mockRunRedTeam).not.toHaveBeenCalled();
  });

  it("writes report to --out file and exits 0 without printing to stdout", async () => {
    try {
      await program.parseAsync([
        "node",
        "kindlm",
        "redteam",
        "run",
        "--out",
        "report.txt",
      ]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(0);
    const outCalls = mockWriteFileSync.mock.calls.filter((c) =>
      String(c[0]).endsWith("report.txt"),
    );
    expect(outCalls).toHaveLength(1);
    const written = outCalls[0]?.[1] as string;
    expect(written).toContain("Red Team Vulnerability Report");
    // Pretty report text must NOT also appear on stdout when --out is used.
    expect(logs.join("\n")).not.toContain("Red Team Vulnerability Report");
  });

  it("partial per-plugin failures print warning block but exit 0 when gates pass", async () => {
    mockRunRedTeam.mockResolvedValue({
      success: true,
      data: makeSuccessfulRunResult({
        gatesPassed: true,
        perPluginErrors: {
          "harmful-content#2": {
            code: "REDTEAM_PLUGIN_ERROR",
            message: "generator rate-limited",
          },
        },
      }),
    } as never);

    try {
      await program.parseAsync(["node", "kindlm", "redteam", "run"]);
    } catch { /* exit throws */ }

    expect(exitCode).toBe(0);
    const stderrCombined = errors.join("\n");
    expect(stderrCombined).toContain("Warning:");
    expect(stderrCombined).toContain("harmful-content#2");
    expect(stderrCombined).toContain("generator rate-limited");
    // Report still printed on stdout.
    expect(logs.join("\n")).toContain("Red Team Vulnerability Report");
  });
});
