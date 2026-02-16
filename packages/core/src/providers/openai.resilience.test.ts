import { describe, it, expect, vi } from "vitest";
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

function baseRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0, maxTokens: 1024 },
    ...overrides,
  };
}

async function createInitializedAdapter(httpClient: HttpClient) {
  const adapter = createOpenAIAdapter(httpClient);
  await adapter.initialize({ apiKey: "test-key", timeoutMs: 60000, maxRetries: 0 });
  return adapter;
}

describe("OpenAI adapter resilience", () => {
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
        expect(pe.message).toContain("Malformed response body");
        expect(pe.statusCode).toBe(502);
        expect(pe.retryable).toBe(true);
      }
    });

    it("HTML error page (Cloudflare 502) where json() throws produces structured error", async () => {
      const httpClient: HttpClient = {
        fetch: vi.fn().mockResolvedValue({
          ok: false,
          status: 502,
          json: () =>
            Promise.reject(
              new SyntaxError("Unexpected token '<', \"<html>...\" is not valid JSON"),
            ),
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
        expect(pe.retryable).toBe(true);
      }
    });

    it("partial JSON where json() throws produces structured error", async () => {
      const httpClient: HttpClient = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.reject(new SyntaxError("Unexpected end of JSON input")),
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
        expect(pe.message).toContain("Malformed response body");
      }
    });
  });

  describe("rate limiting", () => {
    it("429 with error body produces ProviderError with RATE_LIMITED", async () => {
      const httpClient = createMockHttpClient(
        { error: { message: "rate limited" } },
        { ok: false, status: 429 },
      );
      const adapter = await createInitializedAdapter(httpClient);

      try {
        await adapter.complete(baseRequest());
        expect.fail("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ProviderError);
        const pe = e as ProviderError;
        expect(pe.code).toBe("RATE_LIMITED");
        expect(pe.retryable).toBe(true);
        expect(pe.message).toBe("rate limited");
      }
    });
  });

  describe("tool call edge cases", () => {
    it("tool calls with null arguments field falls back to { _raw: ... }", async () => {
      const httpClient = createMockHttpClient({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "do_thing",
                    arguments: null,
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        model: "gpt-4o",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.toolCalls).toHaveLength(1);
      // null || "{}" => "{}" => parses to empty object
      expect(result.toolCalls[0]?.arguments).toEqual({});
    });

    it("tool calls with malformed JSON arguments field falls back to { _raw: ... }", async () => {
      const httpClient = createMockHttpClient({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_2",
                  type: "function",
                  function: {
                    name: "do_thing",
                    arguments: "not valid json {{{",
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        model: "gpt-4o",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.arguments).toEqual({ _raw: "not valid json {{{"});
    });
  });

  describe("200 OK with embedded error body", () => {
    it("200 OK with error message body is parsed as success (no crash)", async () => {
      const httpClient = createMockHttpClient({
        choices: [
          {
            message: { content: "Some text", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        model: "gpt-4o",
        error: { message: "rate limited" },
      });
      const adapter = await createInitializedAdapter(httpClient);

      // response.ok is true, so mapError is not called; the response is parsed as success
      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("Some text");
      expect(result.toolCalls).toEqual([]);
    });
  });

  describe("finish_reason edge cases", () => {
    it("finish_reason 'length' (truncated) is handled as max_tokens", async () => {
      const httpClient = createMockHttpClient({
        choices: [
          {
            message: { content: "Truncated resp...", tool_calls: undefined },
            finish_reason: "length",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 1024, total_tokens: 1034 },
        model: "gpt-4o",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.finishReason).toBe("max_tokens");
      expect(result.text).toBe("Truncated resp...");
    });
  });

  describe("missing response fields", () => {
    it("missing choices array results in text='' and no crash", async () => {
      const httpClient = createMockHttpClient({
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
        model: "gpt-4o",
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
            message: { content: "Hello!", tool_calls: undefined },
            finish_reason: "stop",
          },
        ],
        model: "gpt-4o",
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
