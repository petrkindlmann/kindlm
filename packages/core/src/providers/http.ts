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

// User-facing config for an HTTP provider in kindlm.yaml
export interface HttpProviderConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  responsePath?: string;
  toolCallsPath?: string;
  usagePaths?: {
    inputTokens?: string;
    outputTokens?: string;
    totalTokens?: string;
  };
  modelIdPath?: string;
}

/**
 * Traverse an object by dot-separated path, supporting bracket notation for arrays.
 * E.g. "choices.0.message.content" or "data[0].text"
 */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;

  const segments = parsePath(path);
  let current: unknown = obj;

  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function parsePath(path: string): string[] {
  const segments: string[] = [];
  let current = "";

  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    if (char === ".") {
      if (current) segments.push(current);
      current = "";
    } else if (char === "[") {
      if (current) segments.push(current);
      current = "";
      const closeBracket = path.indexOf("]", i + 1);
      if (closeBracket === -1) {
        // Malformed bracket — treat rest as literal
        current = path.slice(i);
        break;
      }
      segments.push(path.slice(i + 1, closeBracket));
      i = closeBracket;
    } else {
      current += char;
    }
  }

  if (current) segments.push(current);
  return segments;
}

/**
 * Interpolate {{variable}} placeholders in body template using request data.
 * Supported variables: model, system, user, temperature, maxTokens, messages_json, tools_json
 */
export function interpolateBodyTemplate(
  template: string,
  request: ProviderRequest,
): string {
  const systemMessage = request.messages.find((m) => m.role === "system");
  const userMessage = request.messages.find((m) => m.role === "user");

  const vars: Record<string, string> = {
    model: request.model,
    system: systemMessage?.content ?? "",
    user: userMessage?.content ?? "",
    temperature: String(request.params.temperature),
    maxTokens: String(request.params.maxTokens),
    messages_json: JSON.stringify(request.messages),
    tools_json: JSON.stringify(request.tools ?? []),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });
}

/**
 * Resolve header values. Values starting with "env:" are looked up from the
 * environment map. This keeps core I/O-free — the CLI passes env values in.
 */
export function resolveHeaders(
  headers: Record<string, string>,
  envLookup: (name: string) => string | undefined,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value.startsWith("env:")) {
      const envName = value.slice(4);
      const envValue = envLookup(envName);
      if (!envValue) {
        throw new ProviderError(
          "AUTH_FAILED",
          `Missing environment variable for header "${key}": ${envName}`,
        );
      }
      resolved[key] = envValue;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

function mapHttpError(status: number, data: unknown): ProviderError {
  const message =
    typeof data === "string"
      ? data
      : typeof data === "object" && data !== null
        ? JSON.stringify(data).slice(0, 200)
        : "Unknown error";

  switch (status) {
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

export function createHttpProviderAdapter(
  httpClient: HttpClient,
  httpConfig: HttpProviderConfig,
  envLookup: (name: string) => string | undefined,
): ProviderAdapter {
  let timeoutMs = 60_000;
  let maxRetries = 2;

  return {
    name: "http",

    async initialize(config: ProviderAdapterConfig): Promise<void> {
      timeoutMs = config.timeoutMs;
      maxRetries = config.maxRetries;
    },

    async complete(request: ProviderRequest): Promise<ProviderResponse> {
      const method = httpConfig.method ?? "POST";

      // Build headers, resolving env: references
      const configHeaders = httpConfig.headers ?? {};
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...resolveHeaders(configHeaders, envLookup),
      };

      // Build body from template or default JSON payload
      let body: string;
      if (httpConfig.body) {
        body = interpolateBodyTemplate(httpConfig.body, request);
      } else {
        // Default body: OpenAI-compatible format
        const payload: Record<string, unknown> = {
          model: request.model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: request.params.temperature,
          max_tokens: request.params.maxTokens,
        };
        if (request.tools && request.tools.length > 0) {
          payload.tools = request.tools;
        }
        body = JSON.stringify(payload);
      }

      const startTime = Date.now();

      const json = await withRetry(
        async () => {
          const response = await httpClient.fetch(httpConfig.url, {
            method,
            headers,
            body,
            timeoutMs,
          });

          if (!response.ok) {
            let data: unknown;
            try {
              data = await response.json();
            } catch {
              throw new ProviderError(
                "PROVIDER_ERROR",
                `HTTP provider returned status ${response.status}`,
                response.status,
                response.status >= 500,
              );
            }
            throw mapHttpError(response.status, data);
          }

          try {
            return await response.json();
          } catch {
            throw new ProviderError(
              "PROVIDER_ERROR",
              "Malformed JSON response from HTTP provider",
              response.status,
              false,
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

      // Extract text from response using configured path or default
      const responsePath = httpConfig.responsePath ?? "choices.0.message.content";
      const text = extractString(getByPath(json, responsePath));

      // Extract tool calls if path is configured
      const toolCalls: ProviderToolCall[] = [];
      if (httpConfig.toolCallsPath) {
        const rawCalls = getByPath(json, httpConfig.toolCallsPath);
        if (Array.isArray(rawCalls)) {
          for (const tc of rawCalls) {
            if (typeof tc === "object" && tc !== null) {
              const call = tc as Record<string, unknown>;
              // Support both OpenAI-style and flat format
              const fn = call["function"] as Record<string, unknown> | undefined;
              const name = fn?.["name"] ?? call["name"];
              const argsRaw = fn?.["arguments"] ?? call["arguments"];
              let args: Record<string, unknown>;
              if (typeof argsRaw === "string") {
                try {
                  args = JSON.parse(argsRaw) as Record<string, unknown>;
                } catch {
                  args = { _raw: argsRaw };
                }
              } else if (typeof argsRaw === "object" && argsRaw !== null) {
                args = argsRaw as Record<string, unknown>;
              } else {
                args = {};
              }
              toolCalls.push({
                id: String(call["id"] ?? `call_${toolCalls.length}`),
                name: String(name ?? "unknown"),
                arguments: args,
                index: 0,
              });
            }
          }
        }
      }

      // Extract usage if paths configured
      const usagePaths = httpConfig.usagePaths;
      const usage = {
        inputTokens: extractNumber(
          usagePaths?.inputTokens
            ? getByPath(json, usagePaths.inputTokens)
            : getByPath(json, "usage.prompt_tokens"),
        ),
        outputTokens: extractNumber(
          usagePaths?.outputTokens
            ? getByPath(json, usagePaths.outputTokens)
            : getByPath(json, "usage.completion_tokens"),
        ),
        totalTokens: extractNumber(
          usagePaths?.totalTokens
            ? getByPath(json, usagePaths.totalTokens)
            : getByPath(json, "usage.total_tokens"),
        ),
      };

      // Extract model ID
      const modelIdPath = httpConfig.modelIdPath ?? "model";
      const modelId = extractString(getByPath(json, modelIdPath)) || request.model;

      return {
        text,
        toolCalls,
        usage,
        raw: json,
        latencyMs,
        modelId,
        finishReason: "stop",
      };
    },

    estimateCost(): number | null {
      // HTTP provider has no pricing table — cost estimation not available
      return null;
    },

    supportsTools(): boolean {
      // Conservative: assume tools are supported if toolCallsPath is configured
      return httpConfig.toolCallsPath !== undefined;
    },
  };
}

function extractString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function extractNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}
