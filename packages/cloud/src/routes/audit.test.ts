import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Plan } from "../types.js";
import { auditRoutes } from "./audit.js";
import { testEnv, testExecutionCtx } from "../test-helpers.js";

function createMockApp(plan: Plan = "enterprise") {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", {
      org: { id: "org-1", name: "Test Org", plan, createdAt: "", updatedAt: "" },
      token: { id: "tok-1", orgId: "org-1", userId: null, name: "test", tokenHash: "", scope: "full" as const, projectId: null, expiresAt: null, lastUsed: null, createdAt: "", revokedAt: null },
      user: null,
    });
    await next();
  });
  app.route("/v1/audit", auditRoutes);
  return app;
}

function req(app: Hono<AppEnv>, url: string, init?: RequestInit) {
  return app.request(url, init, testEnv, testExecutionCtx);
}

const mockEntries = [
  {
    id: "aud-1",
    orgId: "org-1",
    actorId: "tok-1",
    actorType: "token",
    action: "project.create",
    resourceType: "project",
    resourceId: "proj-1",
    metadata: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

const mockListAuditLog = vi.fn().mockResolvedValue({ entries: mockEntries, total: 1, nextCursor: null });

vi.mock("../db/queries.js", () => ({
  getQueries: () => ({
    listAuditLog: mockListAuditLog,
  }),
}));

describe("audit routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAuditLog.mockResolvedValue({ entries: mockEntries, total: 1, nextCursor: null });
  });

  it("GET /v1/audit returns audit entries for enterprise", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/audit");
    expect(res.status).toBe(200);
    const body = await res.json() as { entries: Array<{ action: string }>; total: number; nextCursor: string | null };
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.entries[0]?.action).toBe("project.create");
    expect(body.nextCursor).toBeNull();
  });

  it("GET /v1/audit rejects non-enterprise plans", async () => {
    const app = createMockApp("team");
    const res = await req(app, "/v1/audit");
    expect(res.status).toBe(403);
  });

  it("GET /v1/audit passes filter params to query", async () => {
    const app = createMockApp("enterprise");
    await req(app, "/v1/audit?action=project.create&resourceType=project&limit=10&offset=5");
    expect(mockListAuditLog).toHaveBeenCalledWith("org-1", {
      action: "project.create",
      resourceType: "project",
      actorId: undefined,
      since: undefined,
      until: undefined,
      cursor: undefined,
      limit: 10,
      offset: 5,
    });
  });

  it("GET /v1/audit passes date range filters", async () => {
    const app = createMockApp("enterprise");
    await req(app, "/v1/audit?since=2026-01-01&until=2026-02-01");
    expect(mockListAuditLog).toHaveBeenCalledWith("org-1", expect.objectContaining({
      since: "2026-01-01",
      until: "2026-02-01",
    }));
  });

  it("GET /v1/audit passes actorId filter", async () => {
    const app = createMockApp("enterprise");
    await req(app, "/v1/audit?actorId=tok-1");
    expect(mockListAuditLog).toHaveBeenCalledWith("org-1", expect.objectContaining({
      actorId: "tok-1",
    }));
  });

  it("GET /v1/audit passes cursor for pagination", async () => {
    const app = createMockApp("enterprise");
    await req(app, "/v1/audit?cursor=2026-01-01T00:00:00Z");
    expect(mockListAuditLog).toHaveBeenCalledWith("org-1", expect.objectContaining({
      cursor: "2026-01-01T00:00:00Z",
    }));
  });

  it("GET /v1/audit returns nextCursor when more results exist", async () => {
    mockListAuditLog.mockResolvedValue({
      entries: mockEntries,
      total: 100,
      nextCursor: "2025-12-31T23:59:59Z",
    });
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/audit?limit=1");
    const body = await res.json() as { nextCursor: string | null };
    expect(body.nextCursor).toBe("2025-12-31T23:59:59Z");
  });

  it("GET /v1/audit/export returns CSV", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/audit/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("audit-log-");
    const text = await res.text();
    const lines = text.split("\n");
    expect(lines[0]).toBe("id,orgId,actorId,actorType,action,resourceType,resourceId,createdAt");
    expect(lines).toHaveLength(2); // header + 1 entry
    expect(lines[1]).toContain("project.create");
  });

  it("GET /v1/audit/export rejects non-enterprise plans", async () => {
    const app = createMockApp("team");
    const res = await req(app, "/v1/audit/export");
    expect(res.status).toBe(403);
  });

  it("GET /v1/audit/export passes filter params", async () => {
    const app = createMockApp("enterprise");
    await req(app, "/v1/audit/export?action=token.create&actorId=tok-1");
    expect(mockListAuditLog).toHaveBeenCalledWith("org-1", expect.objectContaining({
      action: "token.create",
      actorId: "tok-1",
      limit: 10000,
      offset: 0,
    }));
  });
});
