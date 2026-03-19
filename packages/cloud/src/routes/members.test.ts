import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Bindings, PendingInvite } from "../types.js";
import { memberRoutes } from "./members.js";
import { mockOrg, mockToken, testExecutionCtx } from "../test-helpers.js";

vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

import { getQueries } from "../db/queries.js";

const org = mockOrg({ plan: "team" });
const token = mockToken({ userId: "user-caller" });

function makeTestEnv(db?: D1Database): Bindings {
  return {
    DB: db ?? ({} as D1Database),
    ENVIRONMENT: "test",
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    SIGNING_KEY_SECRET: "test-signing-key-secret",
  };
}

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/org/members", memberRoutes);
  return app;
}

function testRequest(
  app: Hono<AppEnv>,
  url: string,
  init?: RequestInit,
  env?: Bindings,
): Promise<Response> {
  return app.request(url, init, env ?? makeTestEnv(), testExecutionCtx) as Promise<Response>;
}

const sampleInvite: PendingInvite = {
  id: "inv-1",
  orgId: "org-1",
  email: "newuser@example.com",
  role: "member",
  invitedBy: "user-caller",
  expiresAt: "2025-02-01T00:00:00.000Z",
  createdAt: "2025-01-01T00:00:00.000Z",
};

describe("member routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET / lists org members", async () => {
    vi.mocked(getQueries).mockReturnValue({
      listOrgMembers: vi.fn().mockResolvedValue([
        {
          orgId: "org-1",
          userId: "user-1",
          role: "owner",
          createdAt: "2025-01-01T00:00:00.000Z",
          user: {
            id: "user-1",
            githubLogin: "testuser",
            email: "test@example.com",
            avatarUrl: "https://github.com/testuser.png",
            githubId: 12345,
            createdAt: "2025-01-01T00:00:00.000Z",
          },
        },
      ]),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/org/members");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { members: Array<{ userId: string }> };
    expect(body.members).toHaveLength(1);
  });

  it("PATCH /:userId updates member role", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getOrgMember: vi.fn()
        .mockResolvedValueOnce({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" })
        .mockResolvedValueOnce({ orgId: "org-1", userId: "user-2", role: "member", createdAt: "" }),
      updateOrgMemberRole: vi.fn().mockResolvedValue(true),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/org/members/user-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { role: string };
    expect(body.role).toBe("admin");
  });

  it("PATCH /:userId returns 400 for invalid role", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getOrgMember: vi.fn()
        .mockResolvedValueOnce({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" })
        .mockResolvedValueOnce(null),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/org/members/user-2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "superadmin" }),
    });

    expect(res.status).toBe(400);
  });

  it("DELETE /:userId removes member", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getOrgMember: vi.fn()
        .mockResolvedValueOnce({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" })
        .mockResolvedValueOnce({ orgId: "org-1", userId: "user-2", role: "member", createdAt: "" }),
      removeOrgMember: vi.fn().mockResolvedValue(true),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/org/members/user-2", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  it("DELETE /:userId returns 404 for non-existent member", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getOrgMember: vi.fn()
        .mockResolvedValueOnce({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" })
        .mockResolvedValueOnce(null),
      removeOrgMember: vi.fn().mockResolvedValue(false),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/org/members/user-999", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });

  describe("pending invites", () => {
    it("POST /invite creates pending invite when user not found and email provided", async () => {
      // Mock DB.prepare for the direct SQL query
      const mockAll = vi.fn().mockResolvedValue({ results: [] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      vi.mocked(getQueries).mockReturnValue({
        getOrgMember: vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" }),
        countOrgMembers: vi.fn().mockResolvedValue(2),
        getPendingInviteByEmail: vi.fn().mockResolvedValue(null),
        createPendingInvite: vi.fn().mockResolvedValue(sampleInvite),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(
        app,
        "/v1/org/members/invite",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ githubLogin: "unknownuser", email: "newuser@example.com" }),
        },
        makeTestEnv(mockDB),
      );

      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe("pending");
      expect(body.email).toBe("newuser@example.com");
    });

    it("POST /invite returns 404 when user not found and no email provided", async () => {
      const mockAll = vi.fn().mockResolvedValue({ results: [] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      vi.mocked(getQueries).mockReturnValue({
        getOrgMember: vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" }),
        countOrgMembers: vi.fn().mockResolvedValue(2),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(
        app,
        "/v1/org/members/invite",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ githubLogin: "unknownuser" }),
        },
        makeTestEnv(mockDB),
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.error).toMatch(/not found/);
    });

    it("POST /invite returns 409 when pending invite already exists", async () => {
      const mockAll = vi.fn().mockResolvedValue({ results: [] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDB = { prepare: mockPrepare } as unknown as D1Database;

      vi.mocked(getQueries).mockReturnValue({
        getOrgMember: vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" }),
        countOrgMembers: vi.fn().mockResolvedValue(2),
        getPendingInviteByEmail: vi.fn().mockResolvedValue(sampleInvite),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(
        app,
        "/v1/org/members/invite",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ githubLogin: "unknownuser", email: "newuser@example.com" }),
        },
        makeTestEnv(mockDB),
      );

      expect(res.status).toBe(409);
    });

    it("GET /invites lists pending invites", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getOrgMember: vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" }),
        getPendingInvitesByOrg: vi.fn().mockResolvedValue([sampleInvite]),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/org/members/invites");

      expect(res.status).toBe(200);
      const body = (await res.json()) as { invites: Array<{ id: string }> };
      expect(body.invites).toHaveLength(1);
      expect(body.invites[0]?.id).toBe("inv-1");
    });

    it("GET /invites returns 403 for non-admin", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getOrgMember: vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-caller", role: "member", createdAt: "" }),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/org/members/invites");

      expect(res.status).toBe(403);
    });

    it("DELETE /invites/:id cancels pending invite", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getOrgMember: vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" }),
        deletePendingInvite: vi.fn().mockResolvedValue(true),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/org/members/invites/inv-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(204);
    });

    it("DELETE /invites/:id returns 404 for non-existent invite", async () => {
      vi.mocked(getQueries).mockReturnValue({
        getOrgMember: vi.fn().mockResolvedValue({ orgId: "org-1", userId: "user-caller", role: "owner", createdAt: "" }),
        deletePendingInvite: vi.fn().mockResolvedValue(false),
      } as unknown as ReturnType<typeof getQueries>);

      const app = createApp();
      const res = await testRequest(app, "/v1/org/members/invites/inv-999", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });
});
