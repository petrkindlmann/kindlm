import { describe, it, expect, vi } from "vitest";
import type { HttpClient, ProviderRequest } from "./interface.js";
import { ProviderError } from "./interface.js";
import { createAnthropicAdapter } from "./anthropic.js";

function baseRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    model: "claude-sonnet-4-5-20250929",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ],
    params: { temperature: 0, maxTokens: 1024 },
    ...overrides,
  };
}

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

async function createInitializedAdapter(httpClient: HttpClient) {
  const adapter = createAnthropicAdapter(httpClient);
  await adapter.initialize({ apiKey: "test-key", timeoutMs: 60000, maxRetries: 0 });
  return adapter;
}

describe("Anthropic adapter resilience", () => {
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

    it("HTML error page where json() throws produces structured error", async () => {
      const httpClient: HttpClient = {
        fetch: vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
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
        expect(pe.message).toContain("Malformed response body from Anthropic API");
        expect(pe.retryable).toBe(true);
      }
    });
  });

  describe("missing response fields", () => {
    it("missing content array results in text='' and no crash", async () => {
      const httpClient = createMockHttpClient({
        usage: { input_tokens: 10, output_tokens: 0 },
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("");
      expect(result.toolCalls).toEqual([]);
    });

    it("missing usage object results in all-zero usage", async () => {
      const httpClient = createMockHttpClient({
        content: [{ type: "text", text: "Hello!" }],
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "end_turn",
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

  describe("stop_reason edge cases", () => {
    it("unknown stop_reason maps to finishReason 'unknown'", async () => {
      const httpClient = createMockHttpClient({
        content: [{ type: "text", text: "Hello!" }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: "claude-sonnet-4-5-20250929",
        stop_reason: "some_future_reason",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.finishReason).toBe("unknown");
    });

    it("undefined stop_reason maps to finishReason 'unknown'", async () => {
      const httpClient = createMockHttpClient({
        content: [{ type: "text", text: "Hello!" }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: "claude-sonnet-4-5-20250929",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.finishReason).toBe("unknown");
    });
  });
});
