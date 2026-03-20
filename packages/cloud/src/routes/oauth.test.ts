import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { oauthRoutes } from "./oauth.js";
import { testEnv, testExecutionCtx, createMockD1 } from "../test-helpers.js";
import { encryptWithSecret } from "../crypto/envelope.js";

vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  hashToken: vi.fn().mockResolvedValue("mocked-hash"),
  authMiddleware: vi.fn(),
}));

function createApp() {
  const app = new Hono<AppEnv>();
  app.route("/auth", oauthRoutes);
  return app;
}

function appRequest(app: ReturnType<typeof createApp>, url: string, init?: RequestInit): Promise<Response> {
  return app.request(url, init, testEnv, testExecutionCtx) as Promise<Response>;
}

describe("oauth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /auth/github", () => {
    it("redirects to GitHub with correct params", async () => {
      const app = createApp();
      const res = await appRequest(app, "/auth/github");

      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toBeTruthy();

      const url = new URL(location ?? "");
      expect(url.hostname).toBe("github.com");
      expect(url.pathname).toBe("/login/oauth/authorize");
      expect(url.searchParams.get("client_id")).toBe("test-client-id");
      expect(url.searchParams.get("scope")).toBe("read:user user:email");
      expect(url.searchParams.get("state")).toBeTruthy();
    });

    it("includes redirect_uri in state when provided and allowed", async () => {
      // In test environment, localhost:3001 is allowed
      const app = createApp();
      const res = await appRequest(
        app,
        "/auth/github?redirect_uri=http://localhost:3001/callback",
      );

      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      const url = new URL(location ?? "");
      const state = url.searchParams.get("state");
      expect(state).toBeTruthy();
      // State should contain the redirect URI before the HMAC signature
      const stateValue = state?.slice(0, state.lastIndexOf(".")) ?? "";
      expect(stateValue).toContain("http://localhost:3001/callback");
    });

    it("ignores disallowed redirect_uri origins", async () => {
      const app = createApp();
      const res = await appRequest(
        app,
        "/auth/github?redirect_uri=https://evil.com/steal",
      );

      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      const url = new URL(location ?? "");
      const state = url.searchParams.get("state");
      const stateValue = state?.slice(0, state.lastIndexOf(".")) ?? "";
      // Should NOT contain the evil redirect
      expect(stateValue).not.toContain("evil.com");
    });
  });

  describe("GET /auth/github/callback", () => {
    it("returns 400 when code is missing", async () => {
      const app = createApp();
      const res = await appRequest(app, "/auth/github/callback");

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("Missing code parameter");
    });

    it("returns 400 when state parameter is missing dot separator", async () => {
      const app = createApp();
      const res = await appRequest(app, "/auth/github/callback?code=abc&state=invalid-no-dot");

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain("Invalid state");
    });

    it("returns 400 when state HMAC signature is invalid", async () => {
      const app = createApp();
      const res = await appRequest(
        app,
        "/auth/github/callback?code=abc&state=some-nonce.bad-signature",
      );

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toContain("Invalid state");
    });
  });

  describe("POST /auth/exchange", () => {
    it("returns token when code is valid", async () => {
      const mockD1 = createMockD1();
      const env = { ...testEnv, DB: mockD1 as unknown as D1Database };

      // Encrypt the token as the exchange route now decrypts it
      const encryptedToken = await encryptWithSecret("klm_abc123", testEnv.GITHUB_CLIENT_SECRET, "auth_codes");

      // The route uses raw DB.prepare, not getQueries
      mockD1._configureResponse("DELETE FROM auth_codes", {
        first: { token: encryptedToken },
      });

      const app = createApp();
      const res = await app.request(
        "/auth/exchange",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "valid-code" }),
        },
        env,
        testExecutionCtx,
      ) as Response;

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.token).toBe("klm_abc123");
    });

    it("returns 400 when code is expired or used", async () => {
      const mockD1 = createMockD1();
      const env = { ...testEnv, DB: mockD1 as unknown as D1Database };

      // Simulate no matching row (expired or already used)
      mockD1._configureResponse("DELETE FROM auth_codes", {
        first: undefined,
      });

      const app = createApp();
      const res = await app.request(
        "/auth/exchange",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "expired-code" }),
        },
        env,
        testExecutionCtx,
      ) as Response;

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("Invalid or expired code");
    });

    it("returns 400 when code is missing from body", async () => {
      const app = createApp();
      const res = await appRequest(app, "/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("Missing code");
    });

    it("returns 400 when body is not valid JSON", async () => {
      const app = createApp();
      const res = await appRequest(app, "/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toBe("Missing code");
    });
  });
});
