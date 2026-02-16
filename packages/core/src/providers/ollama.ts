import type { ProviderAdapter, ProviderAdapterConfig, ProviderRequest, ProviderResponse } from "./interface.js";

export function createOllamaAdapter(): ProviderAdapter {
  return {
    name: "ollama",
    initialize(_config: ProviderAdapterConfig): Promise<void> {
      throw new Error("Not implemented");
    },
    complete(_request: ProviderRequest): Promise<ProviderResponse> {
      throw new Error("Not implemented");
    },
    estimateCost(_model: string, _usage: ProviderResponse["usage"]): number | null {
      return null;
    },
    supportsTools(_model: string): boolean {
      throw new Error("Not implemented");
    },
  };
}
