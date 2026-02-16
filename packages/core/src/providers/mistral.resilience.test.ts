import { describe, it, expect, vi } from "vitest";
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

function baseRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    model: "mistral-large-latest",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0, maxTokens: 1024 },
    ...overrides,
  };
}

async function createInitializedAdapter(httpClient: HttpClient) {
  const adapter = createMistralAdapter(httpClient);
  await adapter.initialize({ apiKey: "test-key", timeoutMs: 60000, maxRetries: 0 });
  return adapter;
}

describe("Mistral adapter resilience", () => {
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
        expect(pe.message).toContain("Malformed response body from Mistral API");
        expect(pe.statusCode).toBe(502);
        expect(pe.retryable).toBe(true);
      }
    });
  });

  describe("tool call edge cases", () => {
    it("tool calls with malformed arguments field falls back to { _raw: ... }", async () => {
      const httpClient = createMockHttpClient({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_m1",
                  type: "function",
                  function: {
                    name: "search",
                    arguments: "{{broken json",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        model: "mistral-large-latest",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.arguments).toEqual({ _raw: "{{broken json" });
    });

    it("tool calls with empty string arguments falls back to empty object", async () => {
      const httpClient = createMockHttpClient({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_m2",
                  type: "function",
                  function: {
                    name: "ping",
                    arguments: "",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        model: "mistral-large-latest",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.toolCalls).toHaveLength(1);
      // "" || "{}" => "{}" => parses to empty object
      expect(result.toolCalls[0]?.arguments).toEqual({});
    });
  });

  describe("missing response fields", () => {
    it("missing choices results in text='' and no crash", async () => {
      const httpClient = createMockHttpClient({
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        model: "mistral-large-latest",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("");
      expect(result.toolCalls).toEqual([]);
      expect(result.finishReason).toBe("unknown");
    });

    it("missing usage object results in all-zero usage", async () => {
      const httpClient = createMockHttpClient({
        choices: [
          {
            message: { content: "Bonjour!", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        model: "mistral-large-latest",
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
});
