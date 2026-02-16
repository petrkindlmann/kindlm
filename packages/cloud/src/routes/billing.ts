import { Hono } from "hono";
import type { AppEnv, Plan } from "../types.js";
import { getQueries } from "../db/queries.js";

const STRIPE_API = "https://api.stripe.com/v1";

const PLAN_PRICES: Record<string, { plan: Plan; name: string }> = {
  team: { plan: "team", name: "KindLM Team" },
  enterprise: { plan: "enterprise", name: "KindLM Enterprise" },
};

async function stripeRequest(
  path: string,
  secretKey: string,
  body?: Record<string, string>,
): Promise<unknown> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${btoa(secretKey + ":")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  return res.json();
}

export const billingRoutes = new Hono<AppEnv>();

// GET / — Get billing info for current org
billingRoutes.get("/", async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const billing = await queries.getBilling(auth.org.id);

  return c.json({
    plan: auth.org.plan,
    billing: billing
      ? {
          plan: billing.plan,
          periodEnd: billing.periodEnd,
          hasPaymentMethod: billing.stripeCustomerId !== null,
        }
      : null,
  });
});

// POST /checkout — Create Stripe Checkout session
billingRoutes.post("/checkout", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json(
      {
        message:
          "Stripe integration is not configured. Contact sales@kindlm.com for Team/Enterprise plans.",
        checkoutUrl: null,
      },
      501,
    );
  }

  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const body = await c.req.json<{ plan?: string; successUrl?: string; cancelUrl?: string }>();

  const planKey = body.plan ?? "team";
  const planInfo = PLAN_PRICES[planKey];
  if (!planInfo) {
    return c.json({ error: "Invalid plan. Must be team or enterprise" }, 400);
  }

  // Get or create Stripe customer
  const billing = await queries.getBilling(auth.org.id);
  let customerId = billing?.stripeCustomerId;

  if (!customerId) {
    const customer = (await stripeRequest("/customers", stripeKey, {
      name: auth.org.name,
      "metadata[org_id]": auth.org.id,
      "metadata[plan]": planKey,
    })) as { id: string };
    customerId = customer.id;
    await queries.upsertBilling(auth.org.id, { stripeCustomerId: customerId });
  }

  // Create Checkout session
  const session = (await stripeRequest("/checkout/sessions", stripeKey, {
    customer: customerId,
    mode: "subscription",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][product_data][name]": planInfo.name,
    "line_items[0][price_data][unit_amount]": planKey === "team" ? "4900" : "29900",
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][quantity]": "1",
    success_url: body.successUrl ?? "https://cloud.kindlm.com/billing?success=true",
    cancel_url: body.cancelUrl ?? "https://cloud.kindlm.com/billing?canceled=true",
    "metadata[org_id]": auth.org.id,
    "metadata[plan]": planKey,
  })) as { url: string };

  return c.json({ checkoutUrl: session.url });
});

// POST /portal — Create Stripe Customer Portal session
billingRoutes.post("/portal", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return c.json(
      {
        message:
          "Stripe integration is not configured. Contact sales@kindlm.com to manage your subscription.",
        portalUrl: null,
      },
      501,
    );
  }

  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);
  const billing = await queries.getBilling(auth.org.id);

  if (!billing?.stripeCustomerId) {
    return c.json({ error: "No billing account found. Please subscribe first." }, 404);
  }

  const body = await c.req.json<{ returnUrl?: string }>().catch(() => ({ returnUrl: undefined }));
  const session = (await stripeRequest(
    "/billing_portal/sessions",
    stripeKey,
    {
      customer: billing.stripeCustomerId,
      return_url: body.returnUrl ?? "https://cloud.kindlm.com/billing",
    },
  )) as { url: string };

  return c.json({ portalUrl: session.url });
});

// POST /webhook — Stripe webhook handler (no auth middleware)
// This route must be mounted separately, without auth
export const stripeWebhookRoute = new Hono<AppEnv>();

stripeWebhookRoute.post("/", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return c.json({ error: "Stripe not configured" }, 501);
  }

  const signature = c.req.header("stripe-signature");
  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  // Parse the raw body for signature verification
  const rawBody = await c.req.text();

  // Verify Stripe webhook signature (simplified — timestamp + payload)
  const parts = signature.split(",");
  const timestampPart = parts.find((p) => p.startsWith("t="));
  const sigPart = parts.find((p) => p.startsWith("v1="));

  if (!timestampPart || !sigPart) {
    return c.json({ error: "Invalid signature format" }, 400);
  }

  const timestamp = timestampPart.slice(2);
  const expectedSig = sigPart.slice(3);
  const signedPayload = `${timestamp}.${rawBody}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedSig !== expectedSig) {
    return c.json({ error: "Invalid signature" }, 400);
  }

  const event = JSON.parse(rawBody) as {
    type: string;
    data: {
      object: {
        metadata?: { org_id?: string; plan?: string };
        customer?: string;
        status?: string;
        current_period_end?: number;
        id?: string;
      };
    };
  };

  const queries = getQueries(c.env.DB);
  const obj = event.data.object;
  const orgId = obj.metadata?.org_id;

  switch (event.type) {
    case "checkout.session.completed": {
      if (orgId && obj.metadata?.plan) {
        const plan = obj.metadata.plan as Plan;
        await queries.upsertBilling(orgId, {
          plan,
          stripeSubscriptionId: (obj as { subscription?: string }).subscription ?? null,
        });
        // Update org plan
        await c.env.DB.prepare("UPDATE orgs SET plan = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(plan, orgId)
          .run();
      }
      break;
    }
    case "customer.subscription.updated": {
      if (orgId) {
        const periodEnd = obj.current_period_end
          ? new Date(obj.current_period_end * 1000).toISOString()
          : null;
        await queries.upsertBilling(orgId, {
          stripeSubscriptionId: obj.id ?? null,
          periodEnd,
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      if (orgId) {
        await queries.upsertBilling(orgId, { plan: "free" });
        await c.env.DB.prepare("UPDATE orgs SET plan = 'free', updated_at = datetime('now') WHERE id = ?")
          .bind(orgId)
          .run();
      }
      break;
    }
  }

  return c.json({ received: true });
});
