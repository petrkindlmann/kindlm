import type { HttpClient, ProviderAdapter } from "./interface.js";
import { createOpenAIAdapter } from "./openai.js";
import { createAnthropicAdapter } from "./anthropic.js";
import { createOllamaAdapter } from "./ollama.js";
import { createGeminiAdapter } from "./gemini.js";
import { createMistralAdapter } from "./mistral.js";
import { createCohereAdapter } from "./cohere.js";

const PROVIDER_FACTORIES: Record<string, (httpClient: HttpClient) => ProviderAdapter> = {
  openai: createOpenAIAdapter,
  anthropic: createAnthropicAdapter,
  ollama: createOllamaAdapter,
  gemini: createGeminiAdapter,
  mistral: createMistralAdapter,
  cohere: createCohereAdapter,
};

export function createProvider(
  name: string,
  httpClient: HttpClient,
): ProviderAdapter {
  const factory = PROVIDER_FACTORIES[name];
  if (!factory) {
    const supported = Object.keys(PROVIDER_FACTORIES).join(", ");
    throw new Error(`Unknown provider: "${name}". Supported providers: ${supported}`);
  }
  return factory(httpClient);
}
