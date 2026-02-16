import { describe, it, expect, vi } from "vitest";
import { getGitInfo } from "./git.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "node:child_process";
const mockExecSync = vi.mocked(execSync);

describe("getGitInfo", () => {
  it("returns git info when in a git repo", () => {
    mockExecSync
      .mockReturnValueOnce("abc123def456\n")  // git rev-parse HEAD
      .mockReturnValueOnce("main\n")           // git rev-parse --abbrev-ref HEAD
      .mockReturnValueOnce("");                 // git status --porcelain

    const info = getGitInfo();
    expect(info.commitSha).toBe("abc123def456");
    expect(info.branch).toBe("main");
    expect(info.dirty).toBe(false);
  });

  it("returns nulls when not in a git repo", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("fatal: not a git repository");
    });

    const info = getGitInfo();
    expect(info.commitSha).toBeNull();
    expect(info.branch).toBeNull();
    expect(info.dirty).toBe(false);
  });

  it("detects dirty state", () => {
    mockExecSync
      .mockReturnValueOnce("abc123\n")
      .mockReturnValueOnce("feature-branch\n")
      .mockReturnValueOnce(" M src/index.ts\n");

    const info = getGitInfo();
    expect(info.commitSha).toBe("abc123");
    expect(info.branch).toBe("feature-branch");
    expect(info.dirty).toBe(true);
  });
});
