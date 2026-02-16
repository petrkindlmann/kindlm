# KindLM Provider Interface

## Overview

Provider adapters abstract the differences between LLM APIs (OpenAI, Anthropic, etc.) behind a unified interface. The adapter handles:

1. Authentication (reading API key from environment)
2. Request formatting (mapping KindLM's internal format to provider-specific format)
3. Response parsing (extracting text, tool calls, usage metadata)
4. Error normalization (provider-specific errors → KindLM error codes)

---

## Core Interfaces

```typescript
// packages/core/src/types/provider.ts

// ============================================================
// Messages
// ============================================================

export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** For role=tool: the tool call ID this is a response to */
  toolCallId?: string;
  /** For role=tool: the tool name */
  toolName?: string;
}

// ============================================================
// Tool Definitions (sent to provider)
// ============================================================

export interface ProviderToolDefinition {
  name: string;
  description?: string;
  /** JSON Schema for tool parameters */
  parameters?: Record<string, unknown>;
}

// ============================================================
// Tool Calls (returned from provider)
// ============================================================

export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ============================================================
// Provider Request
// ============================================================

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
  /** If true, force tool use (provider-dependent) */
  toolChoice?: "auto" | "required" | "none";
}

// ============================================================
// Provider Response
// ============================================================

export interface ProviderResponse {
  /** The text content of the response */
  text: string;
  /** Parsed tool calls, if any */
  toolCalls: ProviderToolCall[];
  /** Token usage for cost calculation */
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  /** Raw response for debugging/artifacts */
  raw: unknown;
  /** Latency from request start to response complete */
  latencyMs: number;
  /** Model as reported by the provider (may differ from request) */
  modelId: string;
  /** Provider-reported finish reason */
  finishReason: "stop" | "max_tokens" | "tool_calls" | "error" | "unknown";
}

// ============================================================
// Provider Errors
// ============================================================

export type ProviderErrorCode =
  | "AUTH_FAILED"        // Invalid or missing API key
  | "RATE_LIMITED"       // Provider rate limit hit
  | "TIMEOUT"            // Request timed out
  | "MODEL_NOT_FOUND"    // Invalid model name
  | "CONTEXT_LENGTH"     // Input too long
  | "CONTENT_FILTERED"   // Provider content filter triggered
  | "NETWORK_ERROR"      // Connection failed
  | "PROVIDER_ERROR"     // Other provider-side error
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

// ============================================================
// Provider Adapter Interface
// ============================================================

export interface ProviderAdapter {
  /** Provider identifier (e.g., "openai", "anthropic") */
  readonly name: string;

  /**
   * Initialize the adapter with config.
   * Called once during setup. Should validate the API key exists.
   * Throws ProviderError(AUTH_FAILED) if key is missing.
   */
  initialize(config: ProviderAdapterConfig): Promise<void>;

  /**
   * Send a completion request to the provider.
   * Handles retries internally for transient errors.
   */
  complete(request: ProviderRequest): Promise<ProviderResponse>;

  /**
   * Estimate cost in USD for a given usage.
   * Returns null if pricing is unknown for the model.
   */
  estimateCost(model: string, usage: ProviderResponse["usage"]): number | null;

  /**
   * Check if the adapter supports tool calling for the given model.
   */
  supportsTools(model: string): boolean;
}

export interface ProviderAdapterConfig {
  apiKeyEnv: string;
  baseUrl?: string;
  organization?: string;
  /** Request timeout in ms */
  timeoutMs: number;
  /** Max retries for transient errors */
  maxRetries: number;
}

// ============================================================
// Multi-turn Conversation Support (for agent testing)
// ============================================================

/**
 * Manages a multi-turn conversation with tool call simulation.
 * The engine uses this to:
 * 1. Send initial messages
 * 2. Receive response with tool calls
 * 3. Simulate tool responses
 * 4. Continue conversation until model produces final text output
 */
export interface ConversationTurn {
  request: ProviderRequest;
  response: ProviderResponse;
}

export interface ConversationResult {
  /** All turns in the conversation */
  turns: ConversationTurn[];
  /** Final text output (from the last turn) */
  finalText: string;
  /** All tool calls made across all turns */
  allToolCalls: ProviderToolCall[];
  /** Aggregated token usage */
  totalUsage: ProviderResponse["usage"];
  /** Total latency across all turns */
  totalLatencyMs: number;
}
```

---

## OpenAI Adapter

```typescript
// packages/core/src/providers/openai.ts

import type {
  ProviderAdapter,
  ProviderAdapterConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderToolCall,
  ProviderError,
} from "../types/provider";

// OpenAI pricing per 1M tokens (as of Feb 2026, approximate)
const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o":           { input: 2.50,  output: 10.00 },
  "gpt-4o-mini":      { input: 0.15,  output: 0.60 },
  "gpt-4-turbo":      { input: 10.00, output: 30.00 },
  "o3-mini":          { input: 1.10,  output: 4.40 },
};

export class OpenAIAdapter implements ProviderAdapter {
  readonly name = "openai";
  private apiKey: string = "";
  private baseUrl: string = "https://api.openai.com/v1";
  private config!: ProviderAdapterConfig;

  async initialize(config: ProviderAdapterConfig): Promise<void> {
    this.config = config;
    const key = process.env[config.apiKeyEnv];
    if (!key) {
      throw new ProviderError(
        "AUTH_FAILED",
        `Environment variable ${config.apiKeyEnv} is not set`
      );
    }
    this.apiKey = key;
    if (config.baseUrl) this.baseUrl = config.baseUrl;
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();

    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages.map((m) => this.formatMessage(m)),
      temperature: request.params.temperature,
      max_tokens: request.params.maxTokens,
    };

    if (request.params.topP !== undefined) body.top_p = request.params.topP;
    if (request.params.seed !== undefined) body.seed = request.params.seed;
    if (request.params.stopSequences) body.stop = request.params.stopSequences;

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
        body.tool_choice = request.toolChoice === "required" ? "required" : request.toolChoice;
      }
    }

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        ...(this.config.organization ? { "OpenAI-Organization": this.config.organization } : {}),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      throw this.mapError(response.status, data);
    }

    const choice = data.choices?.[0];
    const message = choice?.message;

    const toolCalls: ProviderToolCall[] = (message?.tool_calls ?? []).map(
      (tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments || "{}"),
      })
    );

    return {
      text: message?.content ?? "",
      toolCalls,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      raw: data,
      latencyMs,
      modelId: data.model ?? request.model,
      finishReason: this.mapFinishReason(choice?.finish_reason),
    };
  }

  estimateCost(model: string, usage: ProviderResponse["usage"]): number | null {
    const pricing = OPENAI_PRICING[model];
    if (!pricing) return null;
    return (
      (usage.inputTokens / 1_000_000) * pricing.input +
      (usage.outputTokens / 1_000_000) * pricing.output
    );
  }

  supportsTools(model: string): boolean {
    return !model.includes("o1-"); // o1 models don't support tools
  }

  // ... private helper methods: formatMessage, fetchWithRetry, mapError, mapFinishReason
}
```

---

## Anthropic Adapter

```typescript
// packages/core/src/providers/anthropic.ts

const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-5-20250929":    { input: 15.00, output: 75.00 },
  "claude-sonnet-4-5-20250929":  { input: 3.00,  output: 15.00 },
  "claude-haiku-4-5-20251001":   { input: 0.80,  output: 4.00 },
};

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = "anthropic";
  private apiKey: string = "";
  private baseUrl: string = "https://api.anthropic.com";
  private config!: ProviderAdapterConfig;

  async initialize(config: ProviderAdapterConfig): Promise<void> {
    this.config = config;
    const key = process.env[config.apiKeyEnv];
    if (!key) {
      throw new ProviderError(
        "AUTH_FAILED",
        `Environment variable ${config.apiKeyEnv} is not set`
      );
    }
    this.apiKey = key;
    if (config.baseUrl) this.baseUrl = config.baseUrl;
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const startTime = Date.now();

    // Anthropic separates system from messages
    const systemMessage = request.messages.find((m) => m.role === "system");
    const nonSystemMessages = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => this.formatMessage(m));

    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.params.maxTokens,
      messages: nonSystemMessages,
    };

    if (systemMessage) body.system = systemMessage.content;
    if (request.params.temperature !== undefined) body.temperature = request.params.temperature;
    if (request.params.topP !== undefined) body.top_p = request.params.topP;
    if (request.params.stopSequences) body.stop_sequences = request.params.stopSequences;

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        input_schema: t.parameters ?? { type: "object", properties: {} },
      }));
      if (request.toolChoice) {
        body.tool_choice = request.toolChoice === "required"
          ? { type: "any" }
          : { type: request.toolChoice };
      }
    }

    const response = await this.fetchWithRetry(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      throw this.mapError(response.status, data);
    }

    // Parse content blocks
    let text = "";
    const toolCalls: ProviderToolCall[] = [];

    for (const block of data.content ?? []) {
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

    return {
      text,
      toolCalls,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        totalTokens:
          (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
      raw: data,
      latencyMs,
      modelId: data.model ?? request.model,
      finishReason: this.mapFinishReason(data.stop_reason),
    };
  }

  estimateCost(model: string, usage: ProviderResponse["usage"]): number | null {
    // Normalize model name for pricing lookup
    const pricing = Object.entries(ANTHROPIC_PRICING).find(([key]) =>
      model.includes(key) || key.includes(model)
    );
    if (!pricing) return null;
    return (
      (usage.inputTokens / 1_000_000) * pricing[1].input +
      (usage.outputTokens / 1_000_000) * pricing[1].output
    );
  }

  supportsTools(_model: string): boolean {
    return true; // All Claude models support tools
  }

  // ... private helper methods
}
```

---

## Provider Registry

```typescript
// packages/core/src/providers/registry.ts

import type { ProviderAdapter, ProviderAdapterConfig } from "../types/provider";
import { OpenAIAdapter } from "./openai";
import { AnthropicAdapter } from "./anthropic";

type ProviderFactory = () => ProviderAdapter;

const builtinProviders: Record<string, ProviderFactory> = {
  openai: () => new OpenAIAdapter(),
  anthropic: () => new AnthropicAdapter(),
};

export class ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  /**
   * Register a custom provider adapter.
   * Called before initialize() to add non-builtin providers.
   */
  register(name: string, factory: ProviderFactory): void {
    builtinProviders[name] = factory;
  }

  /**
   * Initialize all providers referenced by models in the config.
   * Returns a map of provider name → initialized adapter.
   */
  async initializeAll(
    providers: Record<string, { apiKeyEnv: string; baseUrl?: string; organization?: string }>,
    options: { timeoutMs: number; maxRetries?: number }
  ): Promise<Map<string, ProviderAdapter>> {
    for (const [name, config] of Object.entries(providers)) {
      if (!config) continue;

      const factory = builtinProviders[name];
      if (!factory) {
        throw new Error(
          `Unknown provider "${name}". Available: ${Object.keys(builtinProviders).join(", ")}`
        );
      }

      const adapter = factory();
      await adapter.initialize({
        ...config,
        timeoutMs: options.timeoutMs,
        maxRetries: options.maxRetries ?? 2,
      });

      this.adapters.set(name, adapter);
    }

    return this.adapters;
  }

  get(name: string): ProviderAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) throw new Error(`Provider "${name}" not initialized`);
    return adapter;
  }
}
```

---

## Conversation Manager (Agent Testing)

```typescript
// packages/core/src/providers/conversation.ts

import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderMessage,
  ProviderToolCall,
  ConversationResult,
  ConversationTurn,
} from "../types/provider";
import type { ToolSimulation } from "../types/config";

const MAX_TURNS = 10; // Safety limit to prevent infinite loops

/**
 * Manages a multi-turn conversation for agent testing.
 * Runs the model, intercepts tool calls, simulates responses,
 * and continues until the model produces a final text response.
 */
export async function runConversation(
  adapter: ProviderAdapter,
  initialRequest: ProviderRequest,
  toolSimulations: ToolSimulation[],
): Promise<ConversationResult> {
  const turns: ConversationTurn[] = [];
  const allToolCalls: ProviderToolCall[] = [];
  let messages: ProviderMessage[] = [...initialRequest.messages];
  let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let totalLatencyMs = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
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

    // If no tool calls, conversation is complete
    if (response.toolCalls.length === 0) {
      return {
        turns,
        finalText: response.text,
        allToolCalls,
        totalUsage,
        totalLatencyMs,
      };
    }

    // Process tool calls
    allToolCalls.push(...response.toolCalls);

    // Add assistant message with tool calls
    messages = [
      ...messages,
      { role: "assistant", content: response.text },
    ];

    // Simulate tool responses
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

  // Hit max turns
  const lastResponse = turns[turns.length - 1].response;
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
  // Check conditional responses
  if (simulation.responses) {
    for (const resp of simulation.responses) {
      if (matchArgs(resp.when, args)) {
        return resp.then;
      }
    }
  }

  // Fall back to default
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
```

---

## Extensibility

To add a new provider, implement `ProviderAdapter` and register it:

```typescript
import { ProviderRegistry } from "@kindlm/core";
import { MyCustomAdapter } from "./my-adapter";

const registry = new ProviderRegistry();
registry.register("my-provider", () => new MyCustomAdapter());
```

The custom provider must:
1. Implement all methods of `ProviderAdapter`
2. Map its API responses to `ProviderResponse`
3. Map errors to `ProviderError` with appropriate codes
4. Handle retries for transient errors internally
