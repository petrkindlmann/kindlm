export interface GitInfo {
  commitSha: string | null;
  branch: string | null;
  dirty: boolean;
}

export function getGitInfo(): GitInfo {
  throw new Error("Not implemented");
}
