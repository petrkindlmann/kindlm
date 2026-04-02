import { describe, it, expect } from "vitest";
import type { AssertionContext } from "./interface.js";
import {
  createToolCalledAssertion,
  createToolNotCalledAssertion,
  createToolOrderAssertion,
} from "./tool-calls.js";

function ctx(toolCalls: AssertionContext["toolCalls"] = []): AssertionContext {
  return {
    outputText: "",
    toolCalls,
    configDir: "/tmp",
  };
}

function tc(name: string, args: Record<string, unknown> = {}, index = 0) {
  return { id: `call_${name}`, name, arguments: args, index };
}

describe("createToolCalledAssertion", () => {
  it("passes when tool is called", async () => {
    const assertion = createToolCalledAssertion("lookup_order");
    const results = await assertion.evaluate(ctx([tc("lookup_order")]));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("fails when tool is not called", async () => {
    const assertion = createToolCalledAssertion("lookup_order");
    const results = await assertion.evaluate(ctx([tc("other_tool")]));
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "TOOL_CALL_MISSING",
    });
  });

  it("fails when no tools called at all", async () => {
    const assertion = createToolCalledAssertion("lookup_order");
    const results = await assertion.evaluate(ctx([]));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "TOOL_CALL_MISSING",
    });
  });

  it("passes with matching args", async () => {
    const assertion = createToolCalledAssertion("lookup_order", {
      order_id: "12345",
    });
    const results = await assertion.evaluate(
      ctx([tc("lookup_order", { order_id: "12345", extra: true })]),
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ passed: true });
    expect(results[1]).toMatchObject({ passed: true });
    expect(results[1]).toHaveProperty("label", expect.stringContaining("args match"));
  });

  it("fails with mismatched args", async () => {
    const assertion = createToolCalledAssertion("lookup_order", {
      order_id: "99999",
    });
    const results = await assertion.evaluate(
      ctx([tc("lookup_order", { order_id: "12345" })]),
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ passed: true });
    expect(results[1]).toMatchObject({
      passed: false,
      failureCode: "TOOL_CALL_ARGS_MISMATCH",
    });
  });

  it("lists actual tool names on failure", async () => {
    const assertion = createToolCalledAssertion("missing_tool");
    const results = await assertion.evaluate(
      ctx([tc("foo"), tc("bar")]),
    );
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("foo");
    expect(msg).toContain("bar");
  });
});

describe("createToolNotCalledAssertion", () => {
  it("passes when tool is not called", async () => {
    const assertion = createToolNotCalledAssertion("process_refund");
    const results = await assertion.evaluate(ctx([tc("lookup_order")]));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("fails when tool is called", async () => {
    const assertion = createToolNotCalledAssertion("process_refund");
    const results = await assertion.evaluate(ctx([tc("process_refund")]));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "TOOL_CALL_UNEXPECTED",
    });
  });

  it("passes with empty tool calls", async () => {
    const assertion = createToolNotCalledAssertion("any_tool");
    const results = await assertion.evaluate(ctx([]));
    expect(results[0]).toMatchObject({ passed: true });
  });
});

describe("createToolOrderAssertion", () => {
  it("checks tool call order", async () => {
    const assertion = createToolOrderAssertion([
      { tool: "first", order: 0 },
      { tool: "second", order: 1 },
    ]);
    const results = await assertion.evaluate(
      ctx([tc("first"), tc("second")]),
    );
    const orderResults = results.filter((r) => r.label.includes("position"));
    expect(orderResults).toHaveLength(2);
    expect(orderResults.every((r) => r.passed)).toBe(true);
  });

  it("fails on wrong order", async () => {
    const assertion = createToolOrderAssertion([
      { tool: "first", order: 0 },
      { tool: "second", order: 1 },
    ]);
    const results = await assertion.evaluate(
      ctx([tc("second"), tc("first")]),
    );
    const orderResults = results.filter((r) => r.label.includes("position"));
    expect(orderResults[0]).toMatchObject({
      passed: false,
      failureCode: "TOOL_CALL_ORDER_WRONG",
    });
  });

  it("handles shouldNotCall in expectations", async () => {
    const assertion = createToolOrderAssertion([
      { tool: "allowed", order: 0 },
      { tool: "forbidden", shouldNotCall: true },
    ]);
    const results = await assertion.evaluate(ctx([tc("allowed")]));
    const notCalledResult = results.find((r) =>
      r.label.includes("forbidden"),
    );
    expect(notCalledResult).toMatchObject({ passed: true });
  });

  it("fails shouldNotCall when tool is present", async () => {
    const assertion = createToolOrderAssertion([
      { tool: "forbidden", shouldNotCall: true },
    ]);
    const results = await assertion.evaluate(ctx([tc("forbidden")]));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "TOOL_CALL_UNEXPECTED",
    });
  });

  it("checks args match within order expectations", async () => {
    const assertion = createToolOrderAssertion([
      { tool: "search", argsMatch: { query: "test" }, order: 0 },
    ]);
    const results = await assertion.evaluate(
      ctx([tc("search", { query: "test" })]),
    );
    expect(results.every((r) => r.passed)).toBe(true);
  });
});

