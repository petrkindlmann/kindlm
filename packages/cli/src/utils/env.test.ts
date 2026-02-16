import { describe, it, expect, beforeEach } from "vitest";
import { detectCI } from "./env.js";

describe("detectCI", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear all CI-related env vars
    delete process.env["GITHUB_ACTIONS"];
    delete process.env["GITHUB_SHA"];
    delete process.env["GITHUB_REF_NAME"];
    delete process.env["GITLAB_CI"];
    delete process.env["CI_COMMIT_SHA"];
    delete process.env["CI_COMMIT_BRANCH"];
    delete process.env["CI"];
  });

  it("detects GitHub Actions", () => {
    process.env["GITHUB_ACTIONS"] = "true";
    process.env["GITHUB_SHA"] = "abc123";
    process.env["GITHUB_REF_NAME"] = "main";

    const ci = detectCI();
    expect(ci.name).toBe("github_actions");
    expect(ci.isCI).toBe(true);
    expect(ci.commitSha).toBe("abc123");
    expect(ci.branch).toBe("main");
  });

  it("detects GitLab CI", () => {
    process.env["GITLAB_CI"] = "true";
    process.env["CI_COMMIT_SHA"] = "def456";
    process.env["CI_COMMIT_BRANCH"] = "develop";

    const ci = detectCI();
    expect(ci.name).toBe("gitlab_ci");
    expect(ci.isCI).toBe(true);
    expect(ci.commitSha).toBe("def456");
    expect(ci.branch).toBe("develop");
  });

  it("detects generic CI", () => {
    process.env["CI"] = "true";

    const ci = detectCI();
    expect(ci.name).toBeNull();
    expect(ci.isCI).toBe(true);
    expect(ci.commitSha).toBeNull();
    expect(ci.branch).toBeNull();
  });

  it("detects non-CI environment", () => {
    const ci = detectCI();
    expect(ci.name).toBeNull();
    expect(ci.isCI).toBe(false);
    expect(ci.commitSha).toBeNull();
    expect(ci.branch).toBeNull();
  });
});
