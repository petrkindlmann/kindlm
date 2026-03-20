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
    // After atomic upsert, SELECT returns count=1 (new entry)
    mockD1._configureResponse("SELECT count FROM rate_limits", { first: { count: 1 } });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(200);
  });

  it("allows requests within rate limit", async () => {
    const mockD1 = createMockD1();
    // After atomic upsert, SELECT returns count under limit
    mockD1._configureResponse("SELECT count FROM rate_limits", { first: { count: 2 } });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(200);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const mockD1 = createMockD1();
    // After atomic upsert, SELECT returns count over limit (limit=3)
    mockD1._configureResponse("SELECT count FROM rate_limits", { first: { count: 4 } });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Rate limit");
  });

  it("resets window when expired (atomic upsert handles it)", async () => {
    const mockD1 = createMockD1();
    // Atomic upsert resets count when window changes, SELECT returns count=1
    mockD1._configureResponse("SELECT count FROM rate_limits", { first: { count: 1 } });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(200);
  });

  it("fails closed when D1 query errors", async () => {
    const mockD1 = createMockD1();
    // Make prepare throw
    mockD1.prepare = vi.fn(() => {
      throw new Error("D1 unavailable");
    });

    const app = createApp(mockD1);
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(503);
  });

  it("rate-limits unauthenticated requests by IP", async () => {
    const mockD1 = createMockD1();
    // After atomic upsert, SELECT returns count=1 (under the 30/min unauthenticated limit)
    mockD1._configureResponse("SELECT count FROM rate_limits", { first: { count: 1 } });

    const app = new Hono<AppEnv>();
    // No auth middleware — auth is undefined, but DB is available
    app.use("*", async (c, next) => {
      (c.env as unknown as Record<string, unknown>).DB = mockD1;
      return next();
    });
    app.use("*", rateLimitMiddleware);
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await testRequest(app, "/test");
    expect(res.status).toBe(200);
  });
});
