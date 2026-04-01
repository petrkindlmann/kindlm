import type {
  HttpClient,
  ProviderAdapter,
  ProviderAdapterConfig,
  ProviderRequest,
  ProviderResponse,
} from "./interface.js";
import { ProviderError } from "./interface.js";
import { withRetry } from "./retry.js";

// ============================================================
// MCP Provider Config
// ============================================================

export interface McpProviderConfig {
  serverUrl: string;
  toolName: string;
  /** Additional headers. Values starting with 'env:' are NOT resolved here —
   *  the CLI resolves them before passing to core (core is I/O-free). */
  headers?: Record<string, string>;
}

// ============================================================
// Local helpers (zero coupling to other provider modules)
// ============================================================

function extractMcpText(raw: unknown): string {
  if (typeof raw !== "object" || raw === null) return "";

  const obj = raw as Record<string, unknown>;

  // MCP protocol: { content: [{ text: "..." }] }
  if (Array.isArray(obj["content"]) && obj["content"].length > 0) {
    const first = obj["content"][0] as Record<string, unknown> | undefined;
    if (first && typeof first["text"] === "string") {
      return first["text"];
    }
  }

  // Fallback: { result: "..." }
  if (typeof obj["result"] === "string") {
    return obj["result"];
  }

  // Fallback: { output: "..." }
  if (typeof obj["output"] === "string") {
    return obj["output"];
  }

  return "";
}

function mapMcpError(status: number, data: unknown): ProviderError {
  const message =
    typeof data === "object" && data !== null && "error" in data
      ? String((data as { error: unknown }).error ?? "Unknown error")
      : typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message ?? "Unknown error")
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

// ============================================================
// Factory
// ============================================================

export function createMcpAdapter(
  httpClient: HttpClient,
  mcpConfig: McpProviderConfig,
): ProviderAdapter {
  let timeoutMs = 60_000;
  let maxRetries = 2;

  return {
    name: "mcp",

    async initialize(config: ProviderAdapterConfig): Promise<void> {
      timeoutMs = config.timeoutMs;
      maxRetries = config.maxRetries;
    },

    async complete(request: ProviderRequest): Promise<ProviderResponse> {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...mcpConfig.headers,
      };

      const body = JSON.stringify({
        toolName: mcpConfig.toolName,
        arguments: {
          messages: request.messages,
          model: request.model,
          params: request.params,
        },
      });

      const startTime = Date.now();

      const json = await withRetry(
        async () => {
          const response = await httpClient.fetch(mcpConfig.serverUrl, {
            method: "POST",
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
                "Malformed response body from MCP server",
                response.status,
                response.status >= 500,
              );
            }
            throw mapMcpError(response.status, data);
          }

          try {
            return await response.json();
          } catch {
            throw new ProviderError(
              "PROVIDER_ERROR",
              "Malformed response body from MCP server",
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

      return {
        text: extractMcpText(json),
        toolCalls: [],
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        raw: json,
        latencyMs,
        modelId: "mcp",
        finishReason: "stop",
      };
    },

    estimateCost(_model: string, _usage: ProviderResponse["usage"]): null {
      return null;
    },

    supportsTools(_model: string): boolean {
      return false;
    },
  };
}
