import { describe, it, expect, vi } from "vitest";
import type { ProviderAdapter, ProviderRequest, ProviderResponse } from "./interface.js";
import type { ToolSimulation } from "../types/config.js";
import { runConversation } from "./conversation.js";

function createMockAdapter(
  responses: Array<Partial<ProviderResponse>>,
): ProviderAdapter {
  let callIndex = 0;
  return {
    name: "mock",
    initialize: vi.fn(),
    complete: vi.fn().mockImplementation(async () => {
      const resp = responses[callIndex++];
      return {
        text: resp?.text ?? "",
        toolCalls: resp?.toolCalls ?? [],
        usage: resp?.usage ?? {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
        raw: {},
        latencyMs: resp?.latencyMs ?? 100,
        modelId: "mock-model",
        finishReason: resp?.finishReason ?? "stop",
      } satisfies ProviderResponse;
    }),
    estimateCost: vi.fn().mockReturnValue(null),
    supportsTools: vi.fn().mockReturnValue(true),
  };
}

function getCompleteCall(adapter: ProviderAdapter, index: number): ProviderRequest {
  const calls = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls;
  const call = calls[index];
  if (!call) throw new Error(`No complete call at index ${index}`);
  return call[0] as ProviderRequest;
}

function baseRequest(): ProviderRequest {
  return {
    model: "mock-model",
    messages: [{ role: "user", content: "Hello" }],
    params: { temperature: 0, maxTokens: 1024 },
  };
}

describe("runConversation", () => {
  it("completes in single turn when no tool calls", async () => {
    const adapter = createMockAdapter([{ text: "Hi there!" }]);
    const result = await runConversation(adapter, baseRequest(), []);
    expect(result.turns).toHaveLength(1);
    expect(result.finalText).toBe("Hi there!");
    expect(result.allToolCalls).toEqual([]);
  });

  it("handles multi-turn with tool simulation", async () => {
    const adapter = createMockAdapter([
      {
        text: "",
        toolCalls: [
          { id: "call_1", name: "get_weather", arguments: { city: "London" } },
        ],
        finishReason: "tool_calls",
      },
      { text: "The weather in London is sunny." },
    ]);

    const simulations: ToolSimulation[] = [
      {
        name: "get_weather",
        defaultResponse: { temp: 20, condition: "sunny" },
      },
    ];

    const result = await runConversation(adapter, baseRequest(), simulations);
    expect(result.turns).toHaveLength(2);
    expect(result.finalText).toBe("The weather in London is sunny.");
    expect(result.allToolCalls).toHaveLength(1);
    expect(result.allToolCalls[0]?.name).toBe("get_weather");
  });

  it("matches conditional tool responses", async () => {
    const adapter = createMockAdapter([
      {
        text: "",
        toolCalls: [
          { id: "call_1", name: "lookup", arguments: { id: "123" } },
        ],
        finishReason: "tool_calls",
      },
      { text: "Found it." },
    ]);

    const simulations: ToolSimulation[] = [
      {
        name: "lookup",
        responses: [
          { when: { id: "123" }, then: { found: true, name: "Alice" } },
          { when: { id: "456" }, then: { found: true, name: "Bob" } },
        ],
        defaultResponse: { found: false },
      },
    ];

    const result = await runConversation(adapter, baseRequest(), simulations);
    expect(result.turns).toHaveLength(2);

    const secondCall = getCompleteCall(adapter, 1);
    const toolMsg = secondCall.messages.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(JSON.parse(toolMsg?.content ?? "{}")).toEqual({
      found: true,
      name: "Alice",
    });
  });

  it("uses default response when no condition matches", async () => {
    const adapter = createMockAdapter([
      {
        text: "",
        toolCalls: [
          { id: "call_1", name: "lookup", arguments: { id: "999" } },
        ],
        finishReason: "tool_calls",
      },
      { text: "Not found." },
    ]);

    const simulations: ToolSimulation[] = [
      {
        name: "lookup",
        responses: [
          { when: { id: "123" }, then: { found: true } },
        ],
        defaultResponse: { found: false },
      },
    ];

    await runConversation(adapter, baseRequest(), simulations);
    const secondCall = getCompleteCall(adapter, 1);
    const toolMsg = secondCall.messages.find((m) => m.role === "tool");
    expect(JSON.parse(toolMsg?.content ?? "{}")).toEqual({ found: false });
  });

  it("returns error for unmatched tool name", async () => {
    const adapter = createMockAdapter([
      {
        text: "",
        toolCalls: [
          { id: "call_1", name: "unknown_tool", arguments: {} },
        ],
        finishReason: "tool_calls",
      },
      { text: "Error handling." },
    ]);

    await runConversation(adapter, baseRequest(), []);
    const secondCall = getCompleteCall(adapter, 1);
    const toolMsg = secondCall.messages.find((m) => m.role === "tool");
    expect(JSON.parse(toolMsg?.content ?? "{}")).toEqual({
      error: 'Tool "unknown_tool" not simulated',
    });
  });

  it("respects maxTurns safety limit", async () => {
    const adapter = createMockAdapter(
      Array.from({ length: 5 }, () => ({
        text: "thinking...",
        toolCalls: [
          { id: "call_x", name: "tool", arguments: {} },
        ],
        finishReason: "tool_calls" as const,
      })),
    );

    const simulations: ToolSimulation[] = [
      { name: "tool", defaultResponse: "ok" },
    ];

    const result = await runConversation(adapter, baseRequest(), simulations, {
      maxTurns: 3,
    });
    expect(result.turns).toHaveLength(3);
    expect(result.finalText).toBe("thinking...");
  });

  it("aggregates total usage across turns", async () => {
    const adapter = createMockAdapter([
      {
        text: "",
        toolCalls: [
          { id: "call_1", name: "tool", arguments: {} },
        ],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        latencyMs: 100,
      },
      {
        text: "Done",
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        latencyMs: 200,
      },
    ]);

    const simulations: ToolSimulation[] = [
      { name: "tool", defaultResponse: "ok" },
    ];

    const result = await runConversation(adapter, baseRequest(), simulations);
    expect(result.totalUsage).toEqual({
      inputTokens: 30,
      outputTokens: 15,
      totalTokens: 45,
    });
    expect(result.totalLatencyMs).toBe(300);
  });

  it("handles multiple tool calls in single turn", async () => {
    const adapter = createMockAdapter([
      {
        text: "",
        toolCalls: [
          { id: "call_1", name: "tool_a", arguments: {} },
          { id: "call_2", name: "tool_b", arguments: {} },
        ],
        finishReason: "tool_calls",
      },
      { text: "Both done." },
    ]);

    const simulations: ToolSimulation[] = [
      { name: "tool_a", defaultResponse: "a_result" },
      { name: "tool_b", defaultResponse: "b_result" },
    ];

    const result = await runConversation(adapter, baseRequest(), simulations);
    expect(result.allToolCalls).toHaveLength(2);
    expect(result.finalText).toBe("Both done.");
  });
});
