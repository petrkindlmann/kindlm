// ============================================================
// HTTP Client (injected — core has zero I/O)
// ============================================================

export interface HttpClient {
  fetch(url: string, init: HttpRequestInit): Promise<HttpResponse>;
}

export interface HttpRequestInit {
  method: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

// ============================================================
// Messages
// ============================================================

export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: ProviderToolCall[];
}

export interface ProviderToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  /** 0-based position in the full conversation tool call sequence (across all turns) */
  index: number;
}

export interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  params: {
    temperature: number;
    maxTokens: number;
    topP?: number;
    stopSequences?: string[];
    seed?: number;
  };
  tools?: ProviderToolDefinition[];
  toolChoice?: "auto" | "required" | "none";
}

export interface ProviderResponse {
  text: string;
  toolCalls: ProviderToolCall[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  raw: unknown;
  latencyMs: number;
  modelId: string;
  finishReason: "stop" | "max_tokens" | "tool_calls" | "error" | "unknown";
}

export type ProviderErrorCode =
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "MODEL_NOT_FOUND"
  | "CONTEXT_LENGTH"
  | "CONTENT_FILTERED"
  | "NETWORK_ERROR"
  | "PROVIDER_ERROR"
  | "UNKNOWN";

export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
    public raw?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ProviderAdapter {
  readonly name: string;
  initialize(config: ProviderAdapterConfig): Promise<void>;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  estimateCost(model: string, usage: ProviderResponse["usage"]): number | null;
  supportsTools(model: string): boolean;
  embed?(text: string, model?: string): Promise<number[]>;
}

export interface ProviderAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  timeoutMs: number;
  maxRetries: number;
}

export interface ConversationTurn {
  request: ProviderRequest;
  response: ProviderResponse;
}

export interface ConversationResult {
  turns: ConversationTurn[];
  finalText: string;
  allToolCalls: ProviderToolCall[];
  totalUsage: ProviderResponse["usage"];
  totalLatencyMs: number;
  truncated: boolean;
}
