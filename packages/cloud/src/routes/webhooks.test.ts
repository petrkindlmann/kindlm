import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Webhook } from "../types.js";
import { webhookRoutes } from "./webhooks.js";
import { mockOrg, mockToken, testRequest } from "../test-helpers.js";

vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

import { getQueries } from "../db/queries.js";

const org = mockOrg({ plan: "team" });
const token = mockToken();

const sampleWebhook: Webhook = {
  id: "wh-1",
  orgId: "org-1",
  url: "https://example.com/webhook",
  events: ["run.completed"],
  secret: "abcdef12-3456-7890-abcd-ef1234567890",
  active: true,
  createdAt: "2025-01-01T00:00:00.000Z",
};

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/webhooks", webhookRoutes);
  return app;
}

describe("webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST / creates webhook with valid HTTPS url", async () => {
    vi.mocked(getQueries).mockReturnValue({
      createWebhook: vi.fn().mockResolvedValue(sampleWebhook),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/webhook",
        events: ["run.completed"],
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.url).toBe("https://example.com/webhook");
  });

  it("POST / rejects non-HTTPS url", async () => {
    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "http://example.com/webhook",
        events: ["run.completed"],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toMatch(/HTTPS/);
  });

  it("POST / rejects invalid events", async () => {
    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://example.com/webhook",
        events: ["invalid.event"],
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toMatch(/Invalid enum value|Invalid events/);
  });

  it("GET / lists webhooks with masked secrets", async () => {
    vi.mocked(getQueries).mockReturnValue({
      listWebhooks: vi.fn().mockResolvedValue([sampleWebhook]),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { webhooks: Array<{ secret: string }> };
    expect(body.webhooks).toHaveLength(1);
    const first = body.webhooks[0] as { secret: string } | undefined;
    expect(first?.secret).toContain("...");
    expect(first?.secret).not.toBe(sampleWebhook.secret);
  });

  it("DELETE /:id deletes webhook", async () => {
    vi.mocked(getQueries).mockReturnValue({
      deleteWebhook: vi.fn().mockResolvedValue(true),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks/wh-1", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  it("DELETE /:id returns 404 for non-existent webhook", async () => {
    vi.mocked(getQueries).mockReturnValue({
      deleteWebhook: vi.fn().mockResolvedValue(false),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks/wh-999", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  it("PATCH /:id updates webhook URL", async () => {
    const updated = { ...sampleWebhook, url: "https://new.example.com/hook" };
    vi.mocked(getQueries).mockReturnValue({
      updateWebhook: vi.fn().mockResolvedValue(updated),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks/wh-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://new.example.com/hook" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.url).toBe("https://new.example.com/hook");
  });

  it("PATCH /:id updates webhook events", async () => {
    const updated = { ...sampleWebhook, events: ["run.completed", "run.failed"] };
    vi.mocked(getQueries).mockReturnValue({
      updateWebhook: vi.fn().mockResolvedValue(updated),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks/wh-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: ["run.completed", "run.failed"] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: string[] };
    expect(body.events).toEqual(["run.completed", "run.failed"]);
  });

  it("PATCH /:id updates webhook active status", async () => {
    const updated = { ...sampleWebhook, active: false };
    vi.mocked(getQueries).mockReturnValue({
      updateWebhook: vi.fn().mockResolvedValue(updated),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks/wh-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.active).toBe(false);
  });

  it("PATCH /:id rejects non-HTTPS url", async () => {
    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks/wh-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://example.com/hook" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toMatch(/HTTPS/);
  });

  it("PATCH /:id returns 404 for non-existent webhook", async () => {
    vi.mocked(getQueries).mockReturnValue({
      updateWebhook: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks/wh-999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://new.example.com/hook" }),
    });

    expect(res.status).toBe(404);
  });

  it("PATCH /:id returns 400 when no fields provided", async () => {
    const app = createApp();
    const res = await testRequest(app, "/v1/webhooks/wh-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });
});
