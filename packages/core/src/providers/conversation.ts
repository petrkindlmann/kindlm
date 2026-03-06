import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderMessage,
  ProviderToolCall,
  ConversationResult,
  ConversationTurn,
} from "./interface.js";
import type { ToolSimulation } from "../types/config.js";

const DEFAULT_MAX_TURNS = 10;

export async function runConversation(
  adapter: ProviderAdapter,
  initialRequest: ProviderRequest,
  toolSimulations: ToolSimulation[],
  options?: { maxTurns?: number },
): Promise<ConversationResult> {
  const maxTurns = options?.maxTurns ?? DEFAULT_MAX_TURNS;
  const turns: ConversationTurn[] = [];
  const allToolCalls: ProviderToolCall[] = [];
  let messages: ProviderMessage[] = [...initialRequest.messages];
  const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let totalLatencyMs = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    const request: ProviderRequest = {
      ...initialRequest,
      messages,
    };

    const response = await adapter.complete(request);

    turns.push({ request, response });
    totalUsage.inputTokens += response.usage.inputTokens;
    totalUsage.outputTokens += response.usage.outputTokens;
    totalUsage.totalTokens += response.usage.totalTokens;
    totalLatencyMs += response.latencyMs;

    if (response.toolCalls.length === 0) {
      return {
        turns,
        finalText: response.text,
        allToolCalls,
        totalUsage,
        totalLatencyMs,
      };
    }

    allToolCalls.push(...response.toolCalls);

    messages = [
      ...messages,
      { role: "assistant", content: response.text, toolCalls: response.toolCalls },
    ];

    for (const toolCall of response.toolCalls) {
      const simulation = toolSimulations.find((s) => s.name === toolCall.name);
      let toolResponse: unknown;

      if (simulation) {
        toolResponse = resolveToolResponse(simulation, toolCall.arguments);
      } else {
        toolResponse = { error: `Tool "${toolCall.name}" not simulated` };
      }

      messages.push({
        role: "tool",
        content: JSON.stringify(toolResponse),
        toolCallId: toolCall.id,
        toolName: toolCall.name,
      });
    }
  }

  const lastTurn = turns[turns.length - 1];
  const lastResponse = lastTurn?.response ?? {
    text: "",
    toolCalls: [],
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    raw: null,
    latencyMs: 0,
    modelId: initialRequest.model,
    finishReason: "unknown" as const,
  };
  return {
    turns,
    finalText: lastResponse.text,
    allToolCalls,
    totalUsage,
    totalLatencyMs,
  };
}

function resolveToolResponse(
  simulation: ToolSimulation,
  args: Record<string, unknown>,
): unknown {
  if (simulation.responses) {
    for (const resp of simulation.responses) {
      if (matchArgs(resp.when, args)) {
        return resp.then;
      }
    }
  }

  if (simulation.defaultResponse !== undefined) {
    return simulation.defaultResponse;
  }

  return { error: "No matching simulation response" };
}

function matchArgs(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): boolean {
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
      return false;
    }
  }
  return true;
}
