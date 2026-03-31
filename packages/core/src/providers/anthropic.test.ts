import { describe, it, expect, vi } from "vitest";
import type { HttpClient, ProviderRequest } from "./interface.js";
import { ProviderError } from "./interface.js";
import { createAnthropicAdapter } from "./anthropic.js";

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
    model: "claude-sonnet-4-5-20250929",
    messages: [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ],
    params: { temperature: 0.2, maxTokens: 1024 },
    ...overrides,
  };
}

function anthropicResponse(overrides: Record<string, unknown> = {}) {
  return {
    content: [{ type: "text", text: "Hi there!" }],
    usage: { input_tokens: 10, output_tokens: 5 },
    model: "claude-sonnet-4-5-20250929",
    stop_reason: "end_turn",
    ...overrides,
  };
}

describe("createAnthropicAdapter", () => {
  describe("initialize", () => {
    it("throws AUTH_FAILED when apiKey is empty", async () => {
      const httpClient = createMockHttpClient({});
      const adapter = createAnthropicAdapter(httpClient);
      await expect(
        adapter.initialize({
          apiKey: "",
          timeoutMs: 30000,
          maxRetries: 0,
        }),
      ).rejects.toThrow(ProviderError);
    });
  });

  describe("complete", () => {
    it("extracts system message to top-level body.system", async () => {
      const httpClient = createMockHttpClient(anthropicResponse());
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.system).toBe("You are helpful.");
      expect(
        body.messages.every(
          (m: { role: string }) => m.role !== "system",
        ),
      ).toBe(true);
    });

    it("sends correct Anthropic headers", async () => {
      const httpClient = createMockHttpClient(anthropicResponse());
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const headers = getFetchCall(httpClient)[1].headers;
      expect(headers["x-api-key"]).toBe("sk-ant-test");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("sends to correct API URL", async () => {
      const httpClient = createMockHttpClient(anthropicResponse());
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(baseRequest());

      const url = getFetchCall(httpClient)[0];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
    });

    it("parses text content blocks", async () => {
      const httpClient = createMockHttpClient(anthropicResponse());
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("Hi there!");
      expect(result.toolCalls).toEqual([]);
      expect(result.finishReason).toBe("stop");
    });

    it("parses tool_use content blocks", async () => {
      const httpClient = createMockHttpClient(
        anthropicResponse({
          content: [
            {
              type: "tool_use",
              id: "toolu_123",
              name: "get_weather",
              input: { city: "London" },
            },
          ],
          stop_reason: "tool_use",
        }),
      );
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.toolCalls).toEqual([
        { id: "toolu_123", name: "get_weather", arguments: { city: "London" }, index: 0 },
      ]);
      expect(result.finishReason).toBe("tool_calls");
    });

    it("parses mixed text + tool_use blocks", async () => {
      const httpClient = createMockHttpClient(
        anthropicResponse({
          content: [
            { type: "text", text: "Let me check the weather." },
            {
              type: "tool_use",
              id: "toolu_456",
              name: "get_weather",
              input: { city: "Paris" },
            },
          ],
          stop_reason: "tool_use",
        }),
      );
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.text).toBe("Let me check the weather.");
      expect(result.toolCalls).toHaveLength(1);
    });

    it("computes totalTokens from input + output", async () => {
      const httpClient = createMockHttpClient(
        anthropicResponse({
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      );
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      const result = await adapter.complete(baseRequest());
      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      });
    });

    it("formats tools in Anthropic format", async () => {
      const httpClient = createMockHttpClient(anthropicResponse());
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          tools: [
            {
              name: "get_weather",
              description: "Get weather",
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
          name: "get_weather",
          description: "Get weather",
          input_schema: {
            type: "object",
            properties: { city: { type: "string" } },
          },
        },
      ]);
    });

    it("maps toolChoice 'required' to { type: 'any' }", async () => {
      const httpClient = createMockHttpClient(anthropicResponse());
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          tools: [{ name: "tool1" }],
          toolChoice: "required",
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.tool_choice).toEqual({ type: "any" });
    });

    it("formats tool result messages as tool_result blocks", async () => {
      const httpClient = createMockHttpClient(anthropicResponse());
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
        timeoutMs: 30000,
        maxRetries: 0,
      });

      await adapter.complete(
        baseRequest({
          messages: [
            { role: "user", content: "Get weather" },
            { role: "assistant", content: "" },
            {
              role: "tool",
              content: '{"temp": 20}',
              toolCallId: "toolu_123",
              toolName: "get_weather",
            },
          ],
        }),
      );

      const body = JSON.parse(getFetchCall(httpClient)[1].body);
      expect(body.messages[2]).toEqual({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_123",
            content: '{"temp": 20}',
          },
        ],
      });
    });
  });

  describe("error mapping", () => {
    it("maps 401 to AUTH_FAILED", async () => {
      const httpClient = createMockHttpClient(
        { error: { message: "Invalid API key" } },
        { ok: false, status: 401 },
      );
      const adapter = createAnthropicAdapter(httpClient);
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

    it("maps 429 to RATE_LIMITED (retryable)", async () => {
      const httpClient = createMockHttpClient(
        { error: { message: "Rate limited" } },
        { ok: false, status: 429 },
      );
      const adapter = createAnthropicAdapter(httpClient);
      await adapter.initialize({
        apiKey: "sk-ant-test",
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
  });

  describe("estimateCost", () => {
    it("calculates cost for known model", () => {
      const httpClient = createMockHttpClient({});
      const adapter = createAnthropicAdapter(httpClient);
      const cost = adapter.estimateCost("claude-sonnet-4-5-20250929", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      });
      expect(cost).toBe(18.0);
    });

    it("returns null for unknown model", () => {
      const httpClient = createMockHttpClient({});
      const adapter = createAnthropicAdapter(httpClient);
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
    it("returns true for all Claude models", () => {
      const httpClient = createMockHttpClient({});
      const adapter = createAnthropicAdapter(httpClient);
      expect(adapter.supportsTools("claude-sonnet-4-5-20250929")).toBe(true);
      expect(adapter.supportsTools("claude-haiku-4-5-20251001")).toBe(true);
    });
  });
});
