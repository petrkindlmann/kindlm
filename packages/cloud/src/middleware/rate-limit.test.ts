import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { rateLimitMiddleware } from "./rate-limit.js";
import { mockOrg, mockToken, testRequest, createMockD1 } from "../test-helpers.js";

vi.mock("./plan-gate.js", () => ({
  getLimits: vi.fn().mockReturnValue({
    projects: 5,
    members: 10,
    retentionDays: 90,
    rateLimit: 3, // Low limit for testing
  }),
}));

function createApp(db: unknown) {
  const app = new Hono<AppEnv>();
  const org = mockOrg();
  const token = mockToken();

  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    (c.env as unknown as Record<string, unknown>).DB = db;
    return next();
  });
  app.use("*", rateLimitMiddleware);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

describe("rateLimitMiddleware (D1-based)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows first request and inserts rate limit row", async () => {
    const mockD1 = createMockD1();
    // First SELECT returns null (no existing entry)
    mockD1._configureResponse("SELECT count", { first: null });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(200);
  });

  it("allows requests within rate limit", async () => {
    const mockD1 = createMockD1();
    // Return existing entry with count under limit
    mockD1._configureResponse("SELECT count", {
      first: { count: 1, window_start: new Date().toISOString() },
    });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const mockD1 = createMockD1();
    // Return existing entry at limit
    mockD1._configureResponse("SELECT count", {
      first: { count: 3, window_start: new Date().toISOString() },
    });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Rate limit");
  });

  it("resets window when expired", async () => {
    const mockD1 = createMockD1();
    // Return entry with old window (2 minutes ago)
    const oldTime = new Date(Date.now() - 120_000).toISOString();
    mockD1._configureResponse("SELECT count", {
      first: { count: 100, window_start: oldTime },
    });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(200);
  });

  it("fails open when D1 query errors", async () => {
    const mockD1 = createMockD1();
    // Make prepare throw
    mockD1.prepare = vi.fn(() => {
      throw new Error("D1 unavailable");
    });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(200);
  });

  it("passes through when no auth context", async () => {
    const app = new Hono<AppEnv>();
    // No auth middleware — auth is undefined
    app.use("*", rateLimitMiddleware);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await testRequest(app, "/test");
    expect(res.status).toBe(200);
  });
});
