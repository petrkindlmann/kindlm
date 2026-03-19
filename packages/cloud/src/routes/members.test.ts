import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { memberRoutes } from "./members.js";
import { mockOrg, mockToken, testRequest } from "../test-helpers.js";

vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

import { getQueries } from "../db/queries.js";

const org = mockOrg({ plan: "team" });
const token = mockToken({ userId: "user-caller" });

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/org/members", memberRoutes);
  return app;
}

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
});
