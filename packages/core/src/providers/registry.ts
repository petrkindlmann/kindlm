import type { HttpClient, ProviderAdapter } from "./interface.js";
import type { HttpProviderConfig } from "./http.js";
import type { McpProviderConfig } from "./mcp.js";
import { createOpenAIAdapter } from "./openai.js";
import { createAnthropicAdapter } from "./anthropic.js";
import { createOllamaAdapter } from "./ollama.js";
import { createGeminiAdapter } from "./gemini.js";
import { createMistralAdapter } from "./mistral.js";
import { createCohereAdapter } from "./cohere.js";
import { createHttpProviderAdapter } from "./http.js";
import { createMcpAdapter } from "./mcp.js";

const PROVIDER_FACTORIES: Record<string, (httpClient: HttpClient) => ProviderAdapter> = {
  openai: createOpenAIAdapter,
  anthropic: createAnthropicAdapter,
  ollama: createOllamaAdapter,
  gemini: createGeminiAdapter,
  mistral: createMistralAdapter,
  cohere: createCohereAdapter,
};

export interface CreateProviderOptions {
  httpConfig?: HttpProviderConfig;
  mcpConfig?: McpProviderConfig;
  envLookup?: (name: string) => string | undefined;
}

export function createProvider(
  name: string,
  httpClient: HttpClient,
  options?: CreateProviderOptions,
): ProviderAdapter {
  // HTTP provider requires special handling — needs httpConfig + envLookup
  if (name === "http") {
    if (!options?.httpConfig) {
      throw new Error('HTTP provider requires httpConfig in options');
    }
    const envLookup = options.envLookup ?? (() => undefined);
    return createHttpProviderAdapter(httpClient, options.httpConfig, envLookup);
  }

  // MCP provider requires special handling — needs mcpConfig
  if (name === "mcp") {
    if (!options?.mcpConfig) {
      throw new Error("MCP provider requires mcpConfig in options");
    }
    return createMcpAdapter(httpClient, options.mcpConfig);
  }

  const factory = PROVIDER_FACTORIES[name];
  if (!factory) {
    const supported = [...Object.keys(PROVIDER_FACTORIES), "http", "mcp"].join(", ");
    throw new Error(`Unknown provider: "${name}". Supported providers: ${supported}`);
  }
  return factory(httpClient);
}
