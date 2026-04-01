import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMcpAdapter } from "./mcp.js";
import type { McpProviderConfig } from "./mcp.js";
import { ProviderError } from "./interface.js";
import type { HttpClient, HttpResponse, ProviderRequest } from "./interface.js";

function makeHttpClient(overrides?: Partial<HttpClient>): HttpClient {
  return {
    fetch: vi.fn(),
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<ProviderRequest>): ProviderRequest {
  return {
    model: "my-agent",
    messages: [{ role: "user", content: "Hello" }],
    params: {
      temperature: 0,
      maxTokens: 512,
    },
    ...overrides,
  };
}

function makeOkResponse(body: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  };
}

function makeErrorResponse(status: number, body: unknown): HttpResponse {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
  };
}

const DEFAULT_CONFIG: McpProviderConfig = {
  serverUrl: "http://localhost:8080/mcp",
  toolName: "run_agent",
};

describe("createMcpAdapter", () => {
  let httpClient: HttpClient;

  beforeEach(() => {
    httpClient = makeHttpClient();
  });

  it("returns an adapter with name === 'mcp'", () => {
    const adapter = createMcpAdapter(httpClient, DEFAULT_CONFIG);
    expect(adapter.name).toBe("mcp");
  });

  it("initialize() stores config without throwing", async () => {
    const adapter = createMcpAdapter(httpClient, DEFAULT_CONFIG);
    await expect(
      adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 2 }),
    ).resolves.toBeUndefined();
  });

  it("initialize() stores timeoutMs from config", async () => {
    const adapter = createMcpAdapter(httpClient, DEFAULT_CONFIG);
    // No error expected; timeoutMs is stored internally
    await adapter.initialize({ apiKey: "", timeoutMs: 15_000, maxRetries: 1 });
    // We verify indirectly: after initialize, complete() passes timeoutMs to httpClient
    const fetchMock = vi.fn().mockResolvedValue(
      makeOkResponse({ content: [{ text: "ok" }] }),
    );
    const clientWithMock = makeHttpClient({ fetch: fetchMock });
    const adapter2 = createMcpAdapter(clientWithMock, DEFAULT_CONFIG);
    await adapter2.initialize({ apiKey: "", timeoutMs: 15_000, maxRetries: 0 });
    await adapter2.complete(makeRequest());
    const [, init] = fetchMock.mock.calls[0] as [string, { timeoutMs?: number }];
    expect(init.timeoutMs).toBe(15_000);
  });

  describe("complete()", () => {
    it("sends POST to serverUrl with correct body", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeOkResponse({ content: [{ text: "agent response" }] }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      const request = makeRequest();
      await adapter.complete(request);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string>; body: string }];
      expect(url).toBe("http://localhost:8080/mcp");
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/json");

      const parsedBody = JSON.parse(init.body) as {
        toolName: string;
        arguments: { messages: unknown; model: string; params: unknown };
      };
      expect(parsedBody.toolName).toBe("run_agent");
      expect(parsedBody.arguments.messages).toEqual(request.messages);
      expect(parsedBody.arguments.model).toBe(request.model);
      expect(parsedBody.arguments.params).toEqual(request.params);
    });

    it("maps response.content[0].text as text (MCP protocol)", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeOkResponse({ content: [{ text: "mcp result" }] }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      const result = await adapter.complete(makeRequest());
      expect(result.text).toBe("mcp result");
    });

    it("falls back to response.result when content is absent", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeOkResponse({ result: "fallback result" }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      const result = await adapter.complete(makeRequest());
      expect(result.text).toBe("fallback result");
    });

    it("falls back to response.output when content and result are absent", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeOkResponse({ output: "output result" }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      const result = await adapter.complete(makeRequest());
      expect(result.text).toBe("output result");
    });

    it("returns empty string when no known text field is present", async () => {
      const fetchMock = vi.fn().mockResolvedValue(makeOkResponse({}));
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      const result = await adapter.complete(makeRequest());
      expect(result.text).toBe("");
    });

    it("maps response to correct ProviderResponse shape", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeOkResponse({ content: [{ text: "hello" }] }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      const result = await adapter.complete(makeRequest());

      expect(result.toolCalls).toEqual([]);
      expect(result.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
      expect(result.modelId).toBe("mcp");
      expect(result.finishReason).toBe("stop");
      expect(typeof result.latencyMs).toBe("number");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("sets latencyMs to elapsed time", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeOkResponse({ content: [{ text: "ok" }] }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      const before = Date.now();
      const result = await adapter.complete(makeRequest());
      const after = Date.now();

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.latencyMs).toBeLessThanOrEqual(after - before + 10);
    });

    it("throws ProviderError with AUTH_FAILED on 401", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeErrorResponse(401, { error: "Unauthorized" }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      await expect(adapter.complete(makeRequest())).rejects.toMatchObject({
        code: "AUTH_FAILED",
      });
    });

    it("throws ProviderError with AUTH_FAILED on 403", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeErrorResponse(403, { error: "Forbidden" }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      await expect(adapter.complete(makeRequest())).rejects.toMatchObject({
        code: "AUTH_FAILED",
      });
    });

    it("throws ProviderError with PROVIDER_ERROR on non-ok HTTP response", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeErrorResponse(500, { error: "Internal server error" }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      await expect(adapter.complete(makeRequest())).rejects.toMatchObject({
        code: "PROVIDER_ERROR",
      });
    });

    it("forwards custom headers to the HTTP request", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeOkResponse({ content: [{ text: "ok" }] }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const config: McpProviderConfig = {
        serverUrl: "http://localhost:8080/mcp",
        toolName: "run_agent",
        headers: { "X-Token": "abc123", "X-Custom": "value" },
      };
      const adapter = createMcpAdapter(client, config);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      await adapter.complete(makeRequest());

      const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
      expect(init.headers["X-Token"]).toBe("abc123");
      expect(init.headers["X-Custom"]).toBe("value");
    });

    it("does NOT resolve 'env:' header values in core (CLI resolves them)", async () => {
      // Core passes headers as-is — env: resolution happens in CLI before passing to core
      const fetchMock = vi.fn().mockResolvedValue(
        makeOkResponse({ content: [{ text: "ok" }] }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const config: McpProviderConfig = {
        serverUrl: "http://localhost:8080/mcp",
        toolName: "run_agent",
        headers: { Authorization: "env:MY_TOKEN" },
      };
      const adapter = createMcpAdapter(client, config);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      await adapter.complete(makeRequest());

      const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
      // Value should be passed through unchanged — env: is a CLI concern
      expect(init.headers["Authorization"]).toBe("env:MY_TOKEN");
    });
  });

  describe("estimateCost()", () => {
    it("returns null", () => {
      const adapter = createMcpAdapter(httpClient, DEFAULT_CONFIG);
      expect(
        adapter.estimateCost("mcp", {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
        }),
      ).toBeNull();
    });
  });

  describe("supportsTools()", () => {
    it("returns false", () => {
      const adapter = createMcpAdapter(httpClient, DEFAULT_CONFIG);
      expect(adapter.supportsTools("mcp")).toBe(false);
      expect(adapter.supportsTools("any-model")).toBe(false);
    });
  });

  describe("ProviderError type check", () => {
    it("ProviderError is instanceof ProviderError", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeErrorResponse(401, { message: "Unauthorized" }),
      );
      const client = makeHttpClient({ fetch: fetchMock });
      const adapter = createMcpAdapter(client, DEFAULT_CONFIG);
      await adapter.initialize({ apiKey: "", timeoutMs: 30_000, maxRetries: 0 });

      await expect(adapter.complete(makeRequest())).rejects.toBeInstanceOf(
        ProviderError,
      );
    });
  });
});
