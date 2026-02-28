import { describe, it, expect } from "vitest";
import { filterSpans, mapSpansToResult, buildContextFromTrace } from "./mapper.js";
import type { ParsedSpan, SpanMapping } from "./types.js";

function makeSpan(overrides: Partial<ParsedSpan> = {}): ParsedSpan {
  return {
    traceId: "trace-1",
    spanId: "span-1",
    name: "chat.completions",
    kind: 3,
    startTimeMs: 1000,
    endTimeMs: 2500,
    durationMs: 1500,
    attributes: {},
    resourceAttributes: {},
    ...overrides,
  };
}

const defaultMapping: SpanMapping = {
  outputTextAttr: "gen_ai.completion.0.content",
  modelAttr: "gen_ai.response.model",
  systemAttr: "gen_ai.system",
  inputTokensAttr: "gen_ai.usage.input_tokens",
  outputTokensAttr: "gen_ai.usage.output_tokens",
};

describe("filterSpans", () => {
  it("returns all spans with no filter", () => {
    const spans = [makeSpan({ name: "a" }), makeSpan({ name: "b" })];
    expect(filterSpans(spans)).toEqual(spans);
  });

  it("filters by name pattern", () => {
    const spans = [
      makeSpan({ name: "chat.completions" }),
      makeSpan({ name: "db.query" }),
      makeSpan({ name: "chat.embeddings" }),
    ];
    const result = filterSpans(spans, { namePattern: "^chat\\." });
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toEqual(["chat.completions", "chat.embeddings"]);
  });

  it("filters by attribute match", () => {
    const spans = [
      makeSpan({ attributes: { "gen_ai.system": "openai" } }),
      makeSpan({ attributes: { "gen_ai.system": "anthropic" } }),
    ];
    const result = filterSpans(spans, { attributeMatch: { "gen_ai.system": "openai" } });
    expect(result).toHaveLength(1);
    const first = result[0] ?? expect.fail("expected span");
    expect(first.attributes["gen_ai.system"]).toBe("openai");
  });

  it("filters by minimum duration", () => {
    const spans = [
      makeSpan({ durationMs: 100 }),
      makeSpan({ durationMs: 500 }),
      makeSpan({ durationMs: 1000 }),
    ];
    const result = filterSpans(spans, { minDurationMs: 500 });
    expect(result).toHaveLength(2);
  });

  it("combines multiple filter criteria", () => {
    const spans = [
      makeSpan({ name: "chat.completions", durationMs: 100 }),
      makeSpan({ name: "chat.completions", durationMs: 500 }),
      makeSpan({ name: "db.query", durationMs: 500 }),
    ];
    const result = filterSpans(spans, { namePattern: "chat", minDurationMs: 200 });
    expect(result).toHaveLength(1);
  });
});

describe("mapSpansToResult", () => {
  it("extracts output text from configured attribute", () => {
    const spans = [
      makeSpan({
        attributes: { "gen_ai.completion.0.content": "Hello world" },
      }),
    ];
    const result = mapSpansToResult(spans, defaultMapping);
    expect(result.outputText).toBe("Hello world");
  });

  it("extracts model and system", () => {
    const spans = [
      makeSpan({
        attributes: {
          "gen_ai.response.model": "gpt-4o",
          "gen_ai.system": "openai",
        },
      }),
    ];
    const result = mapSpansToResult(spans, defaultMapping);
    expect(result.model).toBe("gpt-4o");
    expect(result.system).toBe("openai");
  });

  it("accumulates tokens from multiple spans", () => {
    const spans = [
      makeSpan({
        attributes: {
          "gen_ai.usage.input_tokens": 100,
          "gen_ai.usage.output_tokens": 50,
        },
      }),
      makeSpan({
        spanId: "span-2",
        attributes: {
          "gen_ai.usage.input_tokens": 200,
          "gen_ai.usage.output_tokens": 75,
        },
      }),
    ];
    const result = mapSpansToResult(spans, defaultMapping);
    expect(result.inputTokens).toBe(300);
    expect(result.outputTokens).toBe(125);
  });

  it("computes latency from root spans only", () => {
    const spans = [
      makeSpan({ parentSpanId: undefined, durationMs: 1000 }),
      makeSpan({ spanId: "child", parentSpanId: "span-1", durationMs: 500 }),
    ];
    const result = mapSpansToResult(spans, defaultMapping);
    expect(result.latencyMs).toBe(1000);
  });

  it("extracts tool calls from GenAI attributes", () => {
    const spans = [
      makeSpan({
        attributes: {
          "gen_ai.tool.name": "search",
          "gen_ai.tool.arguments": '{"query":"test"}',
        },
      }),
    ];
    const result = mapSpansToResult(spans, defaultMapping);
    expect(result.toolCalls).toHaveLength(1);
    const tc = result.toolCalls[0] ?? expect.fail("expected tool call");
    expect(tc.name).toBe("search");
    expect(tc.arguments).toEqual({ query: "test" });
  });

  it("handles malformed tool arguments JSON", () => {
    const spans = [
      makeSpan({
        attributes: {
          "gen_ai.tool.name": "search",
          "gen_ai.tool.arguments": "not-json",
        },
      }),
    ];
    const result = mapSpansToResult(spans, defaultMapping);
    const tc = result.toolCalls[0] ?? expect.fail("expected tool call");
    expect(tc.arguments).toEqual({});
  });

  it("returns empty result for no spans", () => {
    const result = mapSpansToResult([], defaultMapping);
    expect(result.outputText).toBe("");
    expect(result.toolCalls).toEqual([]);
    expect(result.latencyMs).toBe(0);
  });
});

describe("buildContextFromTrace", () => {
  it("builds AssertionContext from SpanMappingResult", () => {
    const mappingResult = {
      outputText: "Agent response",
      toolCalls: [{ id: "tc1", name: "search", arguments: { q: "test" } }],
      latencyMs: 1500,
      inputTokens: 100,
      outputTokens: 50,
      model: "gpt-4o",
      system: "openai",
    };

    const context = buildContextFromTrace(mappingResult, {
      configDir: "/test",
    });

    expect(context.outputText).toBe("Agent response");
    expect(context.toolCalls).toHaveLength(1);
    const tc = context.toolCalls[0] ?? expect.fail("expected tool call");
    expect(tc.name).toBe("search");
    expect(context.latencyMs).toBe(1500);
    expect(context.configDir).toBe("/test");
  });

  it("passes through judge adapter and baseline text", () => {
    const mappingResult = {
      outputText: "text",
      toolCalls: [],
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
    };

    const context = buildContextFromTrace(mappingResult, {
      configDir: "/test",
      baselineText: "previous output",
      judgeModel: "gpt-4o",
    });

    expect(context.baselineText).toBe("previous output");
    expect(context.judgeModel).toBe("gpt-4o");
  });
});
