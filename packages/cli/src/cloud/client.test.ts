import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCloudClient, getCloudUrl, CloudApiError } from "./client.js";

describe("CloudClient", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  it("GET adds Bearer header", async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedInit = init;
      return new Response(JSON.stringify({ data: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test123");
    await client.get("/v1/projects");

    expect(capturedInit?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer klm_test123" }),
    );
  });

  it("POST sends JSON body", async () => {
    let capturedBody: string | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ id: "p1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");
    await client.post("/v1/projects", { name: "my-project" });

    expect(JSON.parse(capturedBody ?? "")).toEqual({ name: "my-project" });
  });

  it("throws CloudApiError on 4xx/5xx", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");

    await expect(client.get("/v1/projects/missing")).rejects.toThrow(CloudApiError);
    await expect(client.get("/v1/projects/missing")).rejects.toMatchObject({
      status: 404,
      message: "Not found",
    });
  });

  it("getCloudUrl uses env var or default", () => {
    delete process.env["KINDLM_CLOUD_URL"];
    expect(getCloudUrl()).toBe("https://api.kindlm.com");

    process.env["KINDLM_CLOUD_URL"] = "http://localhost:8787";
    expect(getCloudUrl()).toBe("http://localhost:8787");
  });

  it("getCloudUrl rejects non-localhost HTTP", () => {
    process.env["KINDLM_CLOUD_URL"] = "http://evil.example.com";
    expect(() => getCloudUrl()).toThrow("Refusing to use insecure HTTP");
  });

  it("GET does not send Content-Type header", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");
    await client.get("/v1/projects");

    expect(capturedHeaders?.["Content-Type"]).toBeUndefined();
  });

  it("retries once on 5xx then succeeds", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Internal Server Error", { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");
    const result = await client.get<{ ok: boolean }>("/v1/projects");
    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  it("retries once on network error then succeeds", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("ECONNRESET");
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");
    const result = await client.get<{ ok: boolean }>("/v1/projects");
    expect(result.ok).toBe(true);
    expect(callCount).toBe(2);
  });

  it("throws after exhausting retries on 5xx", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Bad Gateway", { status: 502 });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");
    await expect(client.get("/v1/projects")).rejects.toThrow(CloudApiError);
    await expect(client.get("/v1/projects")).rejects.toMatchObject({
      status: 502,
    });
  });

  it("rejects non-JSON content-type on success response", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("<html>502 Bad Gateway</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");
    await expect(client.get("/v1/projects")).rejects.toThrow(
      "Expected JSON response",
    );
  });

  it("extracts error from JSON body on error response", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");
    await expect(client.get("/v1/projects/missing")).rejects.toMatchObject({
      status: 404,
      message: "Project not found",
    });
  });

  it("handles error response with non-JSON content-type gracefully", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response("Internal Server Error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");
    // Should retry then throw — but message is the generic HTTP status
    await expect(client.get("/v1/projects")).rejects.toMatchObject({
      status: 500,
      message: "HTTP 500",
    });
  });

  it("returns undefined for 204 No Content", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    const client = createCloudClient("https://api.example.com", "klm_test");
    const result = await client.delete("/v1/projects/p1");
    expect(result).toBeUndefined();
  });
});
