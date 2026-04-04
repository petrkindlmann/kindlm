import { execFile } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parse as yamlParse } from "yaml";
import chalk from "chalk";

// Wrap execFile in a promise manually so that vi.mock("node:child_process") works correctly
// in tests. util.promisify.custom on the real execFile resolves to { stdout, stderr } but
// a mocked execFile loses that symbol, so we wrap it ourselves.
function execFileAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Fail-closed: treat any uncertainty about worktree state as "has changes"

export class WorktreeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorktreeError";
  }
}

export class WorktreeHasChangesError extends WorktreeError {
  constructor(
    public readonly worktreePath: string,
    public readonly files: number,
    public readonly commits: number,
  ) {
    super(
      `Worktree at ${worktreePath} has uncommitted files (${files}) or unpushed commits (${commits}). ` +
        `Cleanup skipped. Remove it manually or use force=true.`,
    );
    this.name = "WorktreeHasChangesError";
  }
}

/**
 * Validates a worktree slug to prevent path traversal and ensure git compatibility.
 * Rules:
 *   1. Length: 1–64 chars
 *   2. Charset: only a-z A-Z 0-9 . _ - allowed
 *   3. Reserved: slug must not be "." or ".."
 */
export function validateWorktreeSlug(slug: string): void {
  if (slug.length > 64) {
    throw new WorktreeError("slug exceeds 64 characters");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(slug)) {
    throw new WorktreeError("slug contains invalid characters: only a-z A-Z 0-9 . _ - allowed");
  }
  // Reject reserved path segments (. and ..)
  if (slug === "." || slug === "..") {
    throw new WorktreeError("slug uses reserved path segment");
  }
  // Also reject if any ".." appears as a complete segment when treated as a path
  if (slug.split("/").includes("..")) {
    throw new WorktreeError("slug uses reserved path segment");
  }
}

/**
 * Counts uncommitted files and unpushed commits in a git worktree.
 * Returns null (fail-closed) when git is unavailable or the repo state cannot be determined.
 */
export async function countWorktreeChanges(
  worktreePath: string,
): Promise<{ files: number; commits: number } | null> {
  let statusOutput: string;
  try {
    statusOutput = await execFileAsync("git", ["-C", worktreePath, "status", "--porcelain"]);
  } catch {
    // git unavailable or not a git repo — fail-closed
    return null;
  }

  const files = statusOutput
    .split("\n")
    .filter((line) => line.trim().length > 0).length;

  // Count unpushed commits; if no upstream is set, treat as 0 (no commits to push)
  let commits = 0;
  try {
    const logOutput = await execFileAsync("git", [
      "-C",
      worktreePath,
      "log",
      "@{u}..HEAD",
      "--oneline",
    ]);
    commits = logOutput
      .split("\n")
      .filter((line) => line.trim().length > 0).length;
  } catch {
    // No upstream configured — treat as 0 unpushed commits
    commits = 0;
  }

  return { files, commits };
}

/**
 * Removes a git worktree.
 * Without force: checks for changes first and throws WorktreeHasChangesError if any exist.
 * Fail-closed: if the check itself fails, treats as having changes.
 */
export async function removeWorktree(worktreePath: string, force?: boolean): Promise<void> {
  if (force !== true) {
    const changes = await countWorktreeChanges(worktreePath);
    if (changes === null) {
      // Cannot determine state — fail-closed
      throw new WorktreeHasChangesError(worktreePath, -1, -1);
    }
    if (changes.files > 0 || changes.commits > 0) {
      throw new WorktreeHasChangesError(worktreePath, changes.files, changes.commits);
    }
  }

  const args = ["worktree", "remove"];
  if (force === true) {
    args.push("--force");
  }
  args.push(worktreePath);
  await execFileAsync("git", args);
}

/**
 * Creates an isolated git worktree for a test run.
 * The worktree is created as a detached HEAD to avoid branch name conflicts.
 * Returns the worktree path, branch label, and a cleanup function.
 */
