import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { authRoutes } from "./auth.js";
import { mockOrg, mockToken, testRequest } from "../test-helpers.js";

// Mock the queries module
vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

// Mock hashToken from auth middleware
vi.mock("../middleware/auth.js", () => ({
  hashToken: vi.fn().mockResolvedValue("mocked-hash"),
  authMiddleware: vi.fn(),
}));

import { getQueries } from "../db/queries.js";

const org = mockOrg();
const token = mockToken();

function createApp() {
  const app = new Hono<AppEnv>();
  // Pre-set auth context (bypass auth middleware for route tests)
  app.use("*", async (c, next) => {
    c.set("auth", { org, token });
    return next();
  });
  app.route("/v1/auth", authRoutes);
  return app;
}

describe("auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /tokens creates token and returns plaintext", async () => {
    const createdToken = mockToken({ id: "new-tok", name: "new-token" });
    vi.mocked(getQueries).mockReturnValue({
      createToken: vi.fn().mockResolvedValue(createdToken),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "new-token", scope: "ci" }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.token).toMatch(/^klm_/);
    expect(body.name).toBe("new-token");
    expect(body.id).toBe("new-tok");
  });

  it("GET /tokens lists tokens without hash", async () => {
    vi.mocked(getQueries).mockReturnValue({
      listTokens: vi.fn().mockResolvedValue([token]),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens");

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    const tokens = body.tokens as Record<string, unknown>[];
    expect(tokens).toHaveLength(1);
    const first = tokens[0];
    expect(first).toBeDefined();
    expect((first as Record<string, unknown>).tokenHash).toBeUndefined();
    expect((first as Record<string, unknown>).id).toBe("tok-1");
  });

  it("DELETE /tokens/:id revokes token", async () => {
    vi.mocked(getQueries).mockReturnValue({
      revokeToken: vi.fn().mockResolvedValue(true),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/tok-1", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  it("DELETE /tokens/:id returns 404 for non-existent token", async () => {
    vi.mocked(getQueries).mockReturnValue({
      revokeToken: vi.fn().mockResolvedValue(false),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/nonexistent", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});
