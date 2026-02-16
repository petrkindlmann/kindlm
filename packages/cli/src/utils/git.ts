import { execSync } from "node:child_process";

export interface GitInfo {
  commitSha: string | null;
  branch: string | null;
  dirty: boolean;
}

export function getGitInfo(): GitInfo {
  try {
    const commitSha = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim() || null;
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim() || null;
    const status = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
    const dirty = status.length > 0;
    return { commitSha, branch, dirty };
  } catch {
    return { commitSha: null, branch: null, dirty: false };
  }
}
