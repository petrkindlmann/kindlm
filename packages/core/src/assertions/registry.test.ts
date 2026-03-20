import { describe, it, expect } from "vitest";
import type { Expect } from "../types/config.js";
import { createAssertionsFromExpect } from "./registry.js";

function makeExpect(overrides: Partial<Expect> = {}): Expect {
  return {
    ...overrides,
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
