import { describe, it, expect } from "vitest";
import type { Expect } from "../types/config.js";
import type { AssertionContext } from "./interface.js";
import type { ProviderToolCall } from "../types/provider.js";
import { createAssertionsFromExpect } from "./registry.js";

function makeExpect(overrides: Partial<Expect> = {}): Expect {
  return {
    ...overrides,
  };
}

/** Build a fully-typed ProviderToolCall for assertion evaluation in tests. */
function toolCall(name: string, index: number): ProviderToolCall {
  return { id: `call_${index}`, index, name, arguments: {} };
}

/** Build a minimal but type-complete AssertionContext from a tool-call sequence. */
function ctxWithToolCalls(names: string[]): AssertionContext {
  return {
    outputText: "",
    toolCalls: names.map((name, index) => toolCall(name, index)),
    configDir: ".",
  };
}

describe("createAssertionsFromExpect", () => {
  it("returns empty array for empty expect object", () => {
    const assertions = createAssertionsFromExpect(makeExpect());
    expect(assertions).toEqual([]);
  });

  // ================================================================
  // Tool call assertions
  // ================================================================

  describe("tool call assertions", () => {
    it("creates tool_called assertion for a positive tool call", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [{ tool: "lookup_order", shouldNotCall: false }],
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("tool_called");
    });

    it("creates tool_not_called assertion when shouldNotCall is true", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [{ tool: "process_refund", shouldNotCall: true }],
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("tool_not_called");
    });

    it("creates tool_order assertion when any toolCall has order set", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [
            { tool: "first", order: 0, shouldNotCall: false },
            { tool: "second", order: 1, shouldNotCall: false },
          ],
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("tool_order");
    });

    it("creates multiple tool_called assertions without order", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [
            { tool: "tool_a", shouldNotCall: false },
            { tool: "tool_b", shouldNotCall: false },
          ],
        }),
      );
      expect(assertions).toHaveLength(2);
      expect(assertions[0]?.type).toBe("tool_called");
      expect(assertions[1]?.type).toBe("tool_called");
    });

    it("mixes tool_called and tool_not_called when no order is present", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [
            { tool: "allowed", shouldNotCall: false },
            { tool: "forbidden", shouldNotCall: true },
          ],
        }),
      );
      expect(assertions).toHaveLength(2);
      expect(assertions[0]?.type).toBe("tool_called");
      expect(assertions[1]?.type).toBe("tool_not_called");
    });

    it("passes argsSchemaResolved through as stringified argsSchema", () => {
      const schema = { type: "object", properties: { id: { type: "string" } } };
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [
            {
              tool: "lookup",
              shouldNotCall: false,
              argsSchemaResolved: schema,
            },
          ],
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("tool_called");
    });

    it("passes argsSchemaResolved through in tool_order mode", () => {
      const schema = { type: "object", properties: { q: { type: "string" } } };
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [
            {
              tool: "search",
              order: 0,
              shouldNotCall: false,
              argsSchemaResolved: schema,
            },
          ],
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("tool_order");
    });

    // ----------------------------------------------------------------
    // #3: opt-in ordered tool-call sequence (toolCallsOrdered: true)
    // ----------------------------------------------------------------

    it("builds a single tool_order assertion when toolCallsOrdered is true", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCallsOrdered: true,
          toolCalls: [
            { tool: "lookup", shouldNotCall: false },
            { tool: "refund", shouldNotCall: false },
          ],
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("tool_order");
    });

    it("ordered opt-in PASSES when tool calls occur in declared order", async () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCallsOrdered: true,
          toolCalls: [
            { tool: "lookup", shouldNotCall: false },
            { tool: "refund", shouldNotCall: false },
          ],
        }),
      );
      const results = await assertions[0]!.evaluate(
        ctxWithToolCalls(["lookup", "refund"]),
      );
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it("ordered opt-in FAILS when tool calls occur out of declared order", async () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCallsOrdered: true,
          toolCalls: [
            { tool: "lookup", shouldNotCall: false },
            { tool: "refund", shouldNotCall: false },
          ],
        }),
      );
      // Actual sequence is refund-then-lookup — the unsafe order.
      const results = await assertions[0]!.evaluate(
        ctxWithToolCalls(["refund", "lookup"]),
      );
      const orderResults = results.filter((r) =>
        r.label.includes("at position"),
      );
      expect(orderResults.length).toBeGreaterThan(0);
      expect(orderResults.some((r) => !r.passed)).toBe(true);
      expect(
        orderResults.some((r) => r.failureCode === "TOOL_CALL_ORDER_WRONG"),
      ).toBe(true);
    });

    it("back-compat: plain list (no ordered, no numeric order) stays presence-only and passes regardless of order", async () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [
            { tool: "lookup", shouldNotCall: false },
            { tool: "refund", shouldNotCall: false },
          ],
        }),
      );
      // Two separate tool_called assertions, no positional checks.
      expect(assertions).toHaveLength(2);
      expect(assertions.every((a) => a.type === "tool_called")).toBe(true);
      // Calls in the "wrong" order still pass — presence-only.
      const ctx = ctxWithToolCalls(["refund", "lookup"]);
      for (const a of assertions) {
        const results = await a.evaluate(ctx);
        expect(results.every((r) => r.passed)).toBe(true);
      }
    });

    it("back-compat: numeric order: still produces positional matching unchanged", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [
            { tool: "first", order: 0, shouldNotCall: false },
            { tool: "second", order: 1, shouldNotCall: false },
          ],
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("tool_order");
    });

    it("ordered opt-in synthesizes positions skipping shouldNotCall entries", async () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCallsOrdered: true,
          toolCalls: [
            { tool: "lookup", shouldNotCall: false },
            { tool: "danger", shouldNotCall: true },
            { tool: "refund", shouldNotCall: false },
          ],
        }),
      );
      expect(assertions).toHaveLength(1);
      // lookup -> position 0, refund -> position 1, danger must NOT be called.
      const results = await assertions[0]!.evaluate(
        ctxWithToolCalls(["lookup", "refund"]),
      );
      expect(results.every((r) => r.passed)).toBe(true);
    });
  });

  // ================================================================
  // Schema assertion
  // ================================================================

  describe("schema assertion", () => {
    it("creates schema assertion from output config", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          output: { format: "text", contains: ["hello"] },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("schema");
    });

    it("passes schemaContent override to schema assertion", () => {
      const overrides = {
        schemaContent: { type: "object", properties: { name: { type: "string" } } },
      };
      const assertions = createAssertionsFromExpect(
        makeExpect({
          output: { format: "json", schemaFile: "schema.json" },
        }),
        overrides,
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("schema");
    });
  });

  // ================================================================
  // Judge assertion
  // ================================================================

  describe("judge assertion", () => {
    it("creates one judge assertion per criterion", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          judge: [
            { criteria: "Is empathetic", minScore: 0.7 },
            { criteria: "Is accurate", minScore: 0.8 },
          ],
        }),
      );
      expect(assertions).toHaveLength(2);
      expect(assertions[0]?.type).toBe("judge");
      expect(assertions[1]?.type).toBe("judge");
    });

    it("passes per-criterion model to judge assertion", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          judge: [
            { criteria: "Is professional", minScore: 0.7, model: "gpt-4o-mini" },
          ],
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("judge");
    });

    it("passes rubric to judge assertion", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          judge: [
            {
              criteria: "Is complete",
              minScore: 0.6,
              rubric: "Must cover all points",
            },
          ],
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("judge");
    });
  });

  // ================================================================
  // PII assertion
  // ================================================================

  describe("pii assertion", () => {
    it("creates pii assertion from guardrails.pii config", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          guardrails: {
            pii: {
              enabled: true,
              denyPatterns: ["\\b\\d{3}-\\d{2}-\\d{4}\\b"],
            },
          },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("pii");
    });

    it("does NOT create a pii assertion when enabled is false", () => {
      // H7: `enabled: false` must actually disable the guardrail. Previously the
      // registry gated on object presence, so the assertion ran anyway and could
      // flip a verdict / exit code the user had explicitly opted out of.
      const assertions = createAssertionsFromExpect(
        makeExpect({
          guardrails: {
            pii: {
              enabled: false,
              denyPatterns: ["\\b\\d{3}-\\d{2}-\\d{4}\\b"],
            },
          },
        }),
      );
      expect(assertions.filter((a) => a.type === "pii")).toHaveLength(0);
    });

    it("creates pii assertion with custom patterns", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          guardrails: {
            pii: {
              enabled: true,
              denyPatterns: [],
              customPatterns: [{ name: "api-key", pattern: "sk-[a-z]+" }],
            },
          },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("pii");
    });
  });

  // ================================================================
  // Keywords assertion
  // ================================================================

  describe("keywords assertion", () => {
    it("creates keywords_present assertion from allow list", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          guardrails: {
            keywords: { allow: ["hello", "world"], deny: [] },
          },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("keywords_present");
    });

    it("creates keywords_absent assertion from deny list", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          guardrails: {
            keywords: { deny: ["profanity", "violence"] },
          },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("keywords_absent");
    });

    it("creates both allow and deny keyword assertions", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          guardrails: {
            keywords: {
              allow: ["greeting"],
              deny: ["goodbye"],
            },
          },
        }),
      );
      expect(assertions).toHaveLength(2);
      const types = assertions.map((a) => a.type);
      expect(types).toContain("keywords_present");
      expect(types).toContain("keywords_absent");
    });

    it("skips allow assertion when allow is empty", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          guardrails: {
            keywords: { allow: [], deny: ["bad"] },
          },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("keywords_absent");
    });

    it("skips deny assertion when deny is empty", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          guardrails: {
            keywords: { allow: ["good"], deny: [] },
          },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("keywords_present");
    });
  });

  // ================================================================
  // Drift assertion
  // ================================================================

  describe("drift assertion", () => {
    it("creates drift assertion from baseline.drift config", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          baseline: {
            drift: { maxScore: 0.15, method: "judge" },
          },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("drift");
    });

    it("creates drift assertion with field-diff method and fields", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          baseline: {
            drift: {
              maxScore: 0.3,
              method: "field-diff",
              fields: ["action", "status"],
            },
          },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("drift");
    });
  });

  // ================================================================
  // Latency assertion
  // ================================================================

  describe("latency assertion", () => {
    it("creates latency assertion from expect.latency", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          latency: { maxMs: 5000 },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("latency");
    });
  });

  // ================================================================
  // Cost assertion
  // ================================================================

  describe("cost assertion", () => {
    it("creates cost assertion from expect.cost", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          cost: { maxUsd: 0.05 },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("cost");
    });
  });

  // ================================================================
  // Trajectory assertions (Phase 20 TRAJ-01..04)
  // ================================================================

  describe("trajectory assertions", () => {
    /** Context whose tool calls carry args, for matchArgs scoring. */
    function ctxWithCalls(
      calls: Array<{ name: string; arguments?: Record<string, unknown> }>,
    ): AssertionContext {
      return {
        outputText: "",
        toolCalls: calls.map((c, index) => ({
          id: `call_${index}`,
          index,
          name: c.name,
          arguments: c.arguments ?? {},
        })),
        configDir: ".",
      };
    }

    it("builds a single trajectory assertion from expect.trajectory", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          trajectory: {
            reference: [{ tool: "a", args: {} }],
            recall: { minScore: 1 },
            exactMatch: false,
            ordered: true,
            matchArgs: true,
          },
        }),
      );
      expect(assertions).toHaveLength(1);
      expect(assertions[0]?.type).toBe("trajectory");
    });

    it("TRAJ-01: precision result reflects extra tool calls", async () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          trajectory: {
            reference: [
              { tool: "lookup", args: {} },
              { tool: "refund", args: {} },
            ],
            precision: { minScore: 1 },
            exactMatch: false,
            ordered: true,
            matchArgs: false,
          },
        }),
      );
      const results = await assertions[0]!.evaluate(
        ctxWithCalls([{ name: "lookup" }, { name: "spam" }]),
      );
      const precision = results.find(
        (r) => r.assertionType === "trajectory_precision",
      );
      expect(precision?.score).toBe(0.5);
      expect(precision?.passed).toBe(false);
    });

    it("TRAJ-02: recall result reflects missing reference steps", async () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          trajectory: {
            reference: [
              { tool: "lookup", args: {} },
              { tool: "refund", args: {} },
            ],
            recall: { minScore: 1 },
            exactMatch: false,
            ordered: true,
            matchArgs: false,
          },
        }),
      );
      const results = await assertions[0]!.evaluate(
        ctxWithCalls([{ name: "lookup" }]),
      );
      const recall = results.find(
        (r) => r.assertionType === "trajectory_recall",
      );
      expect(recall?.score).toBe(0.5);
    });

    it("TRAJ-03 + TRAJ-04: exact_match ordered=true FAILS on reorder, ordered=false PASSES", async () => {
      const ref = [
        { tool: "lookup", args: {} },
        { tool: "refund", args: {} },
      ];
      const ctx = ctxWithCalls([{ name: "refund" }, { name: "lookup" }]);

      const ordered = createAssertionsFromExpect(
        makeExpect({
          trajectory: {
            reference: ref,
            exactMatch: true,
            ordered: true,
            matchArgs: false,
          },
        }),
      );
      const orderedRes = (await ordered[0]!.evaluate(ctx)).find(
        (r) => r.assertionType === "trajectory_exact_match",
      );
      expect(orderedRes?.score).toBe(0);
      expect(orderedRes?.passed).toBe(false);

      const anyOrder = createAssertionsFromExpect(
        makeExpect({
          trajectory: {
            reference: ref,
            exactMatch: true,
            ordered: false,
            matchArgs: false,
          },
        }),
      );
      const anyOrderRes = (await anyOrder[0]!.evaluate(ctx)).find(
        (r) => r.assertionType === "trajectory_exact_match",
      );
      expect(anyOrderRes?.score).toBe(1);
      expect(anyOrderRes?.passed).toBe(true);
    });

    it("emits all three metric results when all are enabled", async () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          trajectory: {
            reference: [{ tool: "a", args: {} }],
            precision: { minScore: 1 },
            recall: { minScore: 1 },
            exactMatch: true,
            ordered: true,
            matchArgs: false,
          },
        }),
      );
      const results = await assertions[0]!.evaluate(
        ctxWithCalls([{ name: "a" }]),
      );
      const types = results.map((r) => r.assertionType);
      expect(types).toContain("trajectory_precision");
      expect(types).toContain("trajectory_recall");
      expect(types).toContain("trajectory_exact_match");
      expect(results).toHaveLength(3);
    });

    it("migration path B: toolCalls and trajectory coexist in one expect block", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [{ tool: "lookup", shouldNotCall: false }],
          trajectory: {
            reference: [{ tool: "lookup", args: {} }],
            recall: { minScore: 1 },
            exactMatch: false,
            ordered: true,
            matchArgs: true,
          },
        }),
      );
      const types = assertions.map((a) => a.type);
      expect(types).toContain("tool_called");
      expect(types).toContain("trajectory");
    });
  });

  // ================================================================
  // Combined assertions
  // ================================================================

  describe("combined assertions", () => {
    it("creates all assertion types from a fully populated expect", () => {
      const assertions = createAssertionsFromExpect(
        makeExpect({
          toolCalls: [{ tool: "search", shouldNotCall: false }],
          output: { format: "text", contains: ["result"] },
          guardrails: {
            pii: { enabled: true, denyPatterns: ["\\b\\d{3}-\\d{2}-\\d{4}\\b"] },
            keywords: { allow: ["found"], deny: ["error"] },
          },
          judge: [{ criteria: "Is helpful", minScore: 0.7 }],
          baseline: { drift: { maxScore: 0.2, method: "judge" } },
          latency: { maxMs: 3000 },
          cost: { maxUsd: 0.10 },
        }),
      );

      const types = assertions.map((a) => a.type);
      expect(types).toContain("tool_called");
      expect(types).toContain("schema");
      expect(types).toContain("pii");
      expect(types).toContain("keywords_present");
      expect(types).toContain("keywords_absent");
      expect(types).toContain("judge");
      expect(types).toContain("drift");
      expect(types).toContain("latency");
      expect(types).toContain("cost");
      expect(assertions.length).toBe(9);
    });
  });
});
