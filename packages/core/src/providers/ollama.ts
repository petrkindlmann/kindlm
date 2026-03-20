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
  doneReason: string | undefined,
  hasToolCalls: boolean,
): ProviderResponse["finishReason"] {
  if (hasToolCalls) return "tool_calls";
  switch (doneReason) {
    case "stop":
      return "stop";
    case "length":
      return "max_tokens";
    default:
      return "unknown";
  }
}

function mapError(status: number, data: unknown): ProviderError {
  const message =
    typeof data === "object" && data !== null && "error" in data
      ? String((data as { error: string }).error)
      : "Unknown error";

  switch (status) {
    case 404:
      return new ProviderError("MODEL_NOT_FOUND", message, status, false, data);
    case 429:
      return new ProviderError("RATE_LIMITED", message, status, true, data);
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

export function createOllamaAdapter(httpClient: HttpClient): ProviderAdapter {
  let baseUrl = "http://localhost:11434";
  let timeoutMs = 60_000;
  let maxRetries = 2;

  return {
    name: "ollama",

    async initialize(config: ProviderAdapterConfig): Promise<void> {
      if (config.baseUrl) baseUrl = config.baseUrl;
      timeoutMs = config.timeoutMs;
      maxRetries = config.maxRetries;
    },

    async complete(request: ProviderRequest): Promise<ProviderResponse> {
      const messages = request.messages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool" as const,
            content: m.content,
          };
        }
        if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
          return {
            role: "assistant" as const,
            content: m.content || "",
            tool_calls: m.toolCalls.map((tc) => ({
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            })),
          };
        }
        return { role: m.role, content: m.content };
      });

      const body: Record<string, unknown> = {
        model: request.model,
        messages,
        stream: false,
        options: {
          temperature: request.params.temperature,
          num_predict: request.params.maxTokens,
        },
      };

      const options = body.options as Record<string, unknown>;
      if (request.params.topP !== undefined)
        options.top_p = request.params.topP;
      if (request.params.seed !== undefined) options.seed = request.params.seed;
      if (request.params.stopSequences)
        options.stop = request.params.stopSequences;

      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const startTime = Date.now();

      const json = await withRetry(
        async () => {
          const response = await httpClient.fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            timeoutMs,
          });

          if (!response.ok) {
            let data: unknown;
            try {
              data = await response.json();
            } catch {
              throw new ProviderError(
                "PROVIDER_ERROR",
                "Malformed response body from Ollama API",
                response.status,
                response.status >= 500,
              );
            }
            throw mapError(response.status, data);
          }

          try {
            return await response.json();
          } catch {
            throw new ProviderError(
              "PROVIDER_ERROR",
              "Malformed response body from Ollama API",
              response.status,
              response.status >= 500,
            );
          }
        },
        {
          maxRetries,
          shouldRetry: (error) =>
            error instanceof ProviderError && error.retryable,
        },
      );

      const latencyMs = Date.now() - startTime;

      const parsed = json as {
        message?: {
          content?: string;
          tool_calls?: Array<{
            function: { name: string; arguments: Record<string, unknown> };
          }>;
        };
        done_reason?: string;
        prompt_eval_count?: number;
        eval_count?: number;
        model?: string;
      };

      const message = parsed.message;
      const rawToolCalls = message?.tool_calls ?? [];

      const toolCalls: ProviderToolCall[] = rawToolCalls.map((tc, index) => ({
        id: `ollama_call_${Date.now()}_${index}`,
        name: tc.function.name,
        arguments: tc.function.arguments ?? {},
      }));

      return {
        text: message?.content ?? "",
        toolCalls,
        usage: {
          inputTokens: parsed.prompt_eval_count ?? 0,
          outputTokens: parsed.eval_count ?? 0,
          totalTokens:
            (parsed.prompt_eval_count ?? 0) + (parsed.eval_count ?? 0),
        },
        raw: json,
        latencyMs,
        modelId: parsed.model ?? request.model,
        finishReason: mapFinishReason(
          parsed.done_reason,
          rawToolCalls.length > 0,
        ),
      };
    },

    estimateCost(): number | null {
      return 0;
    },

    supportsTools(): boolean {
      return true;
    },
  };
}
