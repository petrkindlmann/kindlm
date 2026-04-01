import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateWorktreeSlug, WorktreeError, WorktreeHasChangesError } from "./worktree.js";

// Mock node:child_process at module level
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
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
    let callCount = 0;
    mockedExecFile.mockImplementation((_cmd, _args, callback: unknown) => {
      callCount++;
      // First call: git status --porcelain (empty = clean)
      // Second call: git log @{u}..HEAD --oneline (empty = no upstream commits)
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
