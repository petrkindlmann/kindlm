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

const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10.0, output: 30.0 },
  "o3-mini": { input: 1.1, output: 4.4 },
};

function mapFinishReason(
  reason: string | undefined,
): ProviderResponse["finishReason"] {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "max_tokens";
    case "tool_calls":
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

export function createOpenAIAdapter(httpClient: HttpClient): ProviderAdapter {
  let apiKey = "";
  let baseUrl = "https://api.openai.com/v1";
  let organization: string | undefined;
  let timeoutMs = 60_000;
  let maxRetries = 2;

  return {
    name: "openai",

    async initialize(config: ProviderAdapterConfig): Promise<void> {
      if (!config.apiKey) {
        throw new ProviderError("AUTH_FAILED", "API key is required");
      }
      apiKey = config.apiKey;
      if (config.baseUrl) baseUrl = config.baseUrl;
      organization = config.organization;
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
          return { role: m.role, content: m.content };
        }),
        temperature: request.params.temperature,
        max_tokens: request.params.maxTokens,
      };

      if (request.params.topP !== undefined)
        body.top_p = request.params.topP;
      if (request.params.seed !== undefined) body.seed = request.params.seed;
      if (request.params.stopSequences)
        body.stop = request.params.stopSequences;

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
      if (organization) {
        headers["OpenAI-Organization"] = organization;
      }

      const startTime = Date.now();

      const response = await withRetry(
        () =>
          httpClient.fetch(`${baseUrl}/chat/completions`, {
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
          "Malformed response body from OpenAI API",
          response.status,
          response.status >= 500,
        );
      }
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw mapError(response.status, json);
      }

      const parsed = json as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
        model?: string;
      };

      const choice = parsed.choices?.[0];
      const message = choice?.message;

      const toolCalls: ProviderToolCall[] = (message?.tool_calls ?? []).map(
        (tc) => {
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
        },
      );

      return {
        text: message?.content ?? "",
        toolCalls,
        usage: {
          inputTokens: parsed.usage?.prompt_tokens ?? 0,
          outputTokens: parsed.usage?.completion_tokens ?? 0,
          totalTokens: parsed.usage?.total_tokens ?? 0,
        },
        raw: json,
        latencyMs,
        modelId: parsed.model ?? request.model,
        finishReason: mapFinishReason(choice?.finish_reason),
      };
    },

    estimateCost(
      model: string,
      usage: ProviderResponse["usage"],
    ): number | null {
      const pricing = OPENAI_PRICING[model];
      if (!pricing) return null;
      return (
        (usage.inputTokens / 1_000_000) * pricing.input +
        (usage.outputTokens / 1_000_000) * pricing.output
      );
    },

    supportsTools(model: string): boolean {
      return !model.startsWith("o1-");
    },
  };
}
