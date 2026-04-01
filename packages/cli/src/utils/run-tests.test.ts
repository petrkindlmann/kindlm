import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:fs", () => ({
  statSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("@kindlm/core", () => ({
  parseConfig: vi.fn(),
  createProvider: vi.fn(),
  createRunner: vi.fn(),
}));

vi.mock("./http.js", () => ({ createHttpClient: vi.fn().mockReturnValue({}) }));
vi.mock("./spinner.js", () => ({
  createSpinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn() })),
}));
vi.mock("./file-reader.js", () => ({ createNodeFileReader: vi.fn().mockReturnValue({}) }));
vi.mock("./command-executor.js", () => ({ createNodeCommandExecutor: vi.fn().mockReturnValue({}) }));
vi.mock("./caching-adapter.js", () => ({
  createCachingAdapter: vi.fn().mockImplementation((a: unknown) => a),
}));
vi.mock("./features.js", () => ({
  loadFeatureFlags: vi.fn().mockReturnValue({ runArtifacts: false, betaJudge: false, costGating: false }),
  isEnabled: vi.fn().mockImplementation((flags: Record<string, boolean>, key: string) => flags[key] === true),
}));
vi.mock("./artifacts.js", () => ({
  writeRunArtifacts: vi.fn().mockReturnValue({ runId: "abc123", executionId: "exec-1", artifactDir: "/tmp/abc123/exec-1" }),
}));
vi.mock("./last-run.js", () => ({
  computeConfigHash: vi.fn().mockReturnValue("hash123"),
  saveLastRun: vi.fn(),
}));
vi.mock("./git.js", () => ({
  getGitInfo: vi.fn().mockReturnValue({ commitSha: "abc", branch: "main", isDirty: false }),
}));

import { statSync, readFileSync } from "node:fs";
import { parseConfig, createProvider, createRunner } from "@kindlm/core";
import { loadFeatureFlags, isEnabled } from "./features.js";
import { writeRunArtifacts } from "./artifacts.js";
import { runTests } from "./run-tests.js";

