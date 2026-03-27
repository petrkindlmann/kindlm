import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./types.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { oauthRoutes } from "./routes/oauth.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { suiteRoutes } from "./routes/suites.js";
import { runRoutes } from "./routes/runs.js";
import { resultRoutes } from "./routes/results.js";
import { baselineRoutes } from "./routes/baselines.js";
import { compareRoutes } from "./routes/compare.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { billingRoutes, stripeWebhookRoute } from "./routes/billing.js";
import { memberRoutes } from "./routes/members.js";
import { auditRoutes } from "./routes/audit.js";
import { complianceRoutes } from "./routes/compliance.js";
import { ssoRoutes } from "./routes/sso.js";
import { getQueries } from "./db/queries.js";
import { getLimits } from "./middleware/plan-gate.js";

const MAX_BODY_SIZE = 1_048_576; // 1MB

const app = new Hono<AppEnv>();

// Global error handler — never leak stack traces
app.onError((error, c) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error:", error.message);
  return c.json({ error: "Internal server error" }, 500);
});

// Request body size limit
app.use("*", async (c, next) => {
  const contentLength = c.req.header("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return c.json({ error: "Request body too large (max 1MB)" }, 413);
  }
  return next();
});

app.use("*", async (c, next) => {
  const origins = ["https://cloud.kindlm.com", "https://kindlm.com"];
  if (c.env.ENVIRONMENT !== "production") {
    origins.push("http://localhost:3000", "http://localhost:3001");
  }
  const middleware = cors({
    origin: origins,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });
  return middleware(c, next);
});

// Fail fast if required secrets are missing (skip for health check)
app.use("*", async (c, next) => {
  if (c.req.path === "/health" || c.req.path === "/") {
    return next();
  }
  const required = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "SIGNING_KEY_SECRET"] as const;
  const missing = required.filter((k) => !c.env[k]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Missing required secrets: ${missing.join(", ")}`);
    return c.json({ error: "Server misconfigured" }, 500);
  }
  return next();
});

// Rate-limit on auth routes (public, no auth middleware but rate limited)
app.use("/auth/*", rateLimitMiddleware);

// Public routes (no auth required)
app.route("/auth", oauthRoutes);
app.route("/stripe/webhook", stripeWebhookRoute);

// Root — so browsers don't see a 404
app.get("/", (c) => c.json({ name: "KindLM API", docs: "https://kindlm.com/docs" }));

// Health check — verify D1 is reachable
app.get("/health", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1").first();
    return c.json({ status: "ok" });
  } catch {
    return c.json({ status: "degraded", error: "Database unreachable" }, 503);
  }
});

// Auth + rate-limit for all /v1 routes
app.use("/v1/*", authMiddleware);
app.use("/v1/*", rateLimitMiddleware);

// GET /v1/org — Return current organization
app.get("/v1/org", (c) => {
  const auth = c.get("auth");
  const org = auth.org;
  return c.json({
    id: org.id,
    name: org.name,
    plan: org.plan,
    github_org: null,
    created_at: org.createdAt,
    updated_at: org.updatedAt,
  });
});

app.route("/v1/auth", authRoutes);
app.route("/v1/projects", projectRoutes);
app.route("/v1/suites", suiteRoutes);
app.route("/v1/runs", runRoutes);
app.route("/v1/results", resultRoutes);
app.route("/v1/baselines", baselineRoutes);
app.route("/v1/compare", compareRoutes);
app.route("/v1/webhooks", webhookRoutes);
app.route("/v1/billing", billingRoutes);
app.route("/v1/org/members", memberRoutes);
app.route("/v1/audit", auditRoutes);
app.route("/v1/compliance", complianceRoutes);

// SSO routes: public endpoints under /auth/saml, config under /v1/sso
app.route("/auth/saml", ssoRoutes);
app.route("/v1/sso", ssoRoutes);

// Scheduled handler for data retention cleanup
async function handleScheduled(
  _event: ScheduledEvent,
  env: AppEnv["Bindings"],
  ctx: ExecutionContext,
): Promise<void> {
  const queries = getQueries(env.DB);

  const work = async () => {
    // Delete old runs per plan retention policy
    // Delete baselines referencing old runs BEFORE deleting the runs themselves
    // (baselines.run_id lacks ON DELETE CASCADE)
    const plans = ["free", "team"] as const;
    for (const plan of plans) {
      const limits = getLimits(plan);
      if (limits.retentionDays > 0) {
        await queries.deleteBaselinesForOldRuns(plan, limits.retentionDays);
        await queries.deleteOldRuns(plan, limits.retentionDays);
      }
    }
    // Clean up expired idempotency keys
    await queries.cleanupExpiredIdempotencyKeys();
    // Clean up expired auth codes
    await env.DB.prepare("DELETE FROM auth_codes WHERE expires_at < datetime('now')").run();
    // Clean up expired SAML assertion replay records
    await env.DB.prepare("DELETE FROM saml_assertions WHERE expires_at < datetime('now')").run();
  };

  ctx.waitUntil(work());
}

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
