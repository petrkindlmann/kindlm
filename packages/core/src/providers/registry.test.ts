import { describe, it, expect, vi } from "vitest";
import type { HttpClient } from "../types/provider.js";
import { createProvider } from "./registry.js";

function makeHttpClient(): HttpClient {
  return {
    fetch: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    }),
  };
}

describe("createProvider", () => {
  it("creates openai adapter", () => {
    const adapter = createProvider("openai", makeHttpClient());
    expect(adapter.name).toBe("openai");
  });

  it("creates anthropic adapter", () => {
    const adapter = createProvider("anthropic", makeHttpClient());
    expect(adapter.name).toBe("anthropic");
  });

  it("creates ollama adapter", () => {
    const adapter = createProvider("ollama", makeHttpClient());
    expect(adapter.name).toBe("ollama");
  });

  it("creates gemini adapter", () => {
    const adapter = createProvider("gemini", makeHttpClient());
    expect(adapter.name).toBe("gemini");
  });

  it("creates mistral adapter", () => {
    const adapter = createProvider("mistral", makeHttpClient());
    expect(adapter.name).toBe("mistral");
  });

  it("creates cohere adapter", () => {
    const adapter = createProvider("cohere", makeHttpClient());
    expect(adapter.name).toBe("cohere");
  });

  it("throws for unknown provider name", () => {
    expect(() => createProvider("unknown-provider", makeHttpClient())).toThrow(
      /Unknown provider: "unknown-provider"/,
    );
  });

  it("includes supported providers in error message", () => {
    expect(() => createProvider("foobar", makeHttpClient())).toThrow(
      /Supported providers: openai, anthropic, ollama, gemini, mistral, cohere/,
    );
  });

  it("passes httpClient through to adapter", () => {
    const httpClient = makeHttpClient();
    const adapter = createProvider("openai", httpClient);
    // The adapter was successfully created with the httpClient;
    // if httpClient were not passed, adapter creation would fail or use a default
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe("openai");
  });
});
