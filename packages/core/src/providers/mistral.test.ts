import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpClient, ProviderRequest } from "./interface.js";
import { ProviderError } from "./interface.js";
import { createMistralAdapter } from "./mistral.js";

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
    model: "mistral-large-latest",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0.2, maxTokens: 1024 },
    ...overrides,
  };
}

function mistralResponse(overrides: Record<string, unknown> = {}) {
  return {
    choices: [
      {
        message: { content: "Bonjour!", tool_calls: undefined },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    model: "mistral-large-latest",
    ...overrides,
  };
}

describe("createMistralAdapter", () => {
  let httpClient: HttpClient;

  describe("initialize", () => {
    it("throws AUTH_FAILED when apiKey is empty", async () => {
      httpClient = createMockHttpClient({});
      const adapter = createMistralAdapter(httpClient);
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
      const adapter = createMistralAdapter(httpClient);
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
      httpClient = createMockHttpClient(mistralResponse());
      const adapter = createMistralAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });
    });

    it("sends request to correct Mistral endpoint", async () => {
      httpClient = createMockHttpClient(mistralResponse());
      const adapter = createMistralAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const [url, init] = getFetchCall(httpClient);
      expect(url).toBe("https://api.mistral.ai/v1/chat/completions");
      const body = JSON.parse(init.body);
      expect(body.model).toBe("mistral-large-latest");
      expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
      expect(body.temperature).toBe(0.2);
      expect(body.max_tokens).toBe(1024);
    });

    it("includes optional params when set", async () => {
      httpClient = createMockHttpClient(mistralResponse());
      const adapter = createMistralAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          params: {
            temperature: 0.7,
            maxTokens: 2048,
            topP: 0.9,
            stopSequences: ["END"],
          },
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.top_p).toBe(0.9);
      expect(body.stop).toEqual(["END"]);
    });

    it("formats tools in function calling format", async () => {
      httpClient = createMockHttpClient(mistralResponse());
      const adapter = createMistralAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          tools: [
            {
              name: "get_weather",
              description: "Get weather for a city",
              parameters: {
                type: "object",
                properties: { city: { type: "string" } },
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
            name: "get_weather",
            description: "Get weather for a city",
            parameters: {
              type: "object",
              properties: { city: { type: "string" } },
            },
          },
        },
      ]);
      expect(body.tool_choice).toBe("auto");
    });

    it("parses text-only response", async () => {
      httpClient = createMockHttpClient(mistralResponse());
      const adapter = createMistralAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("Bonjour!");
      expect(result.toolCalls).toEqual([]);
      expect(result.usage).toEqual({
        inputTokens: 8,
        outputTokens: 4,
        totalTokens: 12,
      });
      expect(result.modelId).toBe("mistral-large-latest");
      expect(result.finishReason).toBe("stop");
    });

    it("parses tool call response", async () => {
      const responseWithTools = mistralResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_abc",
                  type: "function",
                  function: {
                    name: "get_weather",
                    arguments: '{"city":"Paris"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      });
      httpClient = createMockHttpClient(responseWithTools);
      const adapter = createMistralAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("");
      expect(result.toolCalls).toEqual([
        { id: "call_abc", name: "get_weather", arguments: { city: "Paris" }, index: 0 },
      ]);
      expect(result.finishReason).toBe("tool_calls");
    });

    it("sends authorization header", async () => {
      httpClient = createMockHttpClient(mistralResponse());
      const adapter = createMistralAdapter(httpClient);
      await adapter.initialize({
        apiKey: "mistral-key-123",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const headers = getFetchCall(httpClient)[1].headers;
      expect(headers["Authorization"]).toBe("Bearer mistral-key-123");
    });

    it("formats tool messages with tool_call_id", async () => {
      httpClient = createMockHttpClient(mistralResponse());
      const adapter = createMistralAdapter(httpClient);
      await adapter.initialize({
        apiKey: "test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          messages: [
            { role: "user", content: "What's the weather?" },
            { role: "assistant", content: "" },
            {
              role: "tool",
              content: '{"temp": 15}',
              toolCallId: "call_abc",
              toolName: "get_weather",
            },
          ],
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.messages[2]).toEqual({
        role: "tool",
        content: '{"temp": 15}',
        tool_call_id: "call_abc",
      });
    });
  });

  describe("error mapping", () => {
    it("maps 401 to AUTH_FAILED", async () => {
      httpClient = createMockHttpClient(
        { message: "Unauthorized" },
        { ok: false, status: 401 },
      );
      const adapter = createMistralAdapter(httpClient);
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
        { message: "Rate limited" },
        { ok: false, status: 429 },
      );
      const adapter = createMistralAdapter(httpClient);
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
      const adapter = createMistralAdapter(httpClient);
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
      const adapter = createMistralAdapter(httpClient);
      expect(
        adapter.estimateCost("mistral-large-latest", {
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: 1500,
        }),
      ).toBeNull();
    });
  });

  describe("supportsTools", () => {
    it("returns true for mistral-large-latest", () => {
      httpClient = createMockHttpClient({});
      const adapter = createMistralAdapter(httpClient);
      expect(adapter.supportsTools("mistral-large-latest")).toBe(true);
    });

    it("returns true for mistral-small-latest", () => {
      httpClient = createMockHttpClient({});
      const adapter = createMistralAdapter(httpClient);
      expect(adapter.supportsTools("mistral-small-latest")).toBe(true);
    });
  });
});
