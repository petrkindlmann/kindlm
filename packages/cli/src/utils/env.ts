export interface CIEnvironment {
  name: string | null;
  isCI: boolean;
  commitSha: string | null;
  branch: string | null;
}

export function detectCI(): CIEnvironment {
  throw new Error("Not implemented");
}
