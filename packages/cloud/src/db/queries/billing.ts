import type {
  Webhook,
  WebhookEvent,
  Billing,
  AuditEntry,
} from "../../types.js";

function mapWebhook(row: Record<string, unknown>): Webhook {
  let events: WebhookEvent[] = [];
  try {
    events = JSON.parse(row.events as string) as WebhookEvent[];
  } catch {
    events = [];
  }
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    url: row.url as string,
    events,
    secret: row.secret as string,
    active: (row.active as number) === 1,
    createdAt: row.created_at as string,
  };
}

function mapBilling(row: Record<string, unknown>): Billing {
  return {
    orgId: row.org_id as string,
    stripeCustomerId: (row.stripe_customer_id as string) ?? null,
    stripeSubscriptionId: (row.stripe_subscription_id as string) ?? null,
    plan: (row.plan as Billing["plan"]) ?? "free",
    periodEnd: (row.period_end as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function safeParseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mapAuditEntry(row: Record<string, unknown>): AuditEntry {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    actorId: (row.actor_id as string) ?? null,
    actorType: row.actor_type as string,
    action: row.action as string,
    resourceType: row.resource_type as string,
    resourceId: (row.resource_id as string) ?? null,
    metadata: safeParseJson(row.metadata as string | null),
    createdAt: row.created_at as string,
  };
}

export function getBillingQueries(db: D1Database) {
  // ---- Webhooks ----

  async function createWebhook(
    orgId: string,
    url: string,
    events: WebhookEvent[],
    secret: string,
  ): Promise<Webhook> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO webhooks (id, org_id, url, events, secret, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)",
      )
      .bind(id, orgId, url, JSON.stringify(events), secret, now)
      .run();
    return {
      id,
      orgId,
      url,
      events,
      secret,
      active: true,
      createdAt: now,
    };
  }

  async function listWebhooks(orgId: string): Promise<Webhook[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM webhooks WHERE org_id = ? ORDER BY created_at DESC LIMIT 50",
      )
      .bind(orgId)
      .all();
    return results.map(mapWebhook);
  }

  async function deleteWebhook(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM webhooks WHERE id = ? AND org_id = ?")
      .bind(id, orgId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function listWebhooksByEvent(
    orgId: string,
    event: WebhookEvent,
  ): Promise<Webhook[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM webhooks WHERE org_id = ? AND active = 1 AND EXISTS (SELECT 1 FROM json_each(events) WHERE json_each.value = ?)",
      )
      .bind(orgId, event)
      .all();
    return results.map(mapWebhook);
  }

  async function getWebhook(id: string): Promise<Webhook | null> {
    const row = await db
      .prepare("SELECT * FROM webhooks WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapWebhook(row) : null;
  }

  async function updateWebhook(
    id: string,
    orgId: string,
    fields: Partial<Pick<Webhook, "url" | "events" | "active">>,
  ): Promise<Webhook | null> {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.url !== undefined) {
      sets.push("url = ?");
      values.push(fields.url);
    }
    if (fields.events !== undefined) {
      sets.push("events = ?");
      values.push(JSON.stringify(fields.events));
    }
    if (fields.active !== undefined) {
      sets.push("active = ?");
      values.push(fields.active ? 1 : 0);
    }

    if (sets.length === 0) return getWebhook(id);

    values.push(id, orgId);
    const result = await db
      .prepare(`UPDATE webhooks SET ${sets.join(", ")} WHERE id = ? AND org_id = ?`)
      .bind(...values)
      .run();

    if ((result.meta?.changes ?? 0) === 0) return null;
    return getWebhook(id);
  }

  // ---- Billing ----

  async function getBilling(orgId: string): Promise<Billing | null> {
    const row = await db
      .prepare("SELECT * FROM billing WHERE org_id = ?")
      .bind(orgId)
      .first();
    return row ? mapBilling(row) : null;
  }

  async function getBillingByCustomerId(stripeCustomerId: string): Promise<Billing | null> {
    const row = await db
      .prepare("SELECT * FROM billing WHERE stripe_customer_id = ?")
      .bind(stripeCustomerId)
      .first();
    return row ? mapBilling(row) : null;
  }

  async function upsertBilling(
    orgId: string,
    fields: Partial<
      Pick<Billing, "stripeCustomerId" | "stripeSubscriptionId" | "plan" | "periodEnd">
    >,
  ): Promise<Billing> {
    const now = new Date().toISOString();
    const existing = await getBilling(orgId);

    if (existing) {
      const sets: string[] = ["updated_at = ?"];
      const values: unknown[] = [now];

      if (fields.stripeCustomerId !== undefined) {
        sets.push("stripe_customer_id = ?");
        values.push(fields.stripeCustomerId);
      }
      if (fields.stripeSubscriptionId !== undefined) {
        sets.push("stripe_subscription_id = ?");
        values.push(fields.stripeSubscriptionId);
      }
      if (fields.plan !== undefined) {
        sets.push("plan = ?");
        values.push(fields.plan);
      }
      if (fields.periodEnd !== undefined) {
        sets.push("period_end = ?");
        values.push(fields.periodEnd);
      }

      values.push(orgId);
      await db
        .prepare(`UPDATE billing SET ${sets.join(", ")} WHERE org_id = ?`)
        .bind(...values)
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO billing (org_id, stripe_customer_id, stripe_subscription_id, plan, period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          orgId,
          fields.stripeCustomerId ?? null,
          fields.stripeSubscriptionId ?? null,
          fields.plan ?? "free",
          fields.periodEnd ?? null,
          now,
          now,
        )
        .run();
    }

    const result = await getBilling(orgId);
    if (!result) {
      throw new Error(`Billing record not found after upsert for org ${orgId}`);
    }
    return result;
  }

  // ---- Audit Log ----

  async function logAudit(
    orgId: string,
    action: string,
    resourceType: string,
    resourceId?: string | null,
    actorId?: string | null,
    actorType: string = "token",
    metadata?: Record<string, unknown> | null,
  ): Promise<void> {
    await db
      .prepare(
        "INSERT INTO audit_log (org_id, actor_id, actor_type, action, resource_type, resource_id, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        orgId,
        actorId ?? null,
        actorType,
        action,
        resourceType,
        resourceId ?? null,
        metadata ? JSON.stringify(metadata) : null,
      )
      .run();
  }

  async function listAuditLog(
    orgId: string,
    opts?: {
      action?: string;
      resourceType?: string;
      since?: string;
      until?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ entries: AuditEntry[]; total: number }> {
    const where = ["org_id = ?"];
    const params: unknown[] = [orgId];

    if (opts?.action) {
      where.push("action = ?");
      params.push(opts.action);
    }
    if (opts?.resourceType) {
      where.push("resource_type = ?");
      params.push(opts.resourceType);
    }
    if (opts?.since) {
      where.push("created_at >= ?");
      params.push(opts.since);
    }
    if (opts?.until) {
      where.push("created_at <= ?");
      params.push(opts.until);
    }

    const whereClause = where.join(" AND ");

    const countRow = await db
      .prepare(`SELECT COUNT(*) as count FROM audit_log WHERE ${whereClause}`)
      .bind(...params)
      .first<{ count: number }>();
    const total = countRow?.count ?? 0;

    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const { results } = await db
      .prepare(
        `SELECT * FROM audit_log WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all();

    return { entries: results.map(mapAuditEntry), total };
  }

  // ---- Idempotency ----

  async function cleanupExpiredIdempotencyKeys(): Promise<number> {
    const result = await db
      .prepare("DELETE FROM idempotency_keys WHERE expires_at < datetime('now')")
      .run();
    return result.meta?.changes ?? 0;
  }

  return {
    createWebhook,
    listWebhooks,
    deleteWebhook,
    listWebhooksByEvent,
    getWebhook,
    updateWebhook,
    getBilling,
    getBillingByCustomerId,
    upsertBilling,
    logAudit,
    listAuditLog,
    cleanupExpiredIdempotencyKeys,
  };
}
