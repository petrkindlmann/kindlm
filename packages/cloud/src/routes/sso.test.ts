import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Plan } from "../types.js";
import { ssoRoutes } from "./sso.js";
import { testEnv, testExecutionCtx } from "../test-helpers.js";

function createMockApp(plan: Plan = "enterprise") {
  const app = new Hono<AppEnv>();
  // Public routes don't need auth middleware
  app.route("/auth/saml", ssoRoutes);
  // Authenticated routes need auth context
  const authedApp = new Hono<AppEnv>();
  authedApp.use("*", async (c, next) => {
    c.set("auth", {
      org: { id: "org-1", name: "Test Org", plan, createdAt: "", updatedAt: "" },
      token: { id: "tok-1", orgId: "org-1", name: "test", tokenHash: "", scope: "full" as const, projectId: null, expiresAt: null, lastUsed: null, createdAt: "", revokedAt: null },
    });
    await next();
  });
  authedApp.route("/v1/sso", ssoRoutes);
  app.route("", authedApp);
  return app;
}

function req(app: Hono<AppEnv>, url: string, init?: RequestInit) {
  return app.request(url, init, testEnv, testExecutionCtx);
}

const mockGetSamlConfig = vi.fn().mockResolvedValue(null);
const mockUpsertSamlConfig = vi.fn().mockResolvedValue({
  orgId: "org-1",
  idpEntityId: "https://idp.example.com",
  idpSsoUrl: "https://idp.example.com/sso",
  spEntityId: "https://api.kindlm.com/auth/saml",
  enabled: true,
  createdAt: "2026-01-01T00:00:00Z",
});
const mockLogAudit = vi.fn().mockResolvedValue(undefined);

vi.mock("../db/queries.js", () => ({
  getQueries: () => ({
    getSamlConfig: mockGetSamlConfig,
    upsertSamlConfig: mockUpsertSamlConfig,
    logAudit: mockLogAudit,
  }),
}));

describe("SSO routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /auth/saml/metadata returns SP metadata XML", async () => {
    const app = createMockApp();
    const res = await req(app, "/auth/saml/metadata");
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("EntityDescriptor");
    expect(body).toContain("kindlm.com");
  });

  it("POST /auth/saml/callback rejects missing SAMLResponse", async () => {
    const app = createMockApp();
    const res = await req(app, "/auth/saml/callback", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    expect(res.status).toBe(400);
  });

  it("GET /v1/sso/config returns not configured when no config", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/sso/config");
    expect(res.status).toBe(200);
    const body = await res.json() as { configured: boolean };
    expect(body.configured).toBe(false);
  });

  it("PUT /v1/sso/config rejects non-enterprise plans", async () => {
    const app = createMockApp("team");
    const res = await req(app, "/v1/sso/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "https://idp.example.com/sso",
        idpCertificate: "MIICert...",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("PUT /v1/sso/config requires HTTPS for idpSsoUrl", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/sso/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idpEntityId: "https://idp.example.com",
        idpSsoUrl: "http://idp.example.com/sso",
        idpCertificate: "MIICert...",
      }),
    });
    expect(res.status).toBe(400);
  });
});
