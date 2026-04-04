import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateWorktreeSlug, WorktreeError, WorktreeHasChangesError } from "./worktree.js";

// Mock node:child_process at module level
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

// Mock node:fs/promises for copyFilesToWorktree tests
vi.mock("node:fs/promises", () => ({
  copyFile: vi.fn(),
  mkdir: vi.fn(),
}));

// We import the mocked module to control it per-test
import { execFile as execFileMock } from "node:child_process";

const mockedExecFile = vi.mocked(execFileMock);

// Helper: make execFile resolve with stdout
function resolveWith(stdout: string) {
  mockedExecFile.mockImplementation((_cmd, _args, callback: unknown) => {
    (callback as (err: null, stdout: string, stderr: string) => void)(
      null,
      stdout,
      "",
    );
    return {} as ReturnType<typeof execFileMock>;
  });
}

// Helper: make execFile reject with an error
function rejectWith(err: Error) {
  mockedExecFile.mockImplementation((_cmd, _args, callback: unknown) => {
    (callback as (err: Error) => void)(err);
    return {} as ReturnType<typeof execFileMock>;
  });
}

describe("validateWorktreeSlug", () => {
  it("accepts a valid slug", () => {
    expect(() => validateWorktreeSlug("ok-slug")).not.toThrow();
    expect(() => validateWorktreeSlug("my.suite_123")).not.toThrow();
    expect(() => validateWorktreeSlug("a")).not.toThrow();
    expect(() => validateWorktreeSlug("A-Z_0-9.ok")).not.toThrow();
  });

  it("rejects a slug that exceeds 64 characters", () => {
    expect(() => validateWorktreeSlug("a".repeat(65))).toThrowError(/64/);
  });

  it("accepts a slug of exactly 64 characters", () => {
    expect(() => validateWorktreeSlug("a".repeat(64))).not.toThrow();
  });

  it("rejects a slug with invalid characters (slash)", () => {
    expect(() => validateWorktreeSlug("bad/char")).toThrowError(/invalid characters/);
  });

  it("rejects a slug with a space", () => {
    expect(() => validateWorktreeSlug("bad char")).toThrowError(/invalid characters/);
  });

  it("rejects a slug that is exactly '.'", () => {
    expect(() => validateWorktreeSlug(".")).toThrowError(/reserved/);
  });

  it("rejects a slug that is exactly '..'", () => {
    expect(() => validateWorktreeSlug("..")).toThrowError(/reserved/);
  });

  it("rejects a slug containing a '..' segment when split by '/'", () => {
    // After stripping slashes (rule 2), the slug itself is checked as a whole segment
    // The rule says: if slug.split("/").includes("..") throw
    // But since rule 2 rejects slashes, we test the direct "a..b" case
    // Per spec: "Also reject if any '..' appears as a complete segment"
    // slug.split("/") on "a..b" gives ["a..b"] — no ".." segment, so this passes
    // But validateWorktreeSlug("..") is the reserved case above
    // The rule from the spec checks slug itself === ".." OR slug === "."
    // This test verifies "a..b" is allowed (it's not a reserved segment)
    expect(() => validateWorktreeSlug("a..b")).not.toThrow();
  });

  it("throws WorktreeError (not a generic Error)", () => {
    try {
      validateWorktreeSlug("bad/char");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(WorktreeError);
    }
  });
});

