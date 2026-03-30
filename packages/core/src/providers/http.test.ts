import { describe, it, expect, vi } from "vitest";
import type { HttpClient, HttpResponse, ProviderRequest } from "./interface.js";
import {
  getByPath,
  interpolateBodyTemplate,
  resolveHeaders,
  createHttpProviderAdapter,
} from "./http.js";
import type { HttpProviderConfig } from "./http.js";
import { ProviderError } from "./interface.js";

// ============================================================
// getByPath
// ============================================================

describe("getByPath", () => {
  it("returns top-level value", () => {
    expect(getByPath({ foo: "bar" }, "foo")).toBe("bar");
  });

  it("traverses nested objects with dots", () => {
    expect(getByPath({ a: { b: { c: 42 } } }, "a.b.c")).toBe(42);
  });

  it("traverses arrays with numeric index", () => {
    expect(getByPath({ items: [10, 20, 30] }, "items.1")).toBe(20);
  });

  it("supports bracket notation for arrays", () => {
    expect(getByPath({ items: [10, 20, 30] }, "items[1]")).toBe(20);
  });

  it("handles mixed dot and bracket notation", () => {
    const obj = { choices: [{ message: { content: "hello" } }] };
    expect(getByPath(obj, "choices[0].message.content")).toBe("hello");
  });

  it("returns undefined for missing paths", () => {
    expect(getByPath({ a: 1 }, "b")).toBeUndefined();
  });

  it("returns undefined for path through null", () => {
    expect(getByPath({ a: null }, "a.b")).toBeUndefined();
  });

  it("returns undefined for path through primitive", () => {
    expect(getByPath({ a: 42 }, "a.b")).toBeUndefined();
  });

  it("returns the root object for empty path", () => {
    const obj = { a: 1 };
    expect(getByPath(obj, "")).toEqual({ a: 1 });
  });

  it("handles deeply nested paths", () => {
    const obj = { a: { b: { c: { d: { e: "deep" } } } } };
    expect(getByPath(obj, "a.b.c.d.e")).toBe("deep");
  });
});

// ============================================================
// interpolateBodyTemplate
// ============================================================

describe("interpolateBodyTemplate", () => {
  const baseRequest: ProviderRequest = {
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Say hello" },
    ],
    params: { temperature: 0.5, maxTokens: 1024 },
  };

  it("replaces {{model}}", () => {
    const result = interpolateBodyTemplate('{"model":"{{model}}"}', baseRequest);
    expect(result).toBe('{"model":"gpt-4o"}');
  });

  it("replaces {{system}} and {{user}}", () => {
    const result = interpolateBodyTemplate("{{system}} | {{user}}", baseRequest);
    expect(result).toBe("You are helpful. | Say hello");
  });

  it("replaces {{temperature}} and {{maxTokens}}", () => {
    const result = interpolateBodyTemplate(
      "temp={{temperature}}, max={{maxTokens}}",
      baseRequest,
    );
    expect(result).toBe("temp=0.5, max=1024");
  });

  it("replaces {{messages_json}}", () => {
    const result = interpolateBodyTemplate("{{messages_json}}", baseRequest);
    const parsed = JSON.parse(result) as unknown[];
    expect(parsed).toHaveLength(2);
  });

  it("replaces {{tools_json}} with empty array when no tools", () => {
    const result = interpolateBodyTemplate("{{tools_json}}", baseRequest);
    expect(result).toBe("[]");
  });

  it("returns empty string for unknown variables", () => {
    const result = interpolateBodyTemplate("{{unknown}}", baseRequest);
    expect(result).toBe("");
  });

  it("handles template with no variables", () => {
    const result = interpolateBodyTemplate("static body", baseRequest);
    expect(result).toBe("static body");
  });

  it("handles missing system message", () => {
    const req: ProviderRequest = {
      ...baseRequest,
      messages: [{ role: "user", content: "Hello" }],
    };
    const result = interpolateBodyTemplate("sys={{system}}", req);
    expect(result).toBe("sys=");
  });
});

// ============================================================
// resolveHeaders
// ============================================================

