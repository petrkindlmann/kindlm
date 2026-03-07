import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { billingRoutes } from "./billing.js";
import { mockOrg, mockToken, testRequest } from "../test-helpers.js";

vi.mock("../db/queries.js", () => ({
  getQueries: vi.fn(),
}));

import { getQueries } from "../db/queries.js";

const org = mockOrg();
const token = mockToken();

function createApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/billing", billingRoutes);
  return app;
}

describe("billing routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET / returns plan and billing info", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getBilling: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/billing");

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.plan).toBe("team");
    expect(body.billing).toBeNull();
  });

  it("POST /checkout returns 501 when Stripe not configured", async () => {
    const app = createApp();
    const res = await testRequest(app, "/v1/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(501);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.checkoutUrl).toBeNull();
    expect(body.message).toBeTruthy();
  });

  it("POST /portal returns 501 when Stripe not configured", async () => {
    const app = createApp();
    const res = await testRequest(app, "/v1/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(501);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.portalUrl).toBeNull();
    expect(body.message).toBeTruthy();
  });

  it("GET / returns billing details when present", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getBilling: vi.fn().mockResolvedValue({
        orgId: "org-1",
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: "sub_test123",
        plan: "team",
        periodEnd: "2026-03-15T00:00:00.000Z",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      }),
    } as unknown as ReturnType<typeof getQueries>);

    const app = createApp();
    const res = await testRequest(app, "/v1/billing");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { billing: { plan: string; hasPaymentMethod: boolean } };
    expect(body.billing.plan).toBe("team");
    expect(body.billing.hasPaymentMethod).toBe(true);
  });
});