const mockStatSync = vi.mocked(statSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockParseConfig = vi.mocked(parseConfig);
const mockCreateProvider = vi.mocked(createProvider);
const mockCreateRunner = vi.mocked(createRunner);
const mockLoadFeatureFlags = vi.mocked(loadFeatureFlags);
const mockIsEnabled = vi.mocked(isEnabled);
const mockWriteRunArtifacts = vi.mocked(writeRunArtifacts);

const VALID_YAML = "kindlm: 1\nsuite:\n  name: test-suite\n";

const minimalConfig = {
  kindlm: 1 as const,
  suite: { name: "test-suite", description: "Tests" },
  providers: { openai: { apiKeyEnv: "OPENAI_API_KEY" } },
  models: [{ id: "gpt-4o", provider: "openai", model: "gpt-4o", params: { temperature: 0, maxTokens: 100 } }],
  prompts: {},
  tests: [{ name: "t1", prompt: "p1", vars: {}, expect: {}, skip: false }],
  defaults: { repeat: 1, concurrency: 1, timeoutMs: 10000 },
  gates: null,
  compliance: null,
  trace: null,
  upload: null,
};

const successRunnerResult = {
  success: true as const,
  data: {
    runResult: { suites: [], totalTests: 1, passed: 1, failed: 0, errored: 0, skipped: 0, durationMs: 50 },
    aggregated: [],
  },
};

function makeAdapter() {
  return {
    name: "openai",
    initialize: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn(),
    estimateCost: vi.fn().mockReturnValue(0),
    supportsTools: vi.fn().mockReturnValue(true),
  };
}

describe("runTests", () => {
  let errors: string[];
  let warnings: string[];
  let exitCode: number | undefined;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.clearAllMocks();
    errors = [];
    warnings = [];
    exitCode = undefined;

    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    });
    vi.spyOn(process, "exit").mockImplementation((code?: number | string | null) => {
      exitCode = code as number;
      throw new Error(`exit:${String(code)}`);
    });

    // Default happy-path mocks
    mockStatSync.mockReturnValue({ size: 500 } as ReturnType<typeof statSync>);
    mockReadFileSync.mockReturnValue(VALID_YAML as unknown as ReturnType<typeof readFileSync>);
    mockParseConfig.mockReturnValue({ success: true, data: structuredClone(minimalConfig) } as never);
    mockCreateProvider.mockReturnValue(makeAdapter() as never);
    mockCreateRunner.mockReturnValue({ run: vi.fn().mockResolvedValue(successRunnerResult) } as never);
    mockIsEnabled.mockImplementation((flags: Record<string, boolean>, key: string) => flags[key] === true);
    mockLoadFeatureFlags.mockReturnValue({ runArtifacts: false, betaJudge: false, costGating: false });
    mockWriteRunArtifacts.mockReturnValue({ runId: "abc123", executionId: "exec-1", artifactDir: "/tmp/abc123/exec-1" } as never);

    // Re-establish mocks cleared by vi.clearAllMocks
    vi.mocked((await import("./spinner.js")).createSpinner).mockImplementation(
      () => ({ start: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn() })
    );
    vi.mocked((await import("./http.js")).createHttpClient).mockReturnValue({} as never);
    vi.mocked((await import("./file-reader.js")).createNodeFileReader).mockReturnValue({} as never);
    vi.mocked((await import("./command-executor.js")).createNodeCommandExecutor).mockReturnValue({} as never);
    vi.mocked((await import("./caching-adapter.js")).createCachingAdapter).mockImplementation((a: unknown) => a as never);
    vi.mocked((await import("./git.js")).getGitInfo).mockReturnValue({ commitSha: "abc", branch: "main", dirty: false });
    vi.mocked((await import("./last-run.js")).computeConfigHash).mockReturnValue("hash123");

    process.env["OPENAI_API_KEY"] = "sk-test";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("exits 1 when config file is not found", async () => {
    mockStatSync.mockImplementation(() => { throw new Error("ENOENT"); });
    try { await runTests({ configPath: "kindlm.yaml" }); } catch { /* exit throws */ }
    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Config file not found");
  });

  it("exits 1 when config exceeds 1MB", async () => {
    mockStatSync.mockReturnValue({ size: 2_000_000 } as ReturnType<typeof statSync>);
    try { await runTests({ configPath: "kindlm.yaml" }); } catch { /* exit throws */ }
    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toMatch(/exceeds 1MB/);
  });

  it("exits 1 when config parse fails", async () => {
    mockParseConfig.mockReturnValue({
      success: false,
      error: { message: "invalid schema", code: "CONFIG_INVALID" as const, details: null },
    } as never);
    try { await runTests({ configPath: "kindlm.yaml" }); } catch { /* exit throws */ }
    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Config validation failed");
  });

  it("exits 1 when suite name does not match", async () => {
    try {
      await runTests({ configPath: "kindlm.yaml", suite: "nonexistent-suite" });
    } catch { /* exit throws */ }
    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("not found");
  });

  it("exits 1 for invalid --runs value (zero)", async () => {
    try { await runTests({ configPath: "kindlm.yaml", runs: 0 }); } catch { /* exit throws */ }
    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Invalid --runs value");
  });

  it("applies --runs override to config.defaults.repeat", async () => {
    const result = await runTests({ configPath: "kindlm.yaml", runs: 3 });
    expect(result.config.defaults.repeat).toBe(3);
  });

  it("exits 1 for invalid --gate value above 100", async () => {
    try { await runTests({ configPath: "kindlm.yaml", gate: 200 }); } catch { /* exit throws */ }
    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Invalid --gate value");
  });

  it("logs warning for decimal --gate value that looks like a fraction", async () => {
    await runTests({ configPath: "kindlm.yaml", gate: 0.8 });
    expect(errors.join("\n")).toContain("--gate");
  });

  it("exits 1 when provider API key env var is missing", async () => {
    delete process.env["OPENAI_API_KEY"];
    try { await runTests({ configPath: "kindlm.yaml" }); } catch { /* exit throws */ }
    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Missing environment variable");
  });

  it("loads feature flags from disk when not provided in options", async () => {
    await runTests({ configPath: "kindlm.yaml" });
    expect(mockLoadFeatureFlags).toHaveBeenCalledOnce();
  });

  it("uses provided feature flags without loading from disk", async () => {
    await runTests({ configPath: "kindlm.yaml", featureFlags: { runArtifacts: false, betaJudge: false, costGating: false } });
    expect(mockLoadFeatureFlags).not.toHaveBeenCalled();
  });

  it("does not write artifacts when runArtifacts flag is disabled", async () => {
    mockLoadFeatureFlags.mockReturnValue({ runArtifacts: false, betaJudge: false, costGating: false });
    await runTests({ configPath: "kindlm.yaml" });
    expect(mockWriteRunArtifacts).not.toHaveBeenCalled();
  });

  it("writes artifacts and returns artifactPaths when runArtifacts flag is enabled", async () => {
    mockLoadFeatureFlags.mockReturnValue({ runArtifacts: true, betaJudge: false, costGating: false });
    mockIsEnabled.mockImplementation((_flags: Record<string, boolean>, key: string) => key === "runArtifacts");
    const result = await runTests({ configPath: "kindlm.yaml" });
    expect(mockWriteRunArtifacts).toHaveBeenCalledOnce();
    expect(result.artifactPaths).toBeDefined();
    expect(result.artifactPaths?.runId).toBe("abc123");
  });

  it("returns config, runnerResult, featureFlags, and yamlContent on success", async () => {
    const result = await runTests({ configPath: "kindlm.yaml" });
    expect(result.config.suite.name).toBe("test-suite");
    expect(result.runnerResult).toBeDefined();
    expect(result.featureFlags).toBeDefined();
    expect(result.yamlContent).toBe(VALID_YAML);
  });

  it("resolves env: headers for mcp provider", async () => {
    mockParseConfig.mockReturnValue({
      success: true,
      data: {
        ...structuredClone(minimalConfig),
        providers: {
          mcp: {
            serverUrl: "http://localhost:3000",
            toolName: "run",
            headers: { Authorization: "env:MCP_TOKEN" },
          },
        },
        models: [{ id: "mcp-model", provider: "mcp", model: "mcp", params: { temperature: 0, maxTokens: 100 } }],
      },
    } as never);
    process.env["MCP_TOKEN"] = "secret-token";
    await runTests({ configPath: "kindlm.yaml" });
    expect(mockCreateProvider).toHaveBeenCalledWith("mcp", expect.anything(), expect.objectContaining({
      mcpConfig: expect.objectContaining({ headers: { Authorization: "secret-token" } }),
    }));
  });
});
