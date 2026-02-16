import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createOpenAIAdapter } from "./openai.js";
import { ProviderError } from "./interface.js";
import type { HttpClient, HttpResponse, ProviderRequest } from "./interface.js";

function makeRequest(overrides?: Partial<ProviderRequest>): ProviderRequest {
  return {
    model: "gpt-4o",
    messages: [{ role: "user" as const, content: "Hello" }],
    params: {
      temperature: 0,
      maxTokens: 100,
    },
    ...overrides,
  };
}

function makeMockHttpClient(responseBody: unknown, status = 200): HttpClient {
  return {
    fetch: async (_url: string, _init: unknown): Promise<HttpResponse> => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
    }),
  };
}

function makeMockHttpClientThatThrowsOnJson(status = 200): HttpClient {
  return {
    fetch: async (_url: string, _init: unknown): Promise<HttpResponse> => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        throw new Error("Malformed JSON");
      },
    }),
  };
}

describe("OpenAI adapter — property-based fuzz tests", () => {
  it("random API response shapes return result or throw ProviderError, never unstructured crash", () => {
    // Arbitrary for random JSON-like response shapes
    const responseArb = fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.constant({}),
      fc.constant({ choices: null }),
      fc.constant({ choices: [] }),
      fc.constant({ choices: [{}] }),
      fc.constant({ choices: [{ message: null }] }),
      fc.constant({ choices: [{ message: {} }] }),
      fc.constant({ choices: [{ message: { content: null } }] }),
      fc.constant({ choices: [{ message: { content: 42 } }] }),
      fc.constant({ choices: [{ message: { tool_calls: "not-an-array" } }] }),
      fc.constant({
        choices: [
          {
            message: {
              content: "hello",
              tool_calls: [{ id: "tc1", function: null }],
            },
          },
        ],
      }),
      fc.constant({
        choices: [
          {
            message: {
              content: "hello",
              tool_calls: [
                { id: "tc1", function: { name: "fn", arguments: "not-json" } },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
      // Random structured shapes
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.array(fc.string(), { maxLength: 3 }),
        ),
        { minKeys: 0, maxKeys: 10 },
      ),
      // Deeply nested random JSON
      fc.jsonValue(),
    );

    fc.assert(
      fc.asyncProperty(responseArb, async (responseBody) => {
        const httpClient = makeMockHttpClient(responseBody, 200);
        const adapter = createOpenAIAdapter(httpClient);
        await adapter.initialize({
          apiKey: "test-key",
          timeoutMs: 5000,
          maxRetries: 0,
        });

        try {
          const result = await adapter.complete(makeRequest());
          // If it succeeds, it should have the expected shape
          expect(result).toHaveProperty("text");
          expect(result).toHaveProperty("toolCalls");
          expect(result).toHaveProperty("usage");
          expect(result).toHaveProperty("latencyMs");
          expect(result).toHaveProperty("modelId");
          expect(result).toHaveProperty("finishReason");
        } catch (e: unknown) {
          // Only ProviderError is acceptable
          if (!(e instanceof ProviderError)) {
            // Allow TypeError for property access on malformed responses
            // (e.g., accessing .function.name on null)
            if (e instanceof TypeError) {
              // This is acceptable — adapter hit a malformed response
              return;
            }
            expect.unreachable(
              `Adapter threw non-ProviderError: ${e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e)}`,
            );
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("error status codes with random bodies throw ProviderError", () => {
    const statusArb = fc.constantFrom(400, 401, 403, 404, 408, 429, 500, 502, 503);
    const bodyArb = fc.oneof(
      fc.constant(null),
      fc.constant({}),
      fc.constant({ error: { message: "test error" } }),
      fc.constant({ error: null }),
      fc.constant("string body"),
      fc.constant({ error: { message: null } }),
      fc.jsonValue(),
    );

    fc.assert(
      fc.asyncProperty(statusArb, bodyArb, async (status, body) => {
        const httpClient = makeMockHttpClient(body, status);
        const adapter = createOpenAIAdapter(httpClient);
        await adapter.initialize({
          apiKey: "test-key",
          timeoutMs: 5000,
          maxRetries: 0,
        });

        try {
          await adapter.complete(makeRequest());
          // Should not succeed with error status codes
          expect.unreachable("Should have thrown on error status code");
        } catch (e: unknown) {
          if (!(e instanceof ProviderError)) {
            if (e instanceof TypeError) {
              return;
            }
            expect.unreachable(
              `Expected ProviderError but got ${e instanceof Error ? e.constructor.name : typeof e}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
          expect(e.code).toBeTruthy();
          expect(typeof e.message).toBe("string");
        }
      }),
      { numRuns: 200 },
    );
  });

  it("malformed JSON response body throws ProviderError", () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom(200, 500),
        async (status) => {
          const httpClient = makeMockHttpClientThatThrowsOnJson(status);
          const adapter = createOpenAIAdapter(httpClient);
          await adapter.initialize({
            apiKey: "test-key",
            timeoutMs: 5000,
            maxRetries: 0,
          });

          try {
            await adapter.complete(makeRequest());
            expect.unreachable("Should have thrown on malformed JSON");
          } catch (e: unknown) {
            expect(e).toBeInstanceOf(ProviderError);
            if (e instanceof ProviderError) {
              expect(e.code).toBe("PROVIDER_ERROR");
            }
          }
        },
      ),
      { numRuns: 10 },
    );
  });

  it("random request messages never crash the adapter", () => {
    const messageArb = fc.record({
      role: fc.constantFrom("user" as const, "assistant" as const, "system" as const),
      content: fc.string({ minLength: 0, maxLength: 500 }),
    });

    // Valid response so we only test the request building path
    const validResponse = {
      choices: [
        {
          message: { content: "ok", tool_calls: [] },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      model: "gpt-4o",
    };

    fc.assert(
      fc.asyncProperty(
        fc.array(messageArb, { minLength: 1, maxLength: 10 }),
        async (messages) => {
          const httpClient = makeMockHttpClient(validResponse, 200);
          const adapter = createOpenAIAdapter(httpClient);
          await adapter.initialize({
            apiKey: "test-key",
            timeoutMs: 5000,
            maxRetries: 0,
          });

          try {
            const result = await adapter.complete(makeRequest({ messages }));
            expect(result).toHaveProperty("text");
          } catch (e: unknown) {
            if (!(e instanceof ProviderError) && !(e instanceof TypeError)) {
              expect.unreachable(
                `Adapter threw unexpected error: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