export async function createWorktree(
  slug: string,
  repoRoot?: string,
): Promise<{ path: string; branch: string; cleanup(): Promise<void> }> {
  validateWorktreeSlug(slug);

  const root = repoRoot ?? process.cwd();
  const worktreePath = path.join(root, ".kindlm", "worktrees", slug);

  await execFileAsync("git", ["worktree", "add", "--detach", worktreePath]);

  const cleanup = async (): Promise<void> => {
    try {
      await removeWorktree(worktreePath, false);
    } catch (e) {
      if (e instanceof WorktreeHasChangesError) {
        // Log and swallow — do not rethrow; user must clean up manually
        // eslint-disable-next-line no-console
        console.warn(
          `Warning: worktree at ${e.worktreePath} has uncommitted changes or unpushed commits. ` +
            `Skipping cleanup. Remove manually: git worktree remove --force ${e.worktreePath}`,
        );
        return;
      }
      throw e;
    }
  };

  return { path: worktreePath, branch: "HEAD", cleanup };
}

/**
 * Extracts all file path references (schemaFile, argsSchema) from a raw kindlm.yaml string.
 * Best-effort: returns [] on parse error rather than throwing.
 * Used to build the copy list for --isolate mode before chdir().
 */
export function extractConfigFilePaths(yamlContent: string): string[] {
  let raw: Record<string, unknown>;
  try {
    raw = yamlParse(yamlContent) as Record<string, unknown>;
    if (typeof raw !== "object" || raw === null) return [];
  } catch {
    return [];
  }

  const tests = Array.isArray(raw["tests"]) ? (raw["tests"] as unknown[]) : [];
  const paths: string[] = [];

  for (const test of tests) {
    if (typeof test !== "object" || test === null) continue;
    const t = test as Record<string, unknown>;
    const expect_ = typeof t["expect"] === "object" && t["expect"] !== null
      ? (t["expect"] as Record<string, unknown>)
      : null;
    if (!expect_) continue;

    // expect.output.schemaFile
    const output = typeof expect_["output"] === "object" && expect_["output"] !== null
      ? (expect_["output"] as Record<string, unknown>)
      : null;
    if (output && typeof output["schemaFile"] === "string") {
      paths.push(output["schemaFile"]);
    }

    // expect.toolCalls[].argsSchema
    if (Array.isArray(expect_["toolCalls"])) {
      for (const tc of expect_["toolCalls"] as unknown[]) {
        if (typeof tc === "object" && tc !== null) {
          const toolCall = tc as Record<string, unknown>;
          if (typeof toolCall["argsSchema"] === "string") {
            paths.push(toolCall["argsSchema"]);
          }
        }
      }
    }
  }

  // Deduplicate
  return [...new Set(paths)];
}

/**
 * Copies a list of files into a worktree at their relative paths from repoRoot.
 * Path escape guard runs first — throws WorktreeError if any file resolves outside repoRoot.
 * Missing files (ENOENT) emit a warning and are skipped. Other errors are re-thrown.
 * Empty filePaths is a silent no-op.
 */
export async function copyFilesToWorktree(
  worktreePath: string,
  repoRoot: string,
  filePaths: string[],
): Promise<void> {
  if (filePaths.length === 0) return;

  const resolvedRoot = path.resolve(repoRoot);

  // Path escape guard: validate all paths BEFORE any copy
  for (const filePath of filePaths) {
    const resolved = path.resolve(filePath);
    if (!(resolved + path.sep).startsWith(resolvedRoot + path.sep)) {
      throw new WorktreeError(`Path escape detected: ${filePath} resolves outside repo root`);
    }
  }

  // Copy each file preserving relative path structure
  for (const filePath of filePaths) {
    const rel = path.relative(resolvedRoot, path.resolve(filePath));
    const dest = path.join(worktreePath, rel);
    try {
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(filePath, dest);
    } catch (e) {
      if (typeof e === "object" && e !== null && (e as NodeJS.ErrnoException).code === "ENOENT") {
        // eslint-disable-next-line no-console
        console.warn(chalk.yellow(`Warning: referenced file not found, skipping: ${filePath}`));
        continue;
      }
      throw e;
    }
  }
}
