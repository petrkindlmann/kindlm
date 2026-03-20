import { describe, it, expect } from "vitest";
import { parseOtlpPayload } from "./parser.js";

describe("parseOtlpPayload", () => {
  it("parses a valid OTLP traces payload", () => {
    const payload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "my-agent" } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: "openai" },
              spans: [
                {
                  traceId: "abc123",
                  spanId: "span1",
                  name: "chat.completions",
                  kind: 3,
                  startTimeUnixNano: "1700000000000000000",
                  endTimeUnixNano: "1700000001500000000",
                  attributes: [
                    { key: "gen_ai.system", value: { stringValue: "openai" } },
                    { key: "gen_ai.response.model", value: { stringValue: "gpt-4o" } },
                    { key: "gen_ai.usage.input_tokens", value: { intValue: "100" } },
                    { key: "gen_ai.usage.output_tokens", value: { intValue: "50" } },
                  ],
                  status: { code: 1 },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseOtlpPayload(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(1);
    const span = result.data[0] ?? expect.fail("expected span");
    expect(span.traceId).toBe("abc123");
    expect(span.spanId).toBe("span1");
    expect(span.name).toBe("chat.completions");
    expect(span.durationMs).toBe(1500);
    expect(span.attributes["gen_ai.system"]).toBe("openai");
    expect(span.attributes["gen_ai.response.model"]).toBe("gpt-4o");
    expect(span.attributes["gen_ai.usage.input_tokens"]).toBe(100);
    expect(span.attributes["gen_ai.usage.output_tokens"]).toBe(50);
    expect(span.resourceAttributes["service.name"]).toBe("my-agent");
    expect(span.statusCode).toBe(1);
  });

  it("flattens multiple resourceSpans and scopeSpans", () => {
    const payload = {
      resourceSpans: [
        {
          scopeSpans: [
            { spans: [{ traceId: "t1", spanId: "s1", name: "a", kind: 1, startTimeUnixNano: "0", endTimeUnixNano: "1000000" }] },
            { spans: [{ traceId: "t1", spanId: "s2", name: "b", kind: 1, startTimeUnixNano: "0", endTimeUnixNano: "2000000" }] },
          ],
        },
        {
          scopeSpans: [
            { spans: [{ traceId: "t2", spanId: "s3", name: "c", kind: 1, startTimeUnixNano: "0", endTimeUnixNano: "3000000" }] },
          ],
        },
      ],
    };

    const result = parseOtlpPayload(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(3);
    expect(result.data.map((s) => s.name)).toEqual(["a", "b", "c"]);
  });

  it("handles double and boolean attribute values", () => {
    const payload = {
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "t1",
                  spanId: "s1",
                  name: "test",
                  kind: 1,
                  startTimeUnixNano: "0",
                  endTimeUnixNano: "1000000",
                  attributes: [
                    { key: "score", value: { doubleValue: 0.95 } },
                    { key: "cached", value: { boolValue: true } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseOtlpPayload(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const span = result.data[0] ?? expect.fail("expected span");
    expect(span.attributes["score"]).toBe(0.95);
    expect(span.attributes["cached"]).toBe(true);
  });

  it("rejects null payload", () => {
    const result = parseOtlpPayload(null);
    expect(result.success).toBe(false);
  });

  it("rejects payload without resourceSpans", () => {
    const result = parseOtlpPayload({ other: "data" });
    expect(result.success).toBe(false);
  });

  it("handles empty resourceSpans", () => {
    const result = parseOtlpPayload({ resourceSpans: [] });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });

  it("preserves parentSpanId when present", () => {
    const payload = {
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "t1",
                  spanId: "child",
                  parentSpanId: "parent",
                  name: "child-span",
                  kind: 1,
                  startTimeUnixNano: "0",
                  endTimeUnixNano: "1000000",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseOtlpPayload(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const span = result.data[0] ?? expect.fail("expected span");
    expect(span.parentSpanId).toBe("parent");
  });

  it("handles malformed nanosecond timestamps without crashing", () => {
    const payload = {
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "t1",
                  spanId: "s1",
                  name: "bad-nanos",
                  kind: 1,
                  startTimeUnixNano: "not-a-number",
                  endTimeUnixNano: "also-bad",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseOtlpPayload(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const span = result.data[0] ?? expect.fail("expected span");
    expect(span.startTimeMs).toBe(0);
    expect(span.endTimeMs).toBe(0);
    expect(span.durationMs).toBe(0);
  });

  it("handles empty string nanosecond timestamps", () => {
    const payload = {
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "t1",
                  spanId: "s1",
                  name: "empty-nanos",
                  kind: 1,
                  startTimeUnixNano: "",
                  endTimeUnixNano: "",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseOtlpPayload(payload);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const span = result.data[0] ?? expect.fail("expected span");
    expect(span.startTimeMs).toBe(0);
    expect(span.endTimeMs).toBe(0);
  });
});
