export interface CIEnvironment {
  name: string | null;
  isCI: boolean;
  commitSha: string | null;
  branch: string | null;
}

export function detectCI(): CIEnvironment {
  if (process.env["GITHUB_ACTIONS"]) {
    return {
      name: "github_actions",
      isCI: true,
      commitSha: process.env["GITHUB_SHA"] ?? null,
      branch: process.env["GITHUB_REF_NAME"] ?? null,
    };
  }

  if (process.env["GITLAB_CI"]) {
    return {
      name: "gitlab_ci",
      isCI: true,
      commitSha: process.env["CI_COMMIT_SHA"] ?? null,
      branch: process.env["CI_COMMIT_BRANCH"] ?? null,
    };
  }

  if (process.env["CI"]) {
    return {
      name: null,
      isCI: true,
      commitSha: null,
      branch: null,
    };
  }

  return {
    name: null,
    isCI: false,
    commitSha: null,
    branch: null,
  };
}
