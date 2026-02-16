import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispatchWebhooks } from "./dispatch.js";
import type { Webhook, Run } from "../types.js";

const originalFetch = globalThis.fetch;

const webhook: Webhook = {
  id: "wh-1",
  orgId: "org-1",
  url: "https://example.com/webhook",
  events: ["run.completed"],
  secret: "test-secret",
  active: true,
  createdAt: "2025-01-01T00:00:00.000Z",
};

const run: Run = {
  id: "run-1",
  projectId: "proj-1",
  suiteId: "suite-1",
  status: "completed",
  commitSha: "abc",
  branch: "main",
  environment: null,
  triggeredBy: null,
  passRate: 0.95,
  driftScore: null,
  schemaFailCount: 0,
  piiFailCount: 0,
  keywordFailCount: 0,
  judgeAvgScore: null,
  costEstimateUsd: null,
  latencyAvgMs: null,
  testCount: 5,
  modelCount: 1,
  gatePassed: null,
  startedAt: "2025-01-01T00:00:00.000Z",
  finishedAt: "2025-01-01T00:00:01.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("dispatchWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends webhook with correct headers and body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    globalThis.fetch = mockFetch;

    await dispatchWebhooks([webhook], "run.completed", run);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/webhook");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-KindLM-Event"]).toBe("run.completed");
    expect(headers["X-KindLM-Signature"]).toBeDefined();

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.event).toBe("run.completed");
    expect(body.data).toBeDefined();
  });

  it("retries once on failure then gives up", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    globalThis.fetch = mockFetch;

    // Should not throw
    await dispatchWebhooks([webhook], "run.completed", run);

    // 2 attempts (initial + 1 retry)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles fetch throwing (network error)", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    globalThis.fetch = mockFetch;

    // Should not throw
    await dispatchWebhooks([webhook], "run.completed", run);

    // 2 attempts
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("dispatches to multiple webhooks independently", async () => {
    const webhook2 = { ...webhook, id: "wh-2", url: "https://other.com/hook" };
    const callsByUrl: Record<string, number> = {};
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      callsByUrl[url] = (callsByUrl[url] ?? 0) + 1;
      if (url === "https://example.com/webhook") {
        // First webhook always fails
        return Promise.resolve({ ok: false, status: 500 });
      }
      // Second webhook succeeds
      return Promise.resolve({ ok: true, status: 200 });
    });
    globalThis.fetch = mockFetch;

    await dispatchWebhooks([webhook, webhook2], "run.completed", run);

    // webhook1: 2 attempts (initial + retry, both fail)
    expect(callsByUrl["https://example.com/webhook"]).toBe(2);
    // webhook2: 1 attempt (success)
    expect(callsByUrl["https://other.com/hook"]).toBe(1);
  });

  it("does not throw when AbortSignal.timeout is used", async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      return Promise.reject(new DOMException("The operation was aborted", "AbortError"));
    });
    globalThis.fetch = mockFetch;

    // Should not throw
    await dispatchWebhooks([webhook], "run.completed", run);
  });
});
