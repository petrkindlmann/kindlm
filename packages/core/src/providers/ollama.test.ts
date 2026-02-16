import { describe, it, expect, vi, beforeEach } from "vitest";
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

function getFetchCall(httpClient: HttpClient, index = 0) {
  const calls = (httpClient.fetch as ReturnType<typeof vi.fn>).mock.calls;
  const call = calls[index];
  if (!call) throw new Error(`No fetch call at index ${index}`);
  return call as [string, { method: string; headers: Record<string, string>; body: string }];
}

function baseRequest(overrides: Partial<ProviderRequest> = {}): ProviderRequest {
  return {
    model: "llama3.2",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0.2, maxTokens: 1024 },
    ...overrides,
  };
}

function ollamaResponse(overrides: Record<string, unknown> = {}) {
  return {
    message: { content: "Hi there!", tool_calls: undefined },
    done_reason: "stop",
    prompt_eval_count: 10,
    eval_count: 5,
    model: "llama3.2:latest",
    ...overrides,
  };
}

describe("createOllamaAdapter", () => {
  let httpClient: HttpClient;

  describe("initialize", () => {
    it("succeeds without apiKey (Ollama is local)", async () => {
      httpClient = createMockHttpClient({});
      const adapter = createOllamaAdapter(httpClient);
      await expect(
        adapter.initialize({
          apiKey: "",
          timeoutMs: 30000,
          maxRetries: 0,
        }),
      ).resolves.toBeUndefined();
    });

    it("accepts custom baseUrl", async () => {
      httpClient = createMockHttpClient(ollamaResponse());
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({
        apiKey: "",
        baseUrl: "http://192.168.1.100:11434",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const [url] = getFetchCall(httpClient);
      expect(url).toBe("http://192.168.1.100:11434/api/chat");
    });
  });

  describe("complete", () => {
    beforeEach(async () => {
      httpClient = createMockHttpClient(ollamaResponse());
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({
        apiKey: "",
        timeoutMs: 30000,
        maxRetries: 0,
      });
    });

    it("sends POST to /api/chat with stream:false", async () => {
      httpClient = createMockHttpClient(ollamaResponse());
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

      await adapter.complete(baseRequest());

      const [url, init] = getFetchCall(httpClient);
      expect(url).toBe("http://localhost:11434/api/chat");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body.stream).toBe(false);
      expect(body.model).toBe("llama3.2");
    });

    it("formats messages correctly", async () => {
      httpClient = createMockHttpClient(ollamaResponse());
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

      await adapter.complete(baseRequest());

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
    });

    it("maps model params to Ollama options format", async () => {
      httpClient = createMockHttpClient(ollamaResponse());
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

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
      expect(body.options.temperature).toBe(0.5);
      expect(body.options.num_predict).toBe(2048);
      expect(body.options.top_p).toBe(0.9);
      expect(body.options.seed).toBe(42);
      expect(body.options.stop).toEqual(["END"]);
    });

    it("formats tools in OpenAI-compatible format", async () => {
      httpClient = createMockHttpClient(ollamaResponse());
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

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
    });

    it("parses text-only response", async () => {
      httpClient = createMockHttpClient(ollamaResponse());
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("Hi there!");
      expect(result.toolCalls).toEqual([]);
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      });
      expect(result.modelId).toBe("llama3.2:latest");
      expect(result.finishReason).toBe("stop");
    });

    it("parses tool call response with synthetic IDs", async () => {
      const responseWithTools = ollamaResponse({
        message: {
          content: "",
          tool_calls: [
            {
              function: {
                name: "get_weather",
                arguments: { city: "London" },
              },
            },
            {
              function: {
                name: "get_time",
                arguments: { timezone: "UTC" },
              },
            },
          ],
        },
      });
      httpClient = createMockHttpClient(responseWithTools);
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

      const result = await adapter.complete(baseRequest());
      expect(result.toolCalls).toEqual([
        { id: "ollama_call_0", name: "get_weather", arguments: { city: "London" } },
        { id: "ollama_call_1", name: "get_time", arguments: { timezone: "UTC" } },
      ]);
      expect(result.finishReason).toBe("tool_calls");
    });

    it("maps usage from prompt_eval_count and eval_count", async () => {
      httpClient = createMockHttpClient(
        ollamaResponse({ prompt_eval_count: 100, eval_count: 50 }),
      );
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

      const result = await adapter.complete(baseRequest());
      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });
    });

    it("handles missing usage fields", async () => {
      httpClient = createMockHttpClient(
        ollamaResponse({
          prompt_eval_count: undefined,
          eval_count: undefined,
        }),
      );
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

      const result = await adapter.complete(baseRequest());
      expect(result.usage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      });
    });

    it("does not send Authorization header", async () => {
      httpClient = createMockHttpClient(ollamaResponse());
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

      await adapter.complete(baseRequest());

      const headers = getFetchCall(httpClient)[1].headers;
      expect(headers["Authorization"]).toBeUndefined();
    });
  });

  describe("error mapping", () => {
    it("maps 404 to MODEL_NOT_FOUND", async () => {
      httpClient = createMockHttpClient(
        { error: "model 'bad-model' not found" },
        { ok: false, status: 404 },
      );
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

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
        { error: "internal error" },
        { ok: false, status: 500 },
      );
      const adapter = createOllamaAdapter(httpClient);
      await adapter.initialize({ apiKey: "", timeoutMs: 30000, maxRetries: 0 });

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
    it("always returns 0 (Ollama is local)", () => {
      httpClient = createMockHttpClient({});
      const adapter = createOllamaAdapter(httpClient);
      expect(
        adapter.estimateCost("llama3.2", {
          inputTokens: 1_000_000,
          outputTokens: 1_000_000,
          totalTokens: 2_000_000,
        }),
      ).toBe(0);
    });
  });

  describe("supportsTools", () => {
    it("always returns true", () => {
      httpClient = createMockHttpClient({});
      const adapter = createOllamaAdapter(httpClient);
      expect(adapter.supportsTools("llama3.2")).toBe(true);
      expect(adapter.supportsTools("mistral")).toBe(true);
    });
  });
});
