import { describe, it, expect } from "vitest";
import { createTrajectoryAssertion } from "./trajectory.js";
import type { AssertionContext } from "./interface.js";

function makeContext(
  calls: Array<{ name: string; arguments: Record<string, unknown> }>,
): AssertionContext {
  return {
    outputText: "",
    toolCalls: calls.map((c, i) => ({
      id: `t${i}`,
      name: c.name,
      arguments: c.arguments,
      index: i,
    })),
    configDir: "/tmp",
  };
}

describe("trajectory metrics", () => {
  const ref = [
    { tool: "lookup_order", args: { id: 1 } },
    { tool: "issue_refund", args: { id: 1, amount: 50 } },
  ];

  it("TRAJ-01: precision = 1.0 when predicted is subset of reference", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      precision: { minScore: 1.0 },
      exactMatch: false,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([{ name: "lookup_order", arguments: { id: 1 } }]);
    const [result] = await a.evaluate(ctx);
    expect(result?.assertionType).toBe("trajectory_precision");
    expect(result?.score).toBe(1.0);
    expect(result?.passed).toBe(true);
  });

  it("TRAJ-01: precision penalizes extra unmatched tool calls", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      precision: { minScore: 1.0 },
      exactMatch: false,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "lookup_order", arguments: { id: 1 } },
      { name: "send_spam", arguments: {} },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result?.score).toBe(0.5);
    expect(result?.passed).toBe(false);
    expect(result?.failureCode).toBe("TRAJECTORY_PRECISION_LOW");
  });

  it("TRAJ-02: recall = 0.5 when predicted misses a reference step", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      recall: { minScore: 1.0 },
      exactMatch: false,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([{ name: "lookup_order", arguments: { id: 1 } }]);
    const [result] = await a.evaluate(ctx);
    expect(result?.assertionType).toBe("trajectory_recall");
    expect(result?.score).toBe(0.5);
    expect(result?.failureCode).toBe("TRAJECTORY_RECALL_LOW");
  });

  it("TRAJ-02: recall = 1.0 when predicted covers all reference steps", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      recall: { minScore: 1.0 },
      exactMatch: false,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "lookup_order", arguments: { id: 1 } },
      { name: "issue_refund", arguments: { id: 1, amount: 50 } },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result?.score).toBe(1.0);
    expect(result?.passed).toBe(true);
  });

  it("TRAJ-03: exact_match = 1 on identical ordered sequence", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      exactMatch: true,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "lookup_order", arguments: { id: 1 } },
      { name: "issue_refund", arguments: { id: 1, amount: 50 } },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result?.assertionType).toBe("trajectory_exact_match");
    expect(result?.score).toBe(1);
    expect(result?.passed).toBe(true);
  });

  it("TRAJ-03: exact_match = 0 when ordered and order differs", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      exactMatch: true,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "issue_refund", arguments: { id: 1, amount: 50 } },
      { name: "lookup_order", arguments: { id: 1 } },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result?.score).toBe(0);
    expect(result?.passed).toBe(false);
    expect(result?.failureCode).toBe("TRAJECTORY_EXACT_MISMATCH");
  });

  it("TRAJ-04: ordered: false accepts a permuted exact_match sequence", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      exactMatch: true,
      ordered: false,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "issue_refund", arguments: { id: 1, amount: 50 } },
      { name: "lookup_order", arguments: { id: 1 } },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result?.score).toBe(1);
    expect(result?.passed).toBe(true);
  });

  it("handles duplicate tool calls as a multiset (precision 2/3, recall 1)", async () => {
    const refDup = [
      { tool: "search", args: {} },
      { tool: "search", args: {} },
    ];
    const a = createTrajectoryAssertion({
      reference: refDup,
      precision: { minScore: 0.5 },
      recall: { minScore: 0.5 },
      exactMatch: false,
      ordered: false,
      matchArgs: false,
    });
    const ctx = makeContext([
      { name: "search", arguments: {} },
      { name: "search", arguments: {} },
      { name: "search", arguments: {} },
    ]);
    const results = await a.evaluate(ctx);
    expect(
      results.find((r) => r.assertionType === "trajectory_precision")?.score,
    ).toBeCloseTo(2 / 3);
    expect(
      results.find((r) => r.assertionType === "trajectory_recall")?.score,
    ).toBe(1);
  });

  it("canonicalizes argument key order for exact_match (ordered)", async () => {
    const a = createTrajectoryAssertion({
      reference: [{ tool: "f", args: { a: 1, b: 2 } }],
      exactMatch: true,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([{ name: "f", arguments: { b: 2, a: 1 } }]);
    const [result] = await a.evaluate(ctx);
    expect(result?.passed).toBe(true);
  });

  it("matchArgs: false ignores arguments entirely in exact_match", async () => {
    const a = createTrajectoryAssertion({
      reference: [{ tool: "send_email", args: { to: "real@example.com" } }],
      exactMatch: true,
      ordered: true,
      matchArgs: false,
    });
    const ctx = makeContext([
      { name: "send_email", arguments: { to: "different@example.com" } },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result?.passed).toBe(true);
  });

  it("empty predicted → precision score 0 (not NaN) with clear message", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      precision: { minScore: 0.5 },
      exactMatch: false,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([]);
    const [result] = await a.evaluate(ctx);
    expect(result?.score).toBe(0);
    expect(Number.isNaN(result?.score)).toBe(false);
    expect(result?.failureMessage).toContain("pred=0");
  });

  it("emits exactly 3 results when precision, recall, and exact_match are all enabled", async () => {
    const a = createTrajectoryAssertion({
      reference: ref,
      precision: { minScore: 1.0 },
      recall: { minScore: 1.0 },
      exactMatch: true,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "lookup_order", arguments: { id: 1 } },
      { name: "issue_refund", arguments: { id: 1, amount: 50 } },
    ]);
    const results = await a.evaluate(ctx);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.assertionType).sort()).toEqual([
      "trajectory_exact_match",
      "trajectory_precision",
      "trajectory_recall",
    ]);
  });

  it("is prototype-pollution safe when args contain __proto__ (exact_match)", async () => {
    const polluted = JSON.parse('{"__proto__": {"polluted": true}, "id": 1}');
    const a = createTrajectoryAssertion({
      reference: [{ tool: "f", args: polluted }],
      exactMatch: true,
      ordered: true,
      matchArgs: true,
    });
    const ctx = makeContext([
      { name: "f", arguments: JSON.parse('{"id": 1, "__proto__": {"polluted": true}}') },
    ]);
    const [result] = await a.evaluate(ctx);
    expect(result?.passed).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
