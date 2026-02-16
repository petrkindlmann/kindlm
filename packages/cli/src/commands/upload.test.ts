import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { registerUploadCommand } from "./upload.js";

vi.mock("../cloud/auth.js", () => ({
  loadToken: vi.fn(),
}));

vi.mock("../cloud/client.js", () => ({
  createCloudClient: vi.fn(),
  getCloudUrl: vi.fn(() => "https://api.kindlm.com"),
}));

vi.mock("../utils/last-run.js", () => ({
  loadLastRun: vi.fn(),
}));

vi.mock("../utils/git.js", () => ({
  getGitInfo: vi.fn(),
}));

vi.mock("../utils/env.js", () => ({
  detectCI: vi.fn(),
}));

vi.mock("../cloud/upload.js", () => ({
  uploadResults: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { loadToken } from "../cloud/auth.js";
import { createCloudClient } from "../cloud/client.js";
import { loadLastRun } from "../utils/last-run.js";
import { getGitInfo } from "../utils/git.js";
import { detectCI } from "../utils/env.js";
import { uploadResults } from "../cloud/upload.js";
import { execSync } from "node:child_process";

const mockLoadToken = vi.mocked(loadToken);
const mockCreateCloudClient = vi.mocked(createCloudClient);
const mockLoadLastRun = vi.mocked(loadLastRun);
const mockGetGitInfo = vi.mocked(getGitInfo);
const mockDetectCI = vi.mocked(detectCI);
const mockUploadResults = vi.mocked(uploadResults);
const mockExecSync = vi.mocked(execSync);

describe("upload command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    program = new Command();
    program.exitOverride();
    registerUploadCommand(program);

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

    // Default mocks for happy path
    mockGetGitInfo.mockReturnValue({ commitSha: "abc123", branch: "main", dirty: false });
    mockDetectCI.mockReturnValue({ name: null, isCI: false, commitSha: null, branch: null });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses explicit --project flag for project name", async () => {
    mockLoadToken.mockReturnValue("klm_test");
    mockLoadLastRun.mockReturnValue({
      runnerResult: { runResult: { totalTests: 1, passed: 1, failed: 0, passRate: 1, durationMs: 100 }, aggregated: [] },
      suiteName: "my-suite",
      configHash: "abc",
      timestamp: "2026-01-01T00:00:00Z",
    });
    const mockClient = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), baseUrl: "" };
    mockCreateCloudClient.mockReturnValue(mockClient);
    mockUploadResults.mockResolvedValue({ runId: "run-1", projectId: "proj-1" });

    try {
      await program.parseAsync(["node", "kindlm", "upload", "--project", "custom-name"]);
    } catch {
      // commander exitOverride
    }

    expect(mockUploadResults).toHaveBeenCalledOnce();
    const uploadOptions = mockUploadResults.mock.calls[0]![2];
    expect(uploadOptions.projectName).toBe("custom-name");
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Project: custom-name");
  });

  it("parses project name from HTTPS git remote URL", async () => {
    mockLoadToken.mockReturnValue("klm_test");
    mockLoadLastRun.mockReturnValue({
      runnerResult: { runResult: { totalTests: 2, passed: 2, failed: 0, passRate: 1, durationMs: 200 }, aggregated: [] },
      suiteName: "suite",
      configHash: "def",
      timestamp: "2026-01-01T00:00:00Z",
    });
    const mockClient = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), baseUrl: "" };
    mockCreateCloudClient.mockReturnValue(mockClient);
    mockUploadResults.mockResolvedValue({ runId: "run-2", projectId: "proj-2" });
    mockExecSync.mockReturnValue("https://github.com/org/my-repo.git\n" as never);

    try {
      await program.parseAsync(["node", "kindlm", "upload"]);
    } catch {
      // commander exitOverride
    }

    expect(mockUploadResults).toHaveBeenCalledOnce();
    const uploadOptions = mockUploadResults.mock.calls[0]![2];
    expect(uploadOptions.projectName).toBe("my-repo");
  });

  it("parses project name from SSH git remote URL", async () => {
    mockLoadToken.mockReturnValue("klm_test");
    mockLoadLastRun.mockReturnValue({
      runnerResult: { runResult: { totalTests: 1, passed: 1, failed: 0, passRate: 1, durationMs: 50 }, aggregated: [] },
      suiteName: "suite",
      configHash: "ghi",
      timestamp: "2026-01-01T00:00:00Z",
    });
    const mockClient = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), baseUrl: "" };
    mockCreateCloudClient.mockReturnValue(mockClient);
    mockUploadResults.mockResolvedValue({ runId: "run-3", projectId: "proj-3" });
    mockExecSync.mockReturnValue("git@github.com:org/ssh-repo.git\n" as never);

    try {
      await program.parseAsync(["node", "kindlm", "upload"]);
    } catch {
      // commander exitOverride
    }

    expect(mockUploadResults).toHaveBeenCalledOnce();
    const uploadOptions = mockUploadResults.mock.calls[0]![2];
    expect(uploadOptions.projectName).toBe("ssh-repo");
  });

  it("fails when no token is available", async () => {
    mockLoadToken.mockReturnValue(null);
    delete process.env["KINDLM_API_TOKEN"];

    try {
      await program.parseAsync(["node", "kindlm", "upload"]);
    } catch {
      // process.exit throws
    }

    expect(exitCode).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("Not authenticated");
  });

  it("fails when no last run data exists", async () => {
    mockLoadToken.mockReturnValue("klm_test");
    mockLoadLastRun.mockReturnValue(null);

    try {
      await program.parseAsync(["node", "kindlm", "upload"]);
    } catch {
      // process.exit throws
    }

    expect(exitCode).toBe(1);
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("No test run found");
  });
});
