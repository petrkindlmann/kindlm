import { describe, it, expect, vi } from "vitest";
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

function baseRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    model: "gemini-2.0-flash",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0, maxTokens: 1024 },
    ...overrides,
  };
}

async function createInitializedAdapter(httpClient: HttpClient) {
  const adapter = createGeminiAdapter(httpClient);
  await adapter.initialize({ apiKey: "test-key", timeoutMs: 60000, maxRetries: 0 });
  return adapter;
}

describe("Gemini adapter resilience", () => {
  describe("malformed response bodies", () => {
    it("empty response body (json() throws) produces structured ProviderError", async () => {
      const httpClient: HttpClient = {
        fetch: vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: () => Promise.reject(new Error("Unexpected token <")),
        }),
      };
      const adapter = await createInitializedAdapter(httpClient);

      try {
        await adapter.complete(baseRequest());
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderError);
        const pe = e as ProviderError;
        expect(pe.code).toBe("PROVIDER_ERROR");
        expect(pe.message).toContain("Malformed response body from Gemini API");
        expect(pe.statusCode).toBe(502);
        expect(pe.retryable).toBe(true);
      }
    });
  });

  describe("missing response fields", () => {
    it("missing candidates results in text='' and no crash", async () => {
      const httpClient = createMockHttpClient({
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 0,
          totalTokenCount: 10,
        },
        modelVersion: "gemini-2.0-flash-001",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("");
      expect(result.toolCalls).toEqual([]);
      expect(result.finishReason).toBe("unknown");
    });

    it("missing usageMetadata results in all-zero usage", async () => {
      const httpClient = createMockHttpClient({
        candidates: [
          {
            content: {
              parts: [{ text: "Hello!" }],
            },
            finishReason: "STOP",
          },
        ],
        modelVersion: "gemini-2.0-flash-001",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });
  });

  describe("HTTP 200 with error body", () => {
    it("throws ProviderError when Gemini returns 200 with error payload", async () => {
      const httpClient = createMockHttpClient({
        error: {
          code: 400,
          message: "API key not valid. Please pass a valid API key.",
          status: "INVALID_ARGUMENT",
        },
      });
      const adapter = await createInitializedAdapter(httpClient);

      try {
        await adapter.complete(baseRequest());
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderError);
        const pe = e as ProviderError;
        expect(pe.message).toContain("API key not valid");
      }
    });

    it("throws ProviderError for 200 with error code 429 (rate limited)", async () => {
      const httpClient = createMockHttpClient({
        error: {
          code: 429,
          message: "Resource has been exhausted",
          status: "RESOURCE_EXHAUSTED",
        },
      });
      const adapter = await createInitializedAdapter(httpClient);

      try {
        await adapter.complete(baseRequest());
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderError);
        const pe = e as ProviderError;
        expect(pe.code).toBe("RATE_LIMITED");
        expect(pe.retryable).toBe(true);
      }
    });
  });

  describe("tool call edge cases", () => {
    it("tool calls with args already as objects (no JSON.parse needed) work correctly", async () => {
      const httpClient = createMockHttpClient({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "get_weather",
                    args: { city: "London", units: "celsius" },
                  },
                },
              ],
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
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]).toEqual({
        id: "gemini_call_0",
        name: "get_weather",
        arguments: { city: "London", units: "celsius" },
        index: 0,
      });
      expect(result.finishReason).toBe("tool_calls");
    });

    it("tool calls with undefined args fall back to empty object", async () => {
      const httpClient = createMockHttpClient({
        candidates: [
          {
            content: {
              parts: [
                {
                  functionCall: {
                    name: "get_status",
                    args: undefined,
                  },
                },
              ],
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
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.arguments).toEqual({});
    });
  });
});