describe("resolveHeaders", () => {
  it("passes through plain headers", () => {
    const result = resolveHeaders(
      { "Content-Type": "application/json" },
      () => undefined,
    );
    expect(result).toEqual({ "Content-Type": "application/json" });
  });

  it("resolves env: prefixed values", () => {
    const result = resolveHeaders(
      { Authorization: "env:MY_TOKEN" },
      (name) => (name === "MY_TOKEN" ? "Bearer secret" : undefined),
    );
    expect(result).toEqual({ Authorization: "Bearer secret" });
  });

  it("throws ProviderError for missing env var", () => {
    expect(() =>
      resolveHeaders(
        { Authorization: "env:MISSING_VAR" },
        () => undefined,
      ),
    ).toThrow(ProviderError);
  });

  it("mixes plain and env headers", () => {
    const result = resolveHeaders(
      {
        "Content-Type": "application/json",
        Authorization: "env:API_KEY",
      },
      (name) => (name === "API_KEY" ? "key123" : undefined),
    );
    expect(result).toEqual({
      "Content-Type": "application/json",
      Authorization: "key123",
    });
  });
});

// ============================================================
// createHttpProviderAdapter
// ============================================================

function createMockHttpClient(responseBody: unknown, status = 200): HttpClient {
  const mockResponse: HttpResponse = {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(responseBody),
  };
  return {
    fetch: vi.fn().mockResolvedValue(mockResponse),
  };
}

const defaultRequest: ProviderRequest = {
  model: "test-model",
  messages: [
    { role: "system", content: "You are helpful." },
    { role: "user", content: "Hello" },
  ],
  params: { temperature: 0, maxTokens: 512 },
};

