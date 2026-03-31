import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HttpClient, ProviderRequest } from "./interface.js";
import { ProviderError } from "./interface.js";
import { createGeminiAdapter } from "./gemini.js";

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
    model: "gemini-2.0-flash",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0.2, maxTokens: 1024 },
    ...overrides,
  };
}

function geminiResponse(overrides: Record<string, unknown> = {}) {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: "Hi there!" }],
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      totalTokenCount: 15,
    },
    modelVersion: "gemini-2.0-flash-001",
    ...overrides,
  };
}

describe("createGeminiAdapter", () => {
  let httpClient: HttpClient;

  describe("initialize", () => {
    it("throws AUTH_FAILED when apiKey is empty", async () => {
      httpClient = createMockHttpClient({});
      const adapter = createGeminiAdapter(httpClient);
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
      const adapter = createGeminiAdapter(httpClient);
      await expect(
        adapter.initialize({
          apiKey: "AIza-test-key",
          timeoutMs: 30000,
          maxRetries: 0,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("complete", () => {
    beforeEach(async () => {
      httpClient = createMockHttpClient(geminiResponse());
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });
    });

    it("formats basic messages and sends to correct URL", async () => {
      httpClient = createMockHttpClient(geminiResponse());
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const [url, init] = getFetchCall(httpClient);
      expect(url).toBe(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      );
      const body = JSON.parse(init.body);
      expect(body.contents).toEqual([
        { role: "user", parts: [{ text: "Hello" }] },
      ]);
      expect(body.generationConfig.temperature).toBe(0.2);
      expect(body.generationConfig.maxOutputTokens).toBe(1024);
    });

    it("sends x-goog-api-key header (not Bearer token)", async () => {
      httpClient = createMockHttpClient(geminiResponse());
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-my-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const headers = getFetchCall(httpClient)[1].headers;
      expect(headers["x-goog-api-key"]).toBe("AIza-my-key");
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("extracts system message into systemInstruction", async () => {
      httpClient = createMockHttpClient(geminiResponse());
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "Hello" },
          ],
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.systemInstruction).toEqual({
        parts: [{ text: "You are a helpful assistant." }],
      });
      expect(body.contents).toEqual([
        { role: "user", parts: [{ text: "Hello" }] },
      ]);
    });

    it("includes optional params when set", async () => {
      httpClient = createMockHttpClient(geminiResponse());
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
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
      expect(body.generationConfig.topP).toBe(0.9);
      expect(body.generationConfig.stopSequences).toEqual(["END"]);
    });

    it("formats tools as functionDeclarations", async () => {
      httpClient = createMockHttpClient(geminiResponse());
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
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
          functionDeclarations: [
            {
              name: "get_weather",
              description: "Get weather for a city",
              parameters: {
                type: "object",
                properties: { city: { type: "string" } },
              },
            },
          ],
        },
      ]);
      expect(body.toolConfig).toEqual({
        functionCallingConfig: { mode: "AUTO" },
      });
    });

    it("parses text-only response", async () => {
      httpClient = createMockHttpClient(geminiResponse());
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
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
      expect(result.modelId).toBe("gemini-2.0-flash-001");
      expect(result.finishReason).toBe("stop");
    });

    it("parses tool call response with synthetic IDs", async () => {
      const responseWithTools = geminiResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "get_weather",
                    args: { city: "London" },
                  },
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      });
      httpClient = createMockHttpClient(responseWithTools);
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("");
      expect(result.toolCalls).toEqual([
        {
          id: "gemini_call_0",
          name: "get_weather",
          arguments: { city: "London" },
          index: 0,
        },
      ]);
      expect(result.finishReason).toBe("tool_calls");
    });

    it("maps assistant role to model in contents", async () => {
      httpClient = createMockHttpClient(geminiResponse());
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          messages: [
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi there" },
            { role: "user", content: "How are you?" },
          ],
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.contents[1].role).toBe("model");
    });

    it("formats tool result messages as functionResponse", async () => {
      httpClient = createMockHttpClient(geminiResponse());
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
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
              toolCallId: "gemini_call_0",
              toolName: "get_weather",
            },
          ],
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.contents[2]).toEqual({
        role: "function",
        parts: [
          {
            functionResponse: {
              name: "get_weather",
              response: { temp: 20 },
            },
          },
        ],
      });
    });
  });

  describe("error mapping", () => {
    it("maps 401 to AUTH_FAILED", async () => {
      httpClient = createMockHttpClient(
        { error: { message: "API key not valid" } },
        { ok: false, status: 401 },
      );
      const adapter = createGeminiAdapter(httpClient);
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
        { error: { message: "Resource exhausted" } },
        { ok: false, status: 429 },
      );
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
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
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
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
        { error: { message: "Internal error" } },
        { ok: false, status: 500 },
      );
      const adapter = createGeminiAdapter(httpClient);
      await adapter.initialize({
        apiKey: "AIza-test-key",
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
      const adapter = createGeminiAdapter(httpClient);
      const cost = adapter.estimateCost("gemini-1.5-pro", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      });
      expect(cost).toBe(6.25);
    });

    it("returns null for unknown model", () => {
      httpClient = createMockHttpClient({});
      const adapter = createGeminiAdapter(httpClient);
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
    it("returns true for all gemini models", () => {
      httpClient = createMockHttpClient({});
      const adapter = createGeminiAdapter(httpClient);
      expect(adapter.supportsTools("gemini-2.0-flash")).toBe(true);
      expect(adapter.supportsTools("gemini-1.5-pro")).toBe(true);
      expect(adapter.supportsTools("gemini-1.5-flash")).toBe(true);
    });
  });
});
