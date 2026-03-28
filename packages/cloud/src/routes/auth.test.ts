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
    c.set("auth", { org, token, user: null });
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
      getOrgTokenTtl: vi.fn().mockResolvedValue(null),
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

describe("auth routes — token rotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /tokens/:id/rotate creates new token and revokes old", async () => {
    const existing = mockToken({ id: "tok-old", name: "old-token", scope: "full" });
    const created = mockToken({ id: "tok-new", name: "old-token" });
    const mockQueries = {
      getTokenById: vi.fn().mockResolvedValue(existing),
      revokeToken: vi.fn().mockResolvedValue(true),
      createToken: vi.fn().mockResolvedValue(created),
      getOrgTokenTtl: vi.fn().mockResolvedValue(null),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/tok-old/rotate", {
      method: "POST",
    });

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.token).toMatch(/^klm_/);
    expect(body.previousTokenId).toBe("tok-old");
    expect(body.id).toBe("tok-new");
    expect(mockQueries.revokeToken).toHaveBeenCalledWith("tok-old", org.id);
    expect(mockQueries.createToken).toHaveBeenCalled();
  });

  it("POST /tokens/:id/rotate returns 404 for missing token", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getTokenById: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/tok-missing/rotate", {
      method: "POST",
    });

    expect(res.status).toBe(404);
  });

  it("POST /tokens/:id/rotate preserves scope and projectId", async () => {
    const existing = mockToken({ id: "tok-old", scope: "ci", projectId: "proj-1" });
    const created = mockToken({ id: "tok-new" });
    const mockQueries = {
      getTokenById: vi.fn().mockResolvedValue(existing),
      revokeToken: vi.fn().mockResolvedValue(true),
      createToken: vi.fn().mockResolvedValue(created),
      getOrgTokenTtl: vi.fn().mockResolvedValue(null),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    await testRequest(app, "/v1/auth/tokens/tok-old/rotate", { method: "POST" });

    expect(mockQueries.createToken).toHaveBeenCalledWith(
      org.id,
      existing.name,
      "mocked-hash",
      "ci",
      "proj-1",
      null,
      null,
    );
  });

  it("POST /tokens/:id/rotate applies org TTL when original had no expiry", async () => {
    const existing = mockToken({ id: "tok-old", expiresAt: null });
    const created = mockToken({ id: "tok-new" });
    const mockQueries = {
      getTokenById: vi.fn().mockResolvedValue(existing),
      revokeToken: vi.fn().mockResolvedValue(true),
      createToken: vi.fn().mockResolvedValue(created),
      getOrgTokenTtl: vi.fn().mockResolvedValue(24),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    await testRequest(app, "/v1/auth/tokens/tok-old/rotate", { method: "POST" });

    const callArgs = mockQueries.createToken.mock.calls[0] as unknown[];
    // expiresAt (6th arg, index 5) should be an ISO string
    expect(callArgs[5]).not.toBeNull();
    expect(typeof callArgs[5]).toBe("string");
  });
});

describe("auth routes — token refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /tokens/refresh revokes current and issues replacement", async () => {
    const created = mockToken({ id: "tok-refreshed" });
    const mockQueries = {
      revokeToken: vi.fn().mockResolvedValue(true),
      createToken: vi.fn().mockResolvedValue(created),
      getOrgTokenTtl: vi.fn().mockResolvedValue(null),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/refresh", { method: "POST" });

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBe("tok-refreshed");
    expect(body.previousTokenId).toBe(token.id);
    expect(body.token).toMatch(/^klm_/);
    expect(mockQueries.revokeToken).toHaveBeenCalledWith(token.id, org.id);
  });

  it("POST /tokens/refresh applies org TTL when no expiry on current token", async () => {
    const created = mockToken({ id: "tok-refreshed" });
    const mockQueries = {
      revokeToken: vi.fn().mockResolvedValue(true),
      createToken: vi.fn().mockResolvedValue(created),
      getOrgTokenTtl: vi.fn().mockResolvedValue(48),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    await testRequest(app, "/v1/auth/tokens/refresh", { method: "POST" });

    const callArgs = mockQueries.createToken.mock.calls[0] as unknown[];
    expect(callArgs[5]).not.toBeNull();
    expect(typeof callArgs[5]).toBe("string");
  });
});

describe("auth routes — token settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /tokens/settings returns current TTL", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getOrgTokenTtl: vi.fn().mockResolvedValue(24),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/settings");

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.tokenDefaultTtlHours).toBe(24);
  });

  it("GET /tokens/settings returns null when not set", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getOrgTokenTtl: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/settings");

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.tokenDefaultTtlHours).toBeNull();
  });

  it("PUT /tokens/settings updates TTL", async () => {
    const mockQueries = {
      updateOrgTokenTtl: vi.fn().mockResolvedValue(true),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenDefaultTtlHours: 72 }),
    });

    expect(res.status).toBe(200);
    expect(mockQueries.updateOrgTokenTtl).toHaveBeenCalledWith(org.id, 72);
  });

  it("PUT /tokens/settings accepts null to clear TTL", async () => {
    const mockQueries = {
      updateOrgTokenTtl: vi.fn().mockResolvedValue(true),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenDefaultTtlHours: null }),
    });

    expect(res.status).toBe(200);
    expect(mockQueries.updateOrgTokenTtl).toHaveBeenCalledWith(org.id, null);
  });

  it("PUT /tokens/settings rejects TTL of 0", async () => {
    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenDefaultTtlHours: 0 }),
    });

    expect(res.status).toBe(400);
  });

  it("PUT /tokens/settings rejects TTL over 8760", async () => {
    const app = createApp();
    const res = await testRequest(app, "/v1/auth/tokens/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenDefaultTtlHours: 9000 }),
    });

    expect(res.status).toBe(400);
  });
});

describe("auth routes — token creation with org TTL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /tokens applies org default TTL when no expiresAt provided", async () => {
    const created = mockToken({ id: "new-tok" });
    const mockQueries = {
      createToken: vi.fn().mockResolvedValue(created),
      getOrgTokenTtl: vi.fn().mockResolvedValue(24),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    await testRequest(app, "/v1/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ci-token" }),
    });

    const callArgs = mockQueries.createToken.mock.calls[0] as unknown[];
    // expiresAt (6th arg, index 5) should be a non-null ISO string
    expect(callArgs[5]).not.toBeNull();
    expect(typeof callArgs[5]).toBe("string");
  });

  it("POST /tokens skips org TTL when explicit expiresAt is provided", async () => {
    const created = mockToken({ id: "new-tok" });
    const mockQueries = {
      createToken: vi.fn().mockResolvedValue(created),
      getOrgTokenTtl: vi.fn().mockResolvedValue(24),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    await testRequest(app, "/v1/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ci-token", expiresAt: "2027-01-01T00:00:00Z" }),
    });

    const callArgs = mockQueries.createToken.mock.calls[0] as unknown[];
    expect(callArgs[5]).toBe("2027-01-01T00:00:00Z");
  });

  it("POST /tokens creates without expiry when no org TTL set", async () => {
    const created = mockToken({ id: "new-tok" });
    const mockQueries = {
      createToken: vi.fn().mockResolvedValue(created),
      getOrgTokenTtl: vi.fn().mockResolvedValue(null),
      logAudit: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(getQueries).mockReturnValue(mockQueries as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    await testRequest(app, "/v1/auth/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "ci-token" }),
    });

    const callArgs = mockQueries.createToken.mock.calls[0] as unknown[];
    expect(callArgs[5]).toBeNull();
  });
});
