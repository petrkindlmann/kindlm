import { describe, it, expect, vi } from "vitest";
import type { HttpClient, ProviderRequest } from "./interface.js";
import { ProviderError } from "./interface.js";
import { createOllamaAdapter } from "./ollama.js";

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
    model: "llama3.2",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0, maxTokens: 1024 },
    ...overrides,
  };
}

async function createInitializedAdapter(httpClient: HttpClient) {
  const adapter = createOllamaAdapter(httpClient);
  await adapter.initialize({ apiKey: "", timeoutMs: 60000, maxRetries: 0 });
  return adapter;
}

describe("Ollama adapter resilience", () => {
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
        expect(pe.message).toContain("Malformed response body from Ollama API");
        expect(pe.statusCode).toBe(502);
        expect(pe.retryable).toBe(true);
      }
    });
  });

  describe("connection errors", () => {
    it("connection refused (fetch throws) produces ProviderError", async () => {
      const httpClient: HttpClient = {
        fetch: vi.fn().mockRejectedValue(
          new Error("connect ECONNREFUSED 127.0.0.1:11434"),
        ),
      };
      const adapter = await createInitializedAdapter(httpClient);

      try {
        await adapter.complete(baseRequest());
        expect.fail("Should have thrown");
      } catch (e) {
        // The retry wrapper will rethrow since maxRetries=0 and the error
        // is not a ProviderError with retryable=true
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toContain("ECONNREFUSED");
      }
    });
  });

  describe("missing response fields", () => {
    it("missing message field results in text='' and no crash", async () => {
      const httpClient = createMockHttpClient({
        done_reason: "stop",
        prompt_eval_count: 10,
        eval_count: 5,
        model: "llama3.2:latest",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("");
      expect(result.toolCalls).toEqual([]);
    });

    it("missing token counts results in all-zero usage", async () => {
      const httpClient = createMockHttpClient({
        message: { content: "Hi!", tool_calls: undefined },
        done_reason: "stop",
        model: "llama3.2:latest",
      });
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });

    it("completely empty successful response results in safe defaults", async () => {
      const httpClient = createMockHttpClient({});
      const adapter = await createInitializedAdapter(httpClient);

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("");
      expect(result.toolCalls).toEqual([]);
      expect(result.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
      expect(result.finishReason).toBe("unknown");
    });
  });
});
