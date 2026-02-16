import type {
  HttpClient,
  ProviderAdapter,
  ProviderAdapterConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderToolCall,
} from "./interface.js";
import { ProviderError } from "./interface.js";
import { withRetry } from "./retry.js";

const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-5-20250929": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
};

function mapFinishReason(
  reason: string | undefined,
): ProviderResponse["finishReason"] {
  switch (reason) {
    case "end_turn":
      return "stop";
    case "max_tokens":
      return "max_tokens";
    case "tool_use":
      return "tool_calls";
    default:
      return "unknown";
  }
}

function mapError(status: number, data: unknown): ProviderError {
  const message =
    typeof data === "object" && data !== null && "error" in data
      ? String(
          (data as { error: { message?: string } }).error?.message ??
            "Unknown error",
        )
      : "Unknown error";

  switch (status) {
    case 401:
      return new ProviderError("AUTH_FAILED", message, status, false, data);
    case 429:
      return new ProviderError("RATE_LIMITED", message, status, true, data);
    case 404:
      return new ProviderError("MODEL_NOT_FOUND", message, status, false, data);
    case 400:
      if (message.toLowerCase().includes("context length")) {
        return new ProviderError(
          "CONTEXT_LENGTH",
          message,
          status,
          false,
          data,
        );
      }
      return new ProviderError("PROVIDER_ERROR", message, status, false, data);
    case 408:
      return new ProviderError("TIMEOUT", message, status, true, data);
    default:
      return new ProviderError(
        status >= 500 ? "PROVIDER_ERROR" : "UNKNOWN",
        message,
        status,
        status >= 500,
        data,
      );
  }
}

export function createAnthropicAdapter(
  httpClient: HttpClient,
): ProviderAdapter {
  let apiKey = "";
  let baseUrl = "https://api.anthropic.com";
  let timeoutMs = 60_000;
  let maxRetries = 2;

  return {
    name: "anthropic",

    async initialize(config: ProviderAdapterConfig): Promise<void> {
      if (!config.apiKey) {
        throw new ProviderError("AUTH_FAILED", "API key is required");
      }
      apiKey = config.apiKey;
      if (config.baseUrl) baseUrl = config.baseUrl;
      timeoutMs = config.timeoutMs;
      maxRetries = config.maxRetries;
    },

    async complete(request: ProviderRequest): Promise<ProviderResponse> {
      const systemMessage = request.messages.find((m) => m.role === "system");
      const nonSystemMessages = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          if (m.role === "tool") {
            return {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: m.toolCallId,
                  content: m.content,
                },
              ],
            };
          }
          if (m.role === "assistant") {
            return { role: "assistant", content: m.content };
          }
          return { role: "user", content: m.content };
        });

      const body: Record<string, unknown> = {
        model: request.model,
        max_tokens: request.params.maxTokens,
        messages: nonSystemMessages,
      };

      if (systemMessage) body.system = systemMessage.content;
      if (request.params.temperature !== undefined)
        body.temperature = request.params.temperature;
      if (request.params.topP !== undefined)
        body.top_p = request.params.topP;
      if (request.params.stopSequences)
        body.stop_sequences = request.params.stopSequences;

      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
          name: t.name,
          description: t.description ?? "",
          input_schema: t.parameters ?? { type: "object", properties: {} },
        }));
        if (request.toolChoice) {
          body.tool_choice =
            request.toolChoice === "required"
              ? { type: "any" }
              : { type: request.toolChoice };
        }
      }

      const startTime = Date.now();

      const response = await withRetry(
        () =>
          httpClient.fetch(`${baseUrl}/v1/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(body),
            timeoutMs,
          }),
        {
          maxRetries,
          shouldRetry: (error) =>
            error instanceof ProviderError && error.retryable,
        },
      );

      const json = await response.json();
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw mapError(response.status, json);
      }

      const parsed = json as {
        content?: Array<
          | { type: "text"; text: string }
          | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
        >;
        usage?: { input_tokens?: number; output_tokens?: number };
        model?: string;
        stop_reason?: string;
      };

      let text = "";
      const toolCalls: ProviderToolCall[] = [];

      for (const block of parsed.content ?? []) {
        if (block.type === "text") {
          text += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input ?? {},
          });
        }
      }

      const inputTokens = parsed.usage?.input_tokens ?? 0;
      const outputTokens = parsed.usage?.output_tokens ?? 0;

      return {
        text,
        toolCalls,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        raw: json,
        latencyMs,
        modelId: parsed.model ?? request.model,
        finishReason: mapFinishReason(parsed.stop_reason),
      };
    },

    estimateCost(
      model: string,
      usage: ProviderResponse["usage"],
    ): number | null {
      const entry = Object.entries(ANTHROPIC_PRICING).find(
        ([key]) => model.includes(key) || key.includes(model),
      );
      if (!entry) return null;
      return (
        (usage.inputTokens / 1_000_000) * entry[1].input +
        (usage.outputTokens / 1_000_000) * entry[1].output
      );
    },

    supportsTools(_model: string): boolean {
      return true;
    },
  };
}