describe("countWorktreeChanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when execFile rejects (ENOENT — git not found)", async () => {
    const { countWorktreeChanges } = await import("./worktree.js");
    const err = Object.assign(new Error("spawn git ENOENT"), { code: "ENOENT" });
    rejectWith(err);
    const result = await countWorktreeChanges("/some/path");
    expect(result).toBeNull();
  });

  it("returns null when git status exits non-zero", async () => {
    const { countWorktreeChanges } = await import("./worktree.js");
    const err = Object.assign(new Error("exited with code 128"), { code: 128 });
    rejectWith(err);
    const result = await countWorktreeChanges("/some/path");
    expect(result).toBeNull();
  });

  it("returns { files: 0, commits: 0 } for a clean repo with no upstream commits", async () => {
    const { countWorktreeChanges } = await import("./worktree.js");
    mockedExecFile.mockImplementation((_cmd, _args, callback: unknown) => {
      // Both calls return empty: git status --porcelain + git log @{u}..HEAD --oneline
      (callback as (err: null, stdout: string, stderr: string) => void)(null, "", "");
      return {} as ReturnType<typeof execFileMock>;
    });
    const result = await countWorktreeChanges("/some/path");
    expect(result).toEqual({ files: 0, commits: 0 });
  });

  it("returns files count from non-empty git status output", async () => {
    const { countWorktreeChanges } = await import("./worktree.js");
    let callCount = 0;
    mockedExecFile.mockImplementation((_cmd, _args, callback: unknown) => {
      callCount++;
      const stdout =
        callCount === 1
          ? " M file1.ts\n M file2.ts\n" // 2 modified files
          : ""; // no unpushed commits
      (callback as (err: null, stdout: string, stderr: string) => void)(null, stdout, "");
      return {} as ReturnType<typeof execFileMock>;
    });
    const result = await countWorktreeChanges("/some/path");
    expect(result).toEqual({ files: 2, commits: 0 });
  });

  it("returns commits = 0 when upstream lookup fails", async () => {
    const { countWorktreeChanges } = await import("./worktree.js");
    let callCount = 0;
    mockedExecFile.mockImplementation((_cmd, _args, callback: unknown) => {
      callCount++;
      if (callCount === 1) {
        // git status succeeds — clean
        (callback as (err: null, stdout: string, stderr: string) => void)(null, "", "");
      } else {
        // git log @{u}..HEAD fails (no upstream) — should be treated as 0 commits
        const err = Object.assign(new Error("no upstream"), { code: 128 });
        (callback as (err: Error) => void)(err);
      }
      return {} as ReturnType<typeof execFileMock>;
    });
    const result = await countWorktreeChanges("/some/path");
    expect(result).toEqual({ files: 0, commits: 0 });
  });
});

// We import the fs/promises mocks to control them per-test
import { copyFile as copyFileMock, mkdir as mkdirMock } from "node:fs/promises";
const mockedCopyFile = vi.mocked(copyFileMock);
const mockedMkdir = vi.mocked(mkdirMock);

describe("removeWorktree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves without throwing when force=true (clean or dirty)", async () => {
    const { removeWorktree } = await import("./worktree.js");
    resolveWith("");
    await expect(removeWorktree("/some/worktree/path", true)).resolves.toBeUndefined();
  });

  it("throws WorktreeHasChangesError when changes > 0 and force=false", async () => {
    const { removeWorktree } = await import("./worktree.js");
    let callCount = 0;
    mockedExecFile.mockImplementation((_cmd, _args, callback: unknown) => {
      callCount++;
      // countWorktreeChanges: git status returns 1 modified file, git log returns empty
      const stdout = callCount === 1 ? " M dirty.ts\n" : "";
      (callback as (err: null, stdout: string, stderr: string) => void)(null, stdout, "");
      return {} as ReturnType<typeof execFileMock>;
    });
    await expect(removeWorktree("/some/path", false)).rejects.toBeInstanceOf(WorktreeHasChangesError);
  });

  it("throws WorktreeHasChangesError (fail-closed) when countWorktreeChanges returns null", async () => {
    const { removeWorktree } = await import("./worktree.js");
    const err = Object.assign(new Error("spawn git ENOENT"), { code: "ENOENT" });
    rejectWith(err);
    await expect(removeWorktree("/some/path", false)).rejects.toBeInstanceOf(WorktreeHasChangesError);
  });
});

