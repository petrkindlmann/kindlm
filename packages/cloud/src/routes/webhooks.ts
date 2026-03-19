import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getQueries } from "../db/queries.js";
import { requirePlan } from "../middleware/plan-gate.js";
import { auditLog } from "./audit-helper.js";
import { createWebhookBody, validateBody } from "../validation.js";

export const webhookRoutes = new Hono<AppEnv>();

// POST / — Create webhook
webhookRoutes.post("/", requirePlan("team", "enterprise"), async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const raw = await c.req.json();
  const parsed = validateBody(createWebhookBody, raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  const secret = crypto.randomUUID();
  const webhook = await queries.createWebhook(
    auth.org.id,
    body.url,
    body.events,
    secret,
  );

  auditLog(c, "webhook.create", "webhook", webhook.id, { url: body.url });
  return c.json(webhook, 201);
});

// GET / — List webhooks (with masked secrets)
webhookRoutes.get("/", requirePlan("team", "enterprise"), async (c) => {
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const webhooks = await queries.listWebhooks(auth.org.id);
  const masked = webhooks.map((w) => ({
    ...w,
    secret: w.secret.slice(0, 8) + "..." + w.secret.slice(-4),
  }));

  return c.json({ webhooks: masked });
});

// DELETE /:id — Delete webhook
webhookRoutes.delete("/:id", requirePlan("team", "enterprise"), async (c) => {
  const id = c.req.param("id") ?? "";
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const deleted = await queries.deleteWebhook(id, auth.org.id);
  if (!deleted) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  auditLog(c, "webhook.delete", "webhook", id);
  return c.body(null, 204);
});
