import { describe, it, expect, vi, beforeEach } from "vitest";
import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { billingRoutes, stripeWebhookRoute } from "./billing.js";
import { mockOrg, mockToken, testRequest, testExecutionCtx } from "../test-helpers.js";
import type { Bindings } from "../types.js";

// Polyfill crypto.subtle.timingSafeEqual for Node.js test environment
// (this API is available in Cloudflare Workers but not in Node.js)
if (!("timingSafeEqual" in crypto.subtle)) {
  Object.defineProperty(crypto.subtle, "timingSafeEqual", {
    value: (a: ArrayBufferLike, b: ArrayBufferLike): boolean => {
      return timingSafeEqual(Buffer.from(a), Buffer.from(b));
    },
  });
}

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

const WEBHOOK_SECRET = "whsec_test_secret_key_123";

async function computeStripeSignature(payload: string, secret: string, timestamp: number): Promise<string> {
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestamp},v1=${hex}`;
}

function createWebhookApp(overrides: Partial<Bindings> = {}) {
  const app = new Hono<AppEnv>();
  app.route("/stripe/webhook", stripeWebhookRoute);

  const env: Bindings = {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        first: vi.fn().mockResolvedValue(null),
      }),
    } as unknown as D1Database,
    ENVIRONMENT: "test",
    GITHUB_CLIENT_ID: "test",
    GITHUB_CLIENT_SECRET: "test",
    SIGNING_KEY_SECRET: "test",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    ...overrides,
  };

  return { app, env };
}

function createAppWithStripe() {
  const app = new Hono<AppEnv>();
  const env: Bindings = {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
        first: vi.fn().mockResolvedValue(null),
      }),
    } as unknown as D1Database,
    ENVIRONMENT: "test",
    GITHUB_CLIENT_ID: "test",
    GITHUB_CLIENT_SECRET: "test",
    SIGNING_KEY_SECRET: "test",
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_TEAM_PRICE_ID: "price_team_test_123",
    STRIPE_ENTERPRISE_PRICE_ID: "price_enterprise_test_123",
  };
  // Inject auth context — env is passed via app.request() third arg
  app.use("*", async (c, next) => {
    c.set("auth", { org, token, user: null });
    return next();
  });
  app.route("/v1/billing", billingRoutes);
  return { app, env };
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

  it("POST /checkout creates session with Price ID (not price_data)", async () => {
    const mockFetch = vi
      .fn()
      // First call: create Stripe customer
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "cus_test_new" }), { status: 200 }))
      // Second call: create checkout session
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ url: "https://checkout.stripe.com/pay/cs_test_123" }),
          { status: 200 },
        ),
      );

    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(getQueries).mockReturnValue({
      getBilling: vi.fn().mockResolvedValue(null),
      upsertBilling: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getQueries>);

    const { app, env } = createAppWithStripe();
    const res = await app.request("/v1/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "team" }),
    }, env, testExecutionCtx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { checkoutUrl: string };
    expect(body.checkoutUrl).toBe("https://checkout.stripe.com/pay/cs_test_123");

    // Verify the checkout session call used a Price ID, not price_data
    const checkoutCall = mockFetch.mock.calls[1] as [string, { body: string }];
    const checkoutBody = checkoutCall[1].body;
    expect(checkoutBody).toContain("line_items%5B0%5D%5Bprice%5D=price_team_test_123");
    expect(checkoutBody).not.toContain("price_data");

    vi.unstubAllGlobals();
  });

  it("POST /checkout returns 501 when Price ID not configured", async () => {
    vi.mocked(getQueries).mockReturnValue({
      getBilling: vi.fn().mockResolvedValue(null),
      upsertBilling: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getQueries>);

    // Use app with Stripe key present but team Price ID missing
    const app = new Hono<AppEnv>();
    const envNoTeamPrice: Bindings = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          first: vi.fn().mockResolvedValue(null),
        }),
      } as unknown as D1Database,
      ENVIRONMENT: "test",
      GITHUB_CLIENT_ID: "test",
      GITHUB_CLIENT_SECRET: "test",
      SIGNING_KEY_SECRET: "test",
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      // STRIPE_TEAM_PRICE_ID deliberately omitted
      STRIPE_ENTERPRISE_PRICE_ID: "price_enterprise_test_123",
    };
    app.use("*", async (c, next) => {
      c.set("auth", { org, token, user: null });
      return next();
    });
    app.route("/v1/billing", billingRoutes);

    // Mock fetch for customer creation call before price ID check
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "cus_test_new" }), { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await app.request("/v1/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "team" }),
    }, envNoTeamPrice, testExecutionCtx);

    expect(res.status).toBe(501);
    const resBody = (await res.json()) as { error: string };
    expect(resBody.error).toContain("STRIPE_TEAM_PRICE_ID");

    vi.unstubAllGlobals();
  });
});

describe("stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const { app, env } = createWebhookApp();
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });

    const res = await app.request("/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    }, env, testExecutionCtx);

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain("Missing stripe-signature");
  });

  it("returns 400 when signature is invalid", async () => {
    const { app, env } = createWebhookApp();
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });
    const timestamp = Math.floor(Date.now() / 1000);

    const res = await app.request("/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": `t=${timestamp},v1=invalidsignature0000000000000000000000000000000000000000000000`,
      },
      body: payload,
    }, env, testExecutionCtx);

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toContain("Invalid signature");
  });

  it("processes checkout.session.completed with valid signature", async () => {
    const mockUpsertBilling = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getQueries).mockReturnValue({
      upsertBilling: mockUpsertBilling,
      getBillingByCustomerId: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof getQueries>);

    const { app, env } = createWebhookApp();
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { org_id: "org-1", plan: "team" },
          customer: "cus_123",
          subscription: "sub_123",
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await computeStripeSignature(payload, WEBHOOK_SECRET, timestamp);

    const res = await app.request("/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    }, env, testExecutionCtx);

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.received).toBe(true);
    expect(mockUpsertBilling).toHaveBeenCalledWith("org-1", expect.objectContaining({ plan: "team" }));
  });

  it("processes customer.subscription.updated with valid signature", async () => {
    const mockUpsertBilling = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getQueries).mockReturnValue({
      upsertBilling: mockUpsertBilling,
      getBillingByCustomerId: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof getQueries>);

    const { app, env } = createWebhookApp();
    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const payload = JSON.stringify({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          metadata: { org_id: "org-1" },
          current_period_end: periodEnd,
          items: {
            data: [{ price: { metadata: { plan: "enterprise" } } }],
          },
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await computeStripeSignature(payload, WEBHOOK_SECRET, timestamp);

    const res = await app.request("/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    }, env, testExecutionCtx);

    expect(res.status).toBe(200);
    expect(mockUpsertBilling).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ stripeSubscriptionId: "sub_123" }),
    );
  });

  it("processes customer.subscription.deleted and resets to free", async () => {
    const mockUpsertBilling = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getQueries).mockReturnValue({
      upsertBilling: mockUpsertBilling,
      getBillingByCustomerId: vi.fn().mockResolvedValue(null),
    } as unknown as ReturnType<typeof getQueries>);

    const { app, env } = createWebhookApp();
    const payload = JSON.stringify({
      type: "customer.subscription.deleted",
      data: {
        object: {
          metadata: { org_id: "org-1" },
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await computeStripeSignature(payload, WEBHOOK_SECRET, timestamp);

    const res = await app.request("/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    }, env, testExecutionCtx);

    expect(res.status).toBe(200);
    expect(mockUpsertBilling).toHaveBeenCalledWith("org-1", { plan: "free" });
  });

  it("returns 501 when Stripe is not configured", async () => {
    const { app, env } = createWebhookApp({
      STRIPE_SECRET_KEY: undefined,
      STRIPE_WEBHOOK_SECRET: undefined,
    });
    const payload = JSON.stringify({ type: "test", data: { object: {} } });

    const res = await app.request("/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=123,v1=abc",
      },
      body: payload,
    }, env, testExecutionCtx);

    expect(res.status).toBe(501);
  });

  it("subscription.updated syncs org plan via D1 UPDATE", async () => {
    const mockPrepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    });
    const mockUpsertBilling = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getQueries).mockReturnValue({
      upsertBilling: mockUpsertBilling,
      getBillingByCustomerId: vi.fn().mockResolvedValue({ orgId: "org-1" }),
    } as unknown as ReturnType<typeof getQueries>);

    const { app, env } = createWebhookApp();
    (env.DB as unknown as { prepare: typeof mockPrepare }).prepare = mockPrepare;

    const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const payload = JSON.stringify({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          current_period_end: periodEnd,
          items: {
            data: [{ price: { metadata: { plan: "team" } } }],
          },
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await computeStripeSignature(payload, WEBHOOK_SECRET, timestamp);

    const res = await app.request("/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    }, env, testExecutionCtx);

    expect(res.status).toBe(200);
    // Verify org plan was synced via D1 UPDATE
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE orgs SET plan"),
    );
  });
});
