import type {
  HttpClient,
  ProviderAdapter,
  ProviderAdapterConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderToolCall,
} from "./interface.js";
import { ProviderError } from "./interface.js";
import type { ModelPricing } from "./pricing.js";
import { lookupModelPricing } from "./pricing.js";
import { withRetry } from "./retry.js";

const GEMINI_PRICING: Record<string, ModelPricing> = {
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
  "gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash-8b": { input: 0.0375, output: 0.15 },
};

function mapFinishReason(
  reason: string | undefined,
  hasToolCalls: boolean,
): ProviderResponse["finishReason"] {
  if (hasToolCalls) return "tool_calls";
  switch (reason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "max_tokens";
    case "SAFETY":
      return "stop";
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
    case 400:
      if (message.toLowerCase().includes("api key")) {
        return new ProviderError("AUTH_FAILED", message, status, false, data);
      }
      return new ProviderError("PROVIDER_ERROR", message, status, false, data);
    case 401:
    case 403:
      return new ProviderError("AUTH_FAILED", message, status, false, data);
    case 429:
      return new ProviderError("RATE_LIMITED", message, status, true, data);
    case 404:
      return new ProviderError("MODEL_NOT_FOUND", message, status, false, data);
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

export function createGeminiAdapter(httpClient: HttpClient): ProviderAdapter {
  let apiKey = "";
  let baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  let timeoutMs = 60_000;
  let maxRetries = 2;

  return {
    name: "gemini",

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
      const contents: Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }> = [];
      let systemInstruction: { parts: Array<{ text: string }> } | undefined;

      for (const m of request.messages) {
        if (m.role === "system") {
          systemInstruction = { parts: [{ text: m.content }] };
          continue;
        }

        if (m.role === "tool") {
          contents.push({
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: m.toolName ?? "unknown",
                  response: parseToolContent(m.content),
                },
              },
            ],
          });
          continue;
        }

        if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
          const parts: Record<string, unknown>[] = [];
          if (m.content) parts.push({ text: m.content });
          for (const tc of m.toolCalls) {
            parts.push({
              functionCall: { name: tc.name, args: tc.arguments },
            });
          }
          contents.push({ role: "model", parts });
          continue;
        }

        const geminiRole = m.role === "assistant" ? "model" : "user";
        contents.push({
          role: geminiRole,
          parts: [{ text: m.content }],
        });
      }

      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: request.params.temperature,
          maxOutputTokens: request.params.maxTokens,
        },
      };

      if (systemInstruction) {
        body.systemInstruction = systemInstruction;
      }

      const generationConfig = body.generationConfig as Record<
        string,
        unknown
      >;
      if (request.params.topP !== undefined) {
        generationConfig.topP = request.params.topP;
      }
      if (request.params.stopSequences) {
        generationConfig.stopSequences = request.params.stopSequences;
      }

      if (request.tools && request.tools.length > 0) {
        body.tools = [
          {
            functionDeclarations: request.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
          },
        ];
        if (request.toolChoice) {
          body.toolConfig = mapToolChoice(request.toolChoice);
        }
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      };

      const startTime = Date.now();

      const url = `${baseUrl}/models/${request.model}:generateContent`;

      const response = await withRetry(
        () =>
          httpClient.fetch(url, {
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
          "Malformed response body from Gemini API",
          response.status,
          response.status >= 500,
        );
      }
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        throw mapError(response.status, json);
      }

      const parsed = json as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              functionCall?: { name: string; args: Record<string, unknown> };
            }>;
          };
          finishReason?: string;
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
        modelVersion?: string;
      };

      const candidate = parsed.candidates?.[0];
      const parts = candidate?.content?.parts ?? [];

      let text = "";
      const toolCalls: ProviderToolCall[] = [];
      let toolCallIndex = 0;

      for (const part of parts) {
        if (part.text !== undefined) {
          text += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `gemini_call_${toolCallIndex}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args ?? {},
          });
          toolCallIndex++;
        }
      }

      return {
        text,
        toolCalls,
        usage: {
          inputTokens: parsed.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: parsed.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: parsed.usageMetadata?.totalTokenCount ?? 0,
        },
        raw: json,
        latencyMs,
        modelId: parsed.modelVersion ?? request.model,
        finishReason: mapFinishReason(
          candidate?.finishReason,
          toolCalls.length > 0,
        ),
      };
    },

    estimateCost(
      model: string,
      usage: ProviderResponse["usage"],
    ): number | null {
      const match = lookupModelPricing(model, GEMINI_PRICING);
      if (!match.ok) return null;
      return (
        (usage.inputTokens / 1_000_000) * match.price.input +
        (usage.outputTokens / 1_000_000) * match.price.output
      );
    },

    supportsTools(): boolean {
      return true;
    },
  };
}

function parseToolContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return { result: content };
  }
}

function mapToolChoice(
  choice: "auto" | "required" | "none",
): Record<string, unknown> {
  switch (choice) {
    case "auto":
      return { functionCallingConfig: { mode: "AUTO" } };
    case "required":
      return { functionCallingConfig: { mode: "ANY" } };
    case "none":
      return { functionCallingConfig: { mode: "NONE" } };
  }
}