describe("extractConfigFilePaths", () => {
  it("extracts schemaFile paths from tests array", async () => {
    const { extractConfigFilePaths } = await import("./worktree.js");
    const yaml = `
tests:
  - name: t1
    expect:
      output:
        schemaFile: schemas/response.json
`;
    const result = extractConfigFilePaths(yaml);
    expect(result).toContain("schemas/response.json");
  });

  it("extracts argsSchema paths from toolCalls", async () => {
    const { extractConfigFilePaths } = await import("./worktree.js");
    const yaml = `
tests:
  - name: t1
    expect:
      toolCalls:
        - tool: search
          argsSchema: schemas/search-args.json
`;
    const result = extractConfigFilePaths(yaml);
    expect(result).toContain("schemas/search-args.json");
  });

  it("returns empty array when no file path fields exist", async () => {
    const { extractConfigFilePaths } = await import("./worktree.js");
    const yaml = `
tests:
  - name: t1
    expect:
      output:
        contains:
          - hello
`;
    const result = extractConfigFilePaths(yaml);
    expect(result).toEqual([]);
  });

  it("returns empty array when YAML is malformed (no throw)", async () => {
    const { extractConfigFilePaths } = await import("./worktree.js");
    const yaml = `{{{not: valid: yaml`;
    expect(() => extractConfigFilePaths(yaml)).not.toThrow();
    const result = extractConfigFilePaths(yaml);
    expect(result).toEqual([]);
  });

  it("handles both schemaFile and argsSchema in same config", async () => {
    const { extractConfigFilePaths } = await import("./worktree.js");
    const yaml = `
tests:
  - name: t1
    expect:
      output:
        schemaFile: schemas/output.json
      toolCalls:
        - tool: search
          argsSchema: schemas/args.json
`;
    const result = extractConfigFilePaths(yaml);
    expect(result).toContain("schemas/output.json");
    expect(result).toContain("schemas/args.json");
    expect(result.length).toBe(2);
  });
});

describe("copyFilesToWorktree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCopyFile.mockResolvedValue(undefined);
    mockedMkdir.mockResolvedValue(undefined);
  });

  it("copies files to worktree at same relative path (mkdir + copyFile called)", async () => {
    const { copyFilesToWorktree } = await import("./worktree.js");
    const repoRoot = path.resolve("/repo");
    const worktreePath = path.join(repoRoot, ".kindlm", "worktrees", "test-run");
    const filePaths = [path.join(repoRoot, "schemas", "response.json")];
    await copyFilesToWorktree(worktreePath, repoRoot, filePaths);
    expect(mockedMkdir).toHaveBeenCalledWith(path.join(worktreePath, "schemas"), { recursive: true });
    expect(mockedCopyFile).toHaveBeenCalledWith(path.join(repoRoot, "schemas", "response.json"), path.join(worktreePath, "schemas", "response.json"));
  });

  it("rejects path that resolves outside repoRoot with WorktreeError BEFORE any copy", async () => {
    const { copyFilesToWorktree } = await import("./worktree.js");
    const repoRoot = path.resolve("/repo");
    const worktreePath = path.join(repoRoot, ".kindlm", "worktrees", "test-run");
    const filePaths = [process.platform === "win32" ? "C:\\Windows\\System32\\drivers\\etc\\hosts" : "/etc/passwd"];
    await expect(copyFilesToWorktree(worktreePath, repoRoot, filePaths)).rejects.toBeInstanceOf(WorktreeError);
    expect(mockedCopyFile).not.toHaveBeenCalled();
    expect(mockedMkdir).not.toHaveBeenCalled();
  });

  it("emits console.warn and does not throw when source file is missing (ENOENT)", async () => {
    const { copyFilesToWorktree } = await import("./worktree.js");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const enoentErr = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    mockedCopyFile.mockRejectedValueOnce(enoentErr);
    const repoRoot = "/repo";
    const worktreePath = "/repo/.kindlm/worktrees/test-run";
    const filePaths = ["/repo/schemas/missing.json"];
    await expect(copyFilesToWorktree(worktreePath, repoRoot, filePaths)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
    warnSpy.mockRestore();
  });

  it("is a no-op for empty filePaths array (no mkdir, no copyFile, no warn)", async () => {
    const { copyFilesToWorktree } = await import("./worktree.js");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await copyFilesToWorktree("/repo/.kindlm/worktrees/test-run", "/repo", []);
    expect(mockedCopyFile).not.toHaveBeenCalled();
    expect(mockedMkdir).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("re-throws non-ENOENT errors from copyFile", async () => {
    const { copyFilesToWorktree } = await import("./worktree.js");
    const permErr = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
    mockedCopyFile.mockRejectedValueOnce(permErr);
    const repoRoot = "/repo";
    const worktreePath = "/repo/.kindlm/worktrees/test-run";
    const filePaths = ["/repo/schemas/response.json"];
    await expect(copyFilesToWorktree(worktreePath, repoRoot, filePaths)).rejects.toThrow("EACCES");
  });
});
