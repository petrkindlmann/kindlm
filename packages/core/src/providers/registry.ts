import type { HttpClient, ProviderAdapter } from "./interface.js";
import { createOpenAIAdapter } from "./openai.js";
import { createAnthropicAdapter } from "./anthropic.js";

export function createProvider(
  name: "openai" | "anthropic",
  httpClient: HttpClient,
): ProviderAdapter {
  switch (name) {
    case "openai":
      return createOpenAIAdapter(httpClient);
    case "anthropic":
      return createAnthropicAdapter(httpClient);
    default: {
      const exhaustive: never = name;
      throw new Error(`Unknown provider: ${String(exhaustive)}`);
    }
  }
}
