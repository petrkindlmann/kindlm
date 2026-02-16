import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHttpClient } from "./http.js";

describe("createHttpClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("passes correct method and headers to fetch", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const client = createHttpClient();
    await client.fetch("https://api.openai.com/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer sk-test" },
      body: JSON.stringify({ model: "gpt-4o" }),
    });

    expect(capturedUrl).toBe("https://api.openai.com/v1/chat");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer sk-test");
  });

  it("returns response body via json()", async () => {
    const responseData = { choices: [{ message: { content: "Hello" } }] };
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify(responseData), { status: 200 });
    }) as typeof fetch;

    const client = createHttpClient();
    const response = await client.fetch("https://api.example.com/v1/test", {
      method: "GET",
      headers: {},
      body: "",
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(responseData);
  });

  it("reports non-ok status correctly", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "rate limited" }), { status: 429 });
    }) as typeof fetch;

    const client = createHttpClient();
    const response = await client.fetch("https://api.example.com/v1/test", {
      method: "POST",
      headers: {},
      body: "{}",
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(429);
  });

  it("passes signal for timeout via AbortController", async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const client = createHttpClient();
    await client.fetch("https://api.example.com/v1/test", {
      method: "GET",
      headers: {},
      body: "",
      timeoutMs: 5000,
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);
  });

  it("always passes an AbortController signal but only sets timeout when timeoutMs is provided", async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const client = createHttpClient();
    await client.fetch("https://api.example.com/v1/test", {
      method: "GET",
      headers: {},
      body: "",
    });

    // Signal is always present (AbortController is always created)
    // but it should not be aborted since no timeout was set
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);
  });
});
