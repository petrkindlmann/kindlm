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

function mapFinishReason(
  reason: string | undefined,
): ProviderResponse["finishReason"] {
  switch (reason) {
    case "COMPLETE":
      return "stop";
    case "MAX_TOKENS":
      return "max_tokens";
    case "TOOL_CALL":
      return "tool_calls";
    default:
      return "unknown";
  }
}

function mapError(status: number, data: unknown): ProviderError {
  const message =
    typeof data === "object" && data !== null && "message" in data
      ? String((data as { message?: string }).message ?? "Unknown error")
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

export function createCohereAdapter(httpClient: HttpClient): ProviderAdapter {
  let apiKey = "";
  let baseUrl = "https://api.cohere.com";
  let timeoutMs = 60_000;
  let maxRetries = 2;

  return {
    name: "cohere",

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
      const body: Record<string, unknown> = {
        model: request.model,
        messages: request.messages.map((m) => {
          if (m.role === "tool") {
            return {
              role: "tool",
              content: m.content,
              tool_call_id: m.toolCallId,
            };
          }
          if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
            return {
              role: "assistant",
              content: m.content || null,
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            };
          }
          return { role: m.role, content: m.content };
        }),
        temperature: request.params.temperature,
        max_tokens: request.params.maxTokens,
      };

      if (request.params.topP !== undefined)
        body.p = request.params.topP;
      if (request.params.stopSequences)
        body.stop_sequences = request.params.stopSequences;

      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));
        if (request.toolChoice) {
          body.tool_choice = request.toolChoice;
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      };

      const startTime = Date.now();

      const response = await withRetry(
        () =>
          httpClient.fetch(`${baseUrl}/v2/chat`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            timeoutMs,
          }),
        {
          maxRetries,
          shouldRetry: (error) =>
            error instanceof ProviderError && error.retryable,
        },
      );

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new ProviderError(
          "PROVIDER_ERROR",
          "Malformed response body from Cohere API",
          response.status,
          response.status >= 500,
        );
      }
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw mapError(response.status, json);
      }

      const parsed = json as {
        message?: {
          role?: string;
          content?: Array<{ type: string; text: string }>;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
        usage?: {
          tokens?: {
            input_tokens?: number;
            output_tokens?: number;
          };
        };
        model?: string;
      };

      const text =
        parsed.message?.content
          ?.filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("") ?? "";

      const toolCalls: ProviderToolCall[] = (
        parsed.message?.tool_calls ?? []
      ).map((tc) => {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          args = { _raw: tc.function.arguments };
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        };
      });

      const inputTokens = parsed.usage?.tokens?.input_tokens ?? 0;
      const outputTokens = parsed.usage?.tokens?.output_tokens ?? 0;

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
        finishReason: mapFinishReason(parsed.finish_reason),
      };
    },

    estimateCost(
      _model: string,
      _usage: ProviderResponse["usage"],
    ): number | null {
      // Cohere pricing varies by model; return null for now
      return null;
    },

    supportsTools(_model: string): boolean {
      // Cohere v2 API supports tools for all current models
      return true;
    },
  };
}
