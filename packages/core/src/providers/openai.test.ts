import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpClient, ProviderRequest } from "./interface.js";
import { ProviderError } from "./interface.js";
import { createOpenAIAdapter } from "./openai.js";

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
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0.2, maxTokens: 1024 },
    ...overrides,
  };
}

function openaiResponse(overrides: Record<string, unknown> = {}) {
  return {
    choices: [
      {
        message: { content: "Hi there!", tool_calls: undefined },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    model: "gpt-4o-2024-08-06",
    ...overrides,
  };
}

describe("createOpenAIAdapter", () => {
  let httpClient: HttpClient;

  describe("initialize", () => {
    it("throws AUTH_FAILED when apiKey is empty", async () => {
      httpClient = createMockHttpClient({});
      const adapter = createOpenAIAdapter(httpClient);
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
      const adapter = createOpenAIAdapter(httpClient);
      await expect(
        adapter.initialize({
          apiKey: "sk-test",
          timeoutMs: 30000,
          maxRetries: 0,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("complete", () => {
    beforeEach(async () => {
      httpClient = createMockHttpClient(openaiResponse());
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });
    });

    it("formats basic messages correctly", async () => {
      httpClient = createMockHttpClient(openaiResponse());
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const [url, init] = getFetchCall(httpClient);
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(init.body);
      expect(body.model).toBe("gpt-4o");
      expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
      expect(body.temperature).toBe(0.2);
      expect(body.max_tokens).toBe(1024);
    });

    it("includes optional params when set", async () => {
      httpClient = createMockHttpClient(openaiResponse());
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          params: {
            temperature: 0.5,
            maxTokens: 2048,
            topP: 0.9,
            seed: 42,
            stopSequences: ["END"],
          },
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.top_p).toBe(0.9);
      expect(body.seed).toBe(42);
      expect(body.stop).toEqual(["END"]);
    });

    it("formats tools in OpenAI function calling format", async () => {
      httpClient = createMockHttpClient(openaiResponse());
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
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
      httpClient = createMockHttpClient(openaiResponse());
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("Hi there!");
      expect(result.toolCalls).toEqual([]);
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
      expect(result.modelId).toBe("gpt-4o-2024-08-06");
      expect(result.finishReason).toBe("stop");
    });

    it("parses tool call response", async () => {
      const responseWithTools = openaiResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_123",
                  type: "function",
                  function: {
                    name: "get_weather",
                    arguments: '{"city":"London"}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      });
      httpClient = createMockHttpClient(responseWithTools);
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("");
      expect(result.toolCalls).toEqual([
        { id: "call_123", name: "get_weather", arguments: { city: "London" }, index: 0 },
      ]);
      expect(result.finishReason).toBe("tool_calls");
    });

    it("sends authorization header", async () => {
      httpClient = createMockHttpClient(openaiResponse());
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-my-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const headers = getFetchCall(httpClient)[1].headers;
      expect(headers["Authorization"]).toBe("Bearer sk-my-key");
    });

    it("sends organization header when configured", async () => {
      httpClient = createMockHttpClient(openaiResponse());
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
        organization: "org-123",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const headers = getFetchCall(httpClient)[1].headers;
      expect(headers["OpenAI-Organization"]).toBe("org-123");
    });

    it("formats tool messages with tool_call_id", async () => {
      httpClient = createMockHttpClient(openaiResponse());
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
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
              content: '{"temp": 20}',
              toolCallId: "call_123",
              toolName: "get_weather",
            },
          ],
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.messages[2]).toEqual({
        role: "tool",
        content: '{"temp": 20}',
        tool_call_id: "call_123",
      });
    });
  });

  describe("error mapping", () => {
    it("maps 401 to AUTH_FAILED", async () => {
      httpClient = createMockHttpClient(
        { error: { message: "Invalid API key" } },
        { ok: false, status: 401 },
      );
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-bad",
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

    it("maps 429 to RATE_LIMITED", async () => {
      httpClient = createMockHttpClient(
        { error: { message: "Rate limited" } },
        { ok: false, status: 429 },
      );
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
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

    it("maps 404 to MODEL_NOT_FOUND", async () => {
      httpClient = createMockHttpClient(
        { error: { message: "Model not found" } },
        { ok: false, status: 404 },
      );
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      try {
        await adapter.complete(baseRequest());
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderError);
        expect((e as ProviderError).code).toBe("MODEL_NOT_FOUND");
      }
    });

    it("maps 500 to PROVIDER_ERROR (retryable)", async () => {
      httpClient = createMockHttpClient(
        { error: { message: "Internal server error" } },
        { ok: false, status: 500 },
      );
      const adapter = createOpenAIAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-test",
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
    it("calculates cost for known model", () => {
      httpClient = createMockHttpClient({});
      const adapter = createOpenAIAdapter(httpClient);
      const cost = adapter.estimateCost("gpt-4o", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      });
      expect(cost).toBe(12.5);
    });

    it("returns null for unknown model", () => {
      httpClient = createMockHttpClient({});
      const adapter = createOpenAIAdapter(httpClient);
      expect(
        adapter.estimateCost("unknown-model", {
          inputTokens: 100,
          outputTokens: 100,
          totalTokens: 200,
        }),
      ).toBeNull();
    });
  });

  describe("supportsTools", () => {
    it("returns true for gpt-4o", () => {
      httpClient = createMockHttpClient({});
      const adapter = createOpenAIAdapter(httpClient);
      expect(adapter.supportsTools("gpt-4o")).toBe(true);
    });

    it("returns false for o1-mini", () => {
      httpClient = createMockHttpClient({});
      const adapter = createOpenAIAdapter(httpClient);
      expect(adapter.supportsTools("o1-mini")).toBe(false);
    });

    it("returns false for o1-preview", () => {
      httpClient = createMockHttpClient({});
      const adapter = createOpenAIAdapter(httpClient);
      expect(adapter.supportsTools("o1-preview")).toBe(false);
    });

    it("returns true for o3-mini", () => {
      httpClient = createMockHttpClient({});
      const adapter = createOpenAIAdapter(httpClient);
      expect(adapter.supportsTools("o3-mini")).toBe(true);
    });
  });
});
