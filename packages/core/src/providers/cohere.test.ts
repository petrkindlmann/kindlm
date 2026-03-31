import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpClient, ProviderRequest } from "./interface.js";
import { ProviderError } from "./interface.js";
import { createCohereAdapter } from "./cohere.js";

function createMockHttpClient(
  responseBody: unknown,
  options: { ok?: boolean; status?: number } = {},
): HttpClient {
  const { ok = true, status = 200 } = options;
  return {
    fetch: vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(responseBody),
    }),
  };
}

function getFetchCall(httpClient: HttpClient, index = 0) {
  const calls = (httpClient.fetch as ReturnType<typeof vi.fn>).mock.calls;
  const call = calls[index];
  if (!call) throw new Error(`No fetch call at index ${index}`);
  return call as [string, { method: string; headers: Record<string, string>; body: string }];
}

function baseRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    model: "command-r-plus",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0.2, maxTokens: 1024 },
    ...overrides,
  };
}

function cohereResponse(overrides: Record<string, unknown> = {}) {
  return {
    message: {
      role: "assistant",
      content: [{ type: "text", text: "Hello there!" }],
    },
    finish_reason: "COMPLETE",
    usage: {
      tokens: { input_tokens: 10, output_tokens: 6 },
    },
    model: "command-r-plus",
    ...overrides,
  };
}

describe("createCohereAdapter", () => {
  let httpClient: HttpClient;

  describe("initialize", () => {
    it("throws AUTH_FAILED when apiKey is empty", async () => {
      httpClient = createMockHttpClient({});
      const adapter = createCohereAdapter(httpClient);
      await expect(
        adapter.initialize({
          apiKey: "",
          timeoutMs: 30000,
          maxRetries: 0,
        }),
      ).rejects.toThrow(ProviderError);
    });

    it("succeeds with valid apiKey", async () => {
      httpClient = createMockHttpClient({});
      const adapter = createCohereAdapter(httpClient);
      await expect(
        adapter.initialize({
          apiKey: "test-key",
          timeoutMs: 30000,
          maxRetries: 0,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("complete", () => {
    beforeEach(async () => {
      httpClient = createMockHttpClient(cohereResponse());
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });
    });

    it("sends request to correct Cohere v2 endpoint", async () => {
      httpClient = createMockHttpClient(cohereResponse());
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const [url, init] = getFetchCall(httpClient);
      expect(url).toBe("https://api.cohere.com/v2/chat");
      const body = JSON.parse(init.body);
      expect(body.model).toBe("command-r-plus");
      expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
      expect(body.temperature).toBe(0.2);
      expect(body.max_tokens).toBe(1024);
    });

    it("maps topP to p and stopSequences to stop_sequences", async () => {
      httpClient = createMockHttpClient(cohereResponse());
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          params: {
            temperature: 0.5,
            maxTokens: 2048,
            topP: 0.9,
            stopSequences: ["END"],
          },
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.p).toBe(0.9);
      expect(body.stop_sequences).toEqual(["END"]);
      expect(body.top_p).toBeUndefined();
      expect(body.stop).toBeUndefined();
    });

    it("formats tools in function calling format", async () => {
      httpClient = createMockHttpClient(cohereResponse());
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          tools: [
            {
              name: "search_docs",
              description: "Search documents",
              parameters: {
                type: "object",
                properties: { query: { type: "string" } },
              },
            },
          ],
          toolChoice: "auto",
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.tools).toEqual([
        {
          type: "function",
          function: {
            name: "search_docs",
            description: "Search documents",
            parameters: {
              type: "object",
              properties: { query: { type: "string" } },
            },
          },
        },
      ]);
      expect(body.tool_choice).toBe("auto");
    });

    it("parses text-only response from content array", async () => {
      httpClient = createMockHttpClient(cohereResponse());
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("Hello there!");
      expect(result.toolCalls).toEqual([]);
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 6,
        totalTokens: 16,
      });
      expect(result.modelId).toBe("command-r-plus");
      expect(result.finishReason).toBe("stop");
    });

    it("concatenates multiple text content blocks", async () => {
      const multiContent = cohereResponse({
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Part one. " },
            { type: "text", text: "Part two." },
          ],
        },
      });
      httpClient = createMockHttpClient(multiContent);
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("Part one. Part two.");
    });

    it("parses tool call response", async () => {
      const responseWithTools = cohereResponse({
        message: {
          role: "assistant",
          content: [],
          tool_calls: [
            {
              id: "tc_001",
              type: "function",
              function: {
                name: "search_docs",
                arguments: '{"query":"climate change"}',
              },
            },
          ],
        },
        finish_reason: "TOOL_CALL",
      });
      httpClient = createMockHttpClient(responseWithTools);
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("");
      expect(result.toolCalls).toEqual([
        {
          id: "tc_001",
          name: "search_docs",
          arguments: { query: "climate change" },
          index: 0,
        },
      ]);
      expect(result.finishReason).toBe("tool_calls");
    });

    it("sends authorization header", async () => {
      httpClient = createMockHttpClient(cohereResponse());
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "cohere-key-xyz",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const headers = getFetchCall(httpClient)[1].headers;
      expect(headers["Authorization"]).toBe("Bearer cohere-key-xyz");
    });

    it("maps COMPLETE finish_reason to stop", async () => {
      httpClient = createMockHttpClient(cohereResponse());
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.finishReason).toBe("stop");
    });

    it("maps MAX_TOKENS finish_reason to max_tokens", async () => {
      const maxTokensResponse = cohereResponse({
        finish_reason: "MAX_TOKENS",
      });
      httpClient = createMockHttpClient(maxTokensResponse);
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.finishReason).toBe("max_tokens");
    });
  });

  describe("error mapping", () => {
    it("maps 401 to AUTH_FAILED", async () => {
      httpClient = createMockHttpClient(
        { message: "Unauthorized" },
        { ok: false, status: 401 },
      );
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "bad-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      try {
        await adapter.complete(baseRequest());
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderError);
        expect((e as ProviderError).code).toBe("AUTH_FAILED");
      }
    });

    it("maps 429 to RATE_LIMITED (retryable)", async () => {
      httpClient = createMockHttpClient(
        { message: "Too many requests" },
        { ok: false, status: 429 },
      );
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      try {
        await adapter.complete(baseRequest());
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderError);
        expect((e as ProviderError).code).toBe("RATE_LIMITED");
        expect((e as ProviderError).retryable).toBe(true);
      }
    });

    it("maps 500 to PROVIDER_ERROR (retryable)", async () => {
      httpClient = createMockHttpClient(
        { message: "Internal server error" },
        { ok: false, status: 500 },
      );
      const adapter = createCohereAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      try {
        await adapter.complete(baseRequest());
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderError);
        expect((e as ProviderError).code).toBe("PROVIDER_ERROR");
        expect((e as ProviderError).retryable).toBe(true);
      }
    });
  });

  describe("estimateCost", () => {
    it("returns null for all models", () => {
      httpClient = createMockHttpClient({});
      const adapter = createCohereAdapter(httpClient);
      expect(
        adapter.estimateCost("command-r-plus", {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        }),
      ).toBeNull();
    });
  });

  describe("supportsTools", () => {
    it("returns true for command-r-plus", () => {
      httpClient = createMockHttpClient({});
      const adapter = createCohereAdapter(httpClient);
      expect(adapter.supportsTools("command-r-plus")).toBe(true);
    });

    it("returns true for command-r", () => {
      httpClient = createMockHttpClient({});
      const adapter = createCohereAdapter(httpClient);
      expect(adapter.supportsTools("command-r")).toBe(true);
    });
  });
});
