import { describe, it, expect } from "vitest";
import { formatTestPlan } from "./dry-run.js";
import type { TestPlan, TestPlanEntry } from "@kindlm/core";

// ANSI escape stripped for exact-string assertions where needed
function stripAnsi(s: string): string {
  return s.replace(/\x1B\[[0-9;]*m/g, "");
}

function makeEntry(overrides: Partial<TestPlanEntry> = {}): TestPlanEntry {
  return {
    testName: "greeting",
    modelId: "gpt-4o",
    provider: "openai",
    repeat: 1,
    assertionTypes: ["keywords"],
    isCommand: false,
    skip: false,
    tags: [],
    ...overrides,
  };
}

function makePlan(overrides: Partial<TestPlan> = {}): TestPlan {
  return {
    suiteName: "my-suite",
    suiteDescription: undefined,
    project: "test-project",
    entries: [makeEntry()],
    totalExecutionUnits: 5,
    concurrency: 4,
    timeoutMs: 30000,
    ...overrides,
  };
}

describe("formatTestPlan", () => {
  it("outputs suite name, project, and totals section", () => {
    const output = stripAnsi(formatTestPlan(makePlan()));

    expect(output).toContain("my-suite");
    expect(output).toContain("test-project");
    expect(output).toContain("Total execution units: 5");
    expect(output).toContain("Concurrency: 4");
    expect(output).toContain("30000ms");
  });

  it("lists active tests under Tests to execute", () => {
    const plan = makePlan({
      entries: [
        makeEntry({ testName: "alpha" }),
        makeEntry({ testName: "beta" }),
      ],
    });
    const output = stripAnsi(formatTestPlan(plan));

    expect(output).toContain("Tests to execute:");
    expect(output).toContain("alpha");
    expect(output).toContain("beta");
  });

  it("separates skip:true entries under Skipped section", () => {
    const plan = makePlan({
      entries: [
        makeEntry({ testName: "active-test" }),
        makeEntry({ testName: "skipped-test", skip: true }),
      ],
    });
    const output = stripAnsi(formatTestPlan(plan));

    expect(output).toContain("Tests to execute:");
    expect(output).toContain("active-test");
    expect(output).toContain("Skipped:");
    expect(output).toContain("skipped-test");
  });

  it("renders command entries with [command] label instead of model ID", () => {
    const plan = makePlan({
      entries: [makeEntry({ testName: "cmd-test", isCommand: true, modelId: "n/a" })],
    });
    const output = stripAnsi(formatTestPlan(plan));

    expect(output).toContain("[command]");
    expect(output).not.toContain("[n/a]");
  });

  it("outputs suite description when present", () => {
    const plan = makePlan({ suiteDescription: "runs behavioral checks" });
    const output = stripAnsi(formatTestPlan(plan));

    expect(output).toContain("runs behavioral checks");
  });

  it("outputs No tests to execute when all entries are skipped", () => {
    const plan = makePlan({
      entries: [makeEntry({ skip: true })],
    });
    const output = stripAnsi(formatTestPlan(plan));

    expect(output).toContain("No tests to execute.");
  });

  it("outputs repeat multiplier when repeat > 1", () => {
    const plan = makePlan({
      entries: [makeEntry({ repeat: 3 })],
    });
    const output = stripAnsi(formatTestPlan(plan));

    expect(output).toContain("x3");
  });

  it("outputs tags when entry has tags", () => {
    const plan = makePlan({
      entries: [makeEntry({ tags: ["smoke", "fast"] })],
    });
    const output = stripAnsi(formatTestPlan(plan));

    expect(output).toContain("smoke");
    expect(output).toContain("fast");
  });
});