describe("computeArgDiffs (via metadata)", () => {
  it("TOOL_CALL_MISSING has receivedToolCalls and expectedTool in metadata", async () => {
    const assertion = createToolCalledAssertion("search");
    const results = await assertion.evaluate(ctx([tc("other")]));
    const r = results[0];
    expect(r?.metadata).toMatchObject({
      receivedToolCalls: [expect.objectContaining({ name: "other" })],
      expectedTool: "search",
      argDiffs: undefined,
    });
  });

  it("TOOL_CALL_ARGS_MISMATCH has argDiffs with per-field diff", async () => {
    const assertion = createToolCalledAssertion("search", { query: "cats", limit: 10 });
    const results = await assertion.evaluate(
      ctx([tc("search", { query: "dogs", limit: 10 })]),
    );
    const argsMismatch = results.find((r) => r.failureCode === "TOOL_CALL_ARGS_MISMATCH");
    expect(argsMismatch).toBeDefined();
    expect(argsMismatch?.metadata).toMatchObject({
      receivedToolCalls: expect.any(Array),
      expectedTool: "search",
      expectedArgs: { query: "cats", limit: 10 },
      argDiffs: {
        query: { expected: "cats", received: "dogs" },
      },
    });
    // limit matched — should NOT be in argDiffs
    expect((argsMismatch?.metadata as Record<string, unknown>)?.argDiffs).not.toHaveProperty("limit");
  });

  it("computeArgDiffs: missing key shows received as undefined", async () => {
    const assertion = createToolCalledAssertion("search", { query: "cats", extra: 1 });
    const results = await assertion.evaluate(
      ctx([tc("search", { query: "cats" })]),
    );
    const argsMismatch = results.find((r) => r.failureCode === "TOOL_CALL_ARGS_MISMATCH");
    expect(argsMismatch?.metadata).toMatchObject({
      argDiffs: {
        extra: { expected: 1, received: undefined },
      },
    });
  });

  it("passing tool_called result has metadata.argCount", async () => {
    const assertion = createToolCalledAssertion("search");
    const results = await assertion.evaluate(ctx([tc("search", { q: "hello", page: 1, limit: 5 })]));
    const r = results[0];
    expect(r?.passed).toBe(true);
    expect(r?.metadata).toMatchObject({ argCount: 3 });
  });

  it("passing tool_called with zero args has metadata.argCount = 0", async () => {
    const assertion = createToolCalledAssertion("ping");
    const results = await assertion.evaluate(ctx([tc("ping")]));
    const r = results[0];
    expect(r?.passed).toBe(true);
    expect(r?.metadata).toMatchObject({ argCount: 0 });
  });

  it("TOOL_CALL_UNEXPECTED has metadata.receivedToolCalls", async () => {
    const assertion = createToolNotCalledAssertion("forbidden");
    const results = await assertion.evaluate(ctx([tc("forbidden"), tc("other")]));
    const r = results[0];
    expect(r?.failureCode).toBe("TOOL_CALL_UNEXPECTED");
    expect(r?.metadata).toMatchObject({
      receivedToolCalls: expect.arrayContaining([
        expect.objectContaining({ name: "forbidden" }),
      ]),
      expectedTool: "forbidden",
    });
  });

  it("tool_order TOOL_CALL_MISSING has metadata.receivedToolCalls", async () => {
    const assertion = createToolOrderAssertion([{ tool: "missing", order: 0 }]);
    const results = await assertion.evaluate(ctx([tc("other")]));
    const missing = results.find((r) => r.failureCode === "TOOL_CALL_MISSING");
    expect(missing?.metadata).toMatchObject({
      receivedToolCalls: expect.any(Array),
      expectedTool: "missing",
    });
  });

  it("tool_order TOOL_CALL_ARGS_MISMATCH has metadata.argDiffs", async () => {
    const assertion = createToolOrderAssertion([
      { tool: "search", argsMatch: { query: "cats" }, order: 0 },
    ]);
    const results = await assertion.evaluate(
      ctx([tc("search", { query: "dogs" })]),
    );
    const argsMismatch = results.find((r) => r.failureCode === "TOOL_CALL_ARGS_MISMATCH");
    expect(argsMismatch?.metadata).toMatchObject({
      argDiffs: {
        query: { expected: "cats", received: "dogs" },
      },
    });
  });

  it("tool_order TOOL_CALL_ORDER_WRONG has metadata.receivedToolCalls", async () => {
    const assertion = createToolOrderAssertion([
      { tool: "first", order: 0 },
      { tool: "second", order: 1 },
    ]);
    const results = await assertion.evaluate(ctx([tc("second"), tc("first")]));
    const orderWrong = results.find((r) => r.failureCode === "TOOL_CALL_ORDER_WRONG");
    expect(orderWrong?.metadata).toMatchObject({
      receivedToolCalls: expect.any(Array),
    });
  });

  it("tool_order shouldNotCall TOOL_CALL_UNEXPECTED has metadata.receivedToolCalls", async () => {
    const assertion = createToolOrderAssertion([
      { tool: "forbidden", shouldNotCall: true },
    ]);
    const results = await assertion.evaluate(ctx([tc("forbidden")]));
    const r = results[0];
    expect(r?.failureCode).toBe("TOOL_CALL_UNEXPECTED");
    expect(r?.metadata).toMatchObject({
      receivedToolCalls: expect.any(Array),
      expectedTool: "forbidden",
    });
  });

  it("tool_order passing tool_called has metadata.argCount", async () => {
    const assertion = createToolOrderAssertion([{ tool: "search" }]);
    const results = await assertion.evaluate(ctx([tc("search", { q: "hi", n: 5 })]));
    const called = results.find((r) => r.label.includes("called") && r.passed);
    expect(called?.metadata).toMatchObject({ argCount: 2 });
  });
});
