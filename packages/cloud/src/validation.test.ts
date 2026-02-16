import { describe, it, expect } from "vitest";
import {
  createProjectBody,
  createSuiteBody,
  createRunBody,
  updateRunBody,
  uploadResultsBody,
  createWebhookBody,
  createTokenBody,
  inviteMemberBody,
  updateMemberRoleBody,
  createBaselineBody,
  parseIntBounded,
  validateBody,
} from "./validation.js";

describe("parseIntBounded", () => {
  it("returns default for undefined", () => {
    expect(parseIntBounded(undefined, 50, 1, 100)).toBe(50);
  });

  it("returns default for NaN", () => {
    expect(parseIntBounded("abc", 50, 1, 100)).toBe(50);
  });

  it("clamps to min", () => {
    expect(parseIntBounded("-5", 50, 1, 100)).toBe(1);
  });

  it("clamps to max", () => {
    expect(parseIntBounded("999", 50, 1, 100)).toBe(100);
  });

  it("parses valid number", () => {
    expect(parseIntBounded("25", 50, 1, 100)).toBe(25);
  });

  it("handles zero", () => {
    expect(parseIntBounded("0", 50, 0, 100)).toBe(0);
  });
});

describe("validateBody", () => {
  it("returns success for valid data", () => {
    const result = validateBody(createProjectBody, { name: "my-project" });
    expect(result.success).toBe(true);
  });

  it("returns error message for invalid data", () => {
    const result = validateBody(createProjectBody, { name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
    }
  });
});

describe("createProjectBody", () => {
  it("accepts valid name", () => {
    expect(createProjectBody.safeParse({ name: "my-project" }).success).toBe(true);
  });

  it("accepts name with description", () => {
    expect(createProjectBody.safeParse({ name: "test", description: "A project" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createProjectBody.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    expect(createProjectBody.safeParse({ name: "a".repeat(101) }).success).toBe(false);
  });

  it("rejects missing name", () => {
    expect(createProjectBody.safeParse({}).success).toBe(false);
  });

  it("rejects name starting with special char", () => {
    expect(createProjectBody.safeParse({ name: "-project" }).success).toBe(false);
  });
});

describe("createRunBody", () => {
  it("accepts valid suiteId", () => {
    expect(createRunBody.safeParse({ suiteId: "suite-1" }).success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = createRunBody.safeParse({
      suiteId: "s-1",
      commitSha: "abc123",
      branch: "main",
      environment: "ci",
      triggeredBy: "github-actions",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing suiteId", () => {
    expect(createRunBody.safeParse({}).success).toBe(false);
  });
});

describe("updateRunBody", () => {
  it("accepts valid status", () => {
    expect(updateRunBody.safeParse({ status: "completed" }).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(updateRunBody.safeParse({ status: "cancelled" }).success).toBe(false);
  });

  it("accepts numeric fields", () => {
    expect(updateRunBody.safeParse({ passRate: 0.95, testCount: 10 }).success).toBe(true);
  });

  it("rejects passRate out of range", () => {
    expect(updateRunBody.safeParse({ passRate: 1.5 }).success).toBe(false);
  });

  it("accepts empty object", () => {
    expect(updateRunBody.safeParse({}).success).toBe(true);
  });
});

describe("uploadResultsBody", () => {
  const validResult = {
    testCaseName: "test-1",
    modelId: "gpt-4o",
    passed: 3,
    passRate: 1.0,
    runCount: 3,
  };

  it("accepts valid results array", () => {
    expect(uploadResultsBody.safeParse({ results: [validResult] }).success).toBe(true);
  });

  it("rejects empty results array", () => {
    expect(uploadResultsBody.safeParse({ results: [] }).success).toBe(false);
  });

  it("rejects results over 500", () => {
    const items = Array.from({ length: 501 }, (_, i) => ({
      ...validResult,
      testCaseName: `test-${i}`,
    }));
    expect(uploadResultsBody.safeParse({ results: items }).success).toBe(false);
  });

  it("rejects missing testCaseName", () => {
    const invalid = { ...validResult, testCaseName: "" };
    expect(uploadResultsBody.safeParse({ results: [invalid] }).success).toBe(false);
  });
});

describe("createWebhookBody", () => {
  it("accepts valid HTTPS URL with events", () => {
    expect(
      createWebhookBody.safeParse({
        url: "https://example.com/hook",
        events: ["run.completed"],
      }).success,
    ).toBe(true);
  });

  it("rejects HTTP URL", () => {
    expect(
      createWebhookBody.safeParse({
        url: "http://example.com/hook",
        events: ["run.completed"],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid event type", () => {
    expect(
      createWebhookBody.safeParse({
        url: "https://example.com/hook",
        events: ["invalid.event"],
      }).success,
    ).toBe(false);
  });

  it("rejects empty events array", () => {
    expect(
      createWebhookBody.safeParse({
        url: "https://example.com/hook",
        events: [],
      }).success,
    ).toBe(false);
  });
});

describe("createTokenBody", () => {
  it("accepts valid name", () => {
    expect(createTokenBody.safeParse({ name: "ci-token" }).success).toBe(true);
  });

  it("accepts name with scope", () => {
    expect(createTokenBody.safeParse({ name: "ci", scope: "ci" }).success).toBe(true);
  });

  it("rejects invalid scope", () => {
    expect(createTokenBody.safeParse({ name: "t", scope: "admin" }).success).toBe(false);
  });
});

describe("inviteMemberBody", () => {
  it("accepts valid githubLogin", () => {
    expect(inviteMemberBody.safeParse({ githubLogin: "octocat" }).success).toBe(true);
  });

  it("accepts with role", () => {
    expect(inviteMemberBody.safeParse({ githubLogin: "octocat", role: "admin" }).success).toBe(true);
  });

  it("rejects empty githubLogin", () => {
    expect(inviteMemberBody.safeParse({ githubLogin: "" }).success).toBe(false);
  });
});

describe("updateMemberRoleBody", () => {
  it("accepts valid role", () => {
    expect(updateMemberRoleBody.safeParse({ role: "admin" }).success).toBe(true);
  });

  it("rejects invalid role", () => {
    expect(updateMemberRoleBody.safeParse({ role: "superadmin" }).success).toBe(false);
  });

  it("rejects missing role", () => {
    expect(updateMemberRoleBody.safeParse({}).success).toBe(false);
  });
});

describe("createBaselineBody", () => {
  it("accepts valid runId and label", () => {
    expect(createBaselineBody.safeParse({ runId: "run-1", label: "v1.0" }).success).toBe(true);
  });

  it("rejects empty label", () => {
    expect(createBaselineBody.safeParse({ runId: "run-1", label: "" }).success).toBe(false);
  });

  it("rejects missing runId", () => {
    expect(createBaselineBody.safeParse({ label: "v1" }).success).toBe(false);
  });
});

describe("createSuiteBody", () => {
  it("accepts valid suite data", () => {
    expect(createSuiteBody.safeParse({ name: "my-suite", configHash: "abc123" }).success).toBe(true);
  });

  it("rejects missing configHash", () => {
    expect(createSuiteBody.safeParse({ name: "my-suite" }).success).toBe(false);
  });
});
