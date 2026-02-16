import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Plan } from "../types.js";
import { complianceRoutes } from "./compliance.js";
import { testEnv, testExecutionCtx } from "../test-helpers.js";

function createMockApp(plan: Plan = "enterprise") {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", {
      org: { id: "org-1", name: "Test Org", plan, createdAt: "", updatedAt: "" },
      token: { id: "tok-1", orgId: "org-1", name: "test", tokenHash: "", scope: "full" as const, projectId: null, expiresAt: null, lastUsed: null, createdAt: "", revokedAt: null },
    });
    await next();
  });
  app.route("/v1/compliance", complianceRoutes);
  return app;
}

function req(app: Hono<AppEnv>, url: string, init?: RequestInit) {
  return app.request(url, init, testEnv, testExecutionCtx);
}

const mockGetSigningKey = vi.fn().mockResolvedValue(null);
const mockCreateSigningKey = vi.fn().mockResolvedValue(undefined);
const mockLogAudit = vi.fn().mockResolvedValue(undefined);

vi.mock("../db/queries.js", () => ({
  getQueries: () => ({
    getSigningKey: mockGetSigningKey,
    createSigningKey: mockCreateSigningKey,
    logAudit: mockLogAudit,
  }),
}));

describe("compliance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /sign rejects non-enterprise plans", async () => {
    const app = createMockApp("team");
    const res = await req(app, "/v1/compliance/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test report" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /sign requires content", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/compliance/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST /verify requires content and signature", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/compliance/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /public-key returns 404 when no key exists", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/compliance/public-key");
    expect(res.status).toBe(404);
  });
});
