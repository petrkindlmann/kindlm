import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { authMiddleware } from "./auth.js";
import { mockOrg, mockToken, testRequest } from "../test-helpers.js";

// Mock the queries module
vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(() => ({
    getTokenByHash: vi.fn(),
    getOrg: vi.fn(),
    updateTokenLastUsed: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { getQueries } from "../db/queries.js";

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", authMiddleware);
  app.get("/test", (c) => {
    const auth = c.get("auth");
    return c.json({ orgId: auth.org.id });
  });
  app.post("/test", (c) => c.json({ ok: true }));
  return app;
}

function mockQueriesImpl(overrides: {
  getTokenByHash?: ReturnType<typeof vi.fn>;
  getOrg?: ReturnType<typeof vi.fn>;
}) {
  const mocked = vi.mocked(getQueries);
  mocked.mockReturnValue({
    getTokenByHash: overrides.getTokenByHash ?? vi.fn().mockResolvedValue(null),
    getOrg: overrides.getOrg ?? vi.fn().mockResolvedValue(null),
    updateTokenLastUsed: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof getQueries>);
}

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for missing Authorization header", async () => {
    mockQueriesImpl({});
    const app = createApp();
    const res = await testRequest(app, "/test");
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toMatch(/Missing Authorization/);
  });

  it("returns 401 for invalid token format (no klm_ prefix)", async () => {
    mockQueriesImpl({});
    const app = createApp();
    const res = await testRequest(app, "/test", {
      headers: { Authorization: "Bearer invalid_token" },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toMatch(/Invalid token format/);
  });

  it("returns 401 when token not found in DB", async () => {
    mockQueriesImpl({
      getTokenByHash: vi.fn().mockResolvedValue(null),
    });
    const app = createApp();
    const res = await testRequest(app, "/test", {
      headers: { Authorization: "Bearer klm_0123456789abcdef0123456789abcdef" },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toMatch(/Invalid or expired/);
  });

  it("returns 403 for readonly token on non-GET request", async () => {
    const token = mockToken({ scope: "readonly" });
    const org = mockOrg();
    mockQueriesImpl({
      getTokenByHash: vi.fn().mockResolvedValue(token),
      getOrg: vi.fn().mockResolvedValue(org),
    });

    const app = createApp();
    const res = await testRequest(app, "/test", {
      method: "POST",
      headers: { Authorization: "Bearer klm_0123456789abcdef0123456789abcdef" },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toMatch(/Readonly/);
  });

  it("sets auth context for valid token", async () => {
    const token = mockToken();
    const org = mockOrg();
    mockQueriesImpl({
      getTokenByHash: vi.fn().mockResolvedValue(token),
      getOrg: vi.fn().mockResolvedValue(org),
    });
    const app = createApp();
    const res = await testRequest(app, "/test", {
      headers: { Authorization: "Bearer klm_0123456789abcdef0123456789abcdef" },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.orgId).toBe("org-1");
  });
});