describe("createHttpProviderAdapter", () => {
  it("has name 'http'", () => {
    const adapter = createHttpProviderAdapter(
      createMockHttpClient({}),
      { url: "https://example.com/api" },
      () => undefined,
    );
    expect(adapter.name).toBe("http");
  });

  it("sends request to configured URL with default OpenAI-compatible body", async () => {
    const mockClient = createMockHttpClient({
      choices: [{ message: { content: "Hi there!" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      model: "test-model",
    });

    const config: HttpProviderConfig = {
      url: "https://api.example.com/v1/chat",
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      () => undefined,
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    const result = await adapter.complete(defaultRequest);

    expect(result.text).toBe("Hi there!");
    expect(result.usage.inputTokens).toBe(10);
    expect(result.usage.outputTokens).toBe(5);
    expect(result.modelId).toBe("test-model");

    const fetchCall = (mockClient.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(fetchCall[0]).toBe("https://api.example.com/v1/chat");
    expect(fetchCall[1].method).toBe("POST");
  });

  it("uses custom body template when provided", async () => {
    const mockClient = createMockHttpClient({
      output: "Generated text",
    });

    const config: HttpProviderConfig = {
      url: "https://api.example.com/generate",
      body: '{"prompt":"{{user}}","model":"{{model}}"}',
      responsePath: "output",
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      () => undefined,
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    const result = await adapter.complete(defaultRequest);

    expect(result.text).toBe("Generated text");

    const fetchCall = (mockClient.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse(fetchCall[1].body as string) as Record<string, unknown>;
    expect(body["prompt"]).toBe("Hello");
    expect(body["model"]).toBe("test-model");
  });

  it("resolves env: header references", async () => {
    const mockClient = createMockHttpClient({
      choices: [{ message: { content: "ok" } }],
    });

    const config: HttpProviderConfig = {
      url: "https://api.example.com/v1/chat",
      headers: {
        Authorization: "env:MY_API_KEY",
        "X-Custom": "static-value",
      },
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      (name) => (name === "MY_API_KEY" ? "Bearer sk-test" : undefined),
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    await adapter.complete(defaultRequest);

    const fetchCall = (mockClient.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const headers = fetchCall[1].headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-test");
    expect(headers["X-Custom"]).toBe("static-value");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("extracts tool calls from configured path", async () => {
    const mockClient = createMockHttpClient({
      choices: [
        {
          message: {
            content: "",
            tool_calls: [
              {
                id: "call_1",
                function: { name: "get_weather", arguments: '{"city":"London"}' },
              },
            ],
          },
        },
      ],
    });

    const config: HttpProviderConfig = {
      url: "https://api.example.com/v1/chat",
      toolCallsPath: "choices.0.message.tool_calls",
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      () => undefined,
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    const result = await adapter.complete(defaultRequest);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe("get_weather");
    expect(result.toolCalls[0]!.arguments).toEqual({ city: "London" });
  });

  it("extracts tool calls with flat format (no function wrapper)", async () => {
    const mockClient = createMockHttpClient({
      tools: [
        {
          id: "t1",
          name: "search",
          arguments: { query: "test" },
        },
      ],
      text: "",
    });

    const config: HttpProviderConfig = {
      url: "https://api.example.com/v1/chat",
      responsePath: "text",
      toolCallsPath: "tools",
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      () => undefined,
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    const result = await adapter.complete(defaultRequest);

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.name).toBe("search");
    expect(result.toolCalls[0]!.arguments).toEqual({ query: "test" });
  });

  it("uses custom usage paths", async () => {
    const mockClient = createMockHttpClient({
      result: "hello",
      stats: { in: 100, out: 50, total: 150 },
    });

    const config: HttpProviderConfig = {
      url: "https://api.example.com/v1/chat",
      responsePath: "result",
      usagePaths: {
        inputTokens: "stats.in",
        outputTokens: "stats.out",
        totalTokens: "stats.total",
      },
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      () => undefined,
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    const result = await adapter.complete(defaultRequest);

    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
    expect(result.usage.totalTokens).toBe(150);
  });

  it("handles HTTP errors correctly", async () => {
    const mockClient = createMockHttpClient({ error: "Unauthorized" }, 401);

    const config: HttpProviderConfig = {
      url: "https://api.example.com/v1/chat",
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      () => undefined,
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    await expect(adapter.complete(defaultRequest)).rejects.toThrow(ProviderError);

    try {
      await adapter.complete(defaultRequest);
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe("AUTH_FAILED");
    }
  });

  it("handles 429 rate limiting as retryable", async () => {
    const mockClient = createMockHttpClient(
      { error: "Too many requests" },
      429,
    );

    const config: HttpProviderConfig = {
      url: "https://api.example.com/v1/chat",
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      () => undefined,
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    try {
      await adapter.complete(defaultRequest);
    } catch (err) {
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).code).toBe("RATE_LIMITED");
      expect((err as ProviderError).retryable).toBe(true);
    }
  });

  it("estimateCost returns null (no pricing table)", () => {
    const adapter = createHttpProviderAdapter(
      createMockHttpClient({}),
      { url: "https://example.com" },
      () => undefined,
    );
    expect(adapter.estimateCost("any-model", { inputTokens: 100, outputTokens: 50, totalTokens: 150 })).toBeNull();
  });

  it("supportsTools returns true when toolCallsPath is configured", () => {
    const adapter = createHttpProviderAdapter(
      createMockHttpClient({}),
      { url: "https://example.com", toolCallsPath: "tools" },
      () => undefined,
    );
    expect(adapter.supportsTools("any")).toBe(true);
  });

  it("supportsTools returns false when toolCallsPath is not configured", () => {
    const adapter = createHttpProviderAdapter(
      createMockHttpClient({}),
      { url: "https://example.com" },
      () => undefined,
    );
    expect(adapter.supportsTools("any")).toBe(false);
  });

  it("uses custom HTTP method", async () => {
    const mockClient = createMockHttpClient({
      choices: [{ message: { content: "ok" } }],
    });

    const config: HttpProviderConfig = {
      url: "https://api.example.com/v1/chat",
      method: "PUT",
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      () => undefined,
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    await adapter.complete(defaultRequest);

    const fetchCall = (mockClient.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(fetchCall[1].method).toBe("PUT");
  });

  it("defaults to empty string for missing response path", async () => {
    const mockClient = createMockHttpClient({ unrelated: "data" });

    const config: HttpProviderConfig = {
      url: "https://api.example.com/v1/chat",
      responsePath: "missing.path",
    };

    const adapter = createHttpProviderAdapter(
      mockClient,
      config,
      () => undefined,
    );
    await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

    const result = await adapter.complete(defaultRequest);
    expect(result.text).toBe("");
  });
});
