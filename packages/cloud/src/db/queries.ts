import type {
  Org,
  Token,
  Project,
  Suite,
  Run,
  TestResult,
  Baseline,
  Webhook,
  WebhookEvent,
  Billing,
  User,
  OrgMember,
  OrgRole,
  AuditEntry,
  SigningKey,
  SamlConfig,
  PendingInvite,
} from "../types.js";

// ---------------------------------------------------------------------------
// Row → Type mapping helpers
// ---------------------------------------------------------------------------

function mapOrg(row: Record<string, unknown>): Org {
  return {
    id: row.id as string,
    name: row.name as string,
    plan: row.plan as Org["plan"],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapToken(row: Record<string, unknown>): Token {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    userId: (row.user_id as string) ?? null,
    name: row.name as string,
    tokenHash: row.token_hash as string,
    scope: row.scope as Token["scope"],
    projectId: (row.project_id as string) ?? null,
    expiresAt: (row.expires_at as string) ?? null,
    lastUsed: (row.last_used as string) ?? null,
    createdAt: row.created_at as string,
    revokedAt: (row.revoked_at as string) ?? null,
  };
}

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapSuite(row: Record<string, unknown>): Suite {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    configHash: row.config_hash as string,
    tags: (row.tags as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapRun(row: Record<string, unknown>): Run {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    suiteId: row.suite_id as string,
    status: row.status as Run["status"],
    commitSha: (row.commit_sha as string) ?? null,
    branch: (row.branch as string) ?? null,
    environment: (row.environment as string) ?? null,
    triggeredBy: (row.triggered_by as string) ?? null,
    passRate: (row.pass_rate as number) ?? null,
    driftScore: (row.drift_score as number) ?? null,
    schemaFailCount: (row.schema_fail_count as number) ?? 0,
    piiFailCount: (row.pii_fail_count as number) ?? 0,
    keywordFailCount: (row.keyword_fail_count as number) ?? 0,
    judgeAvgScore: (row.judge_avg_score as number) ?? null,
    costEstimateUsd: (row.cost_estimate_usd as number) ?? null,
    latencyAvgMs: (row.latency_avg_ms as number) ?? null,
    testCount: (row.test_count as number) ?? 0,
    modelCount: (row.model_count as number) ?? 0,
    gatePassed: (row.gate_passed as number) ?? null,
    complianceReport: (row.compliance_report as string) ?? null,
    complianceHash: (row.compliance_hash as string) ?? null,
    startedAt: row.started_at as string,
    finishedAt: (row.finished_at as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapTestResult(row: Record<string, unknown>): TestResult {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    testCaseName: row.test_case_name as string,
    modelId: row.model_id as string,
    passed: row.passed as number,
    passRate: row.pass_rate as number,
    runCount: row.run_count as number,
    judgeAvg: (row.judge_avg as number) ?? null,
    driftScore: (row.drift_score as number) ?? null,
    latencyAvgMs: (row.latency_avg_ms as number) ?? null,
    costUsd: (row.cost_usd as number) ?? null,
    totalTokens: (row.total_tokens as number) ?? null,
    failureCodes: (row.failure_codes as string) ?? null,
    failureMessages: (row.failure_messages as string) ?? null,
    assertionScores: (row.assertion_scores as string) ?? null,
    createdAt: row.created_at as string,
  };
}

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

function mapBaseline(row: Record<string, unknown>): Baseline {
  return {
    id: row.id as string,
    suiteId: row.suite_id as string,
    runId: row.run_id as string,
    label: row.label as string,
    isActive: row.is_active as number,
    createdAt: row.created_at as string,
    activatedAt: (row.activated_at as string) ?? null,
  };
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    githubId: row.github_id as number,
    githubLogin: row.github_login as string,
    email: (row.email as string) ?? null,
    avatarUrl: (row.avatar_url as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapOrgMember(row: Record<string, unknown>): OrgMember {
  return {
    orgId: row.org_id as string,
    userId: row.user_id as string,
    role: row.role as OrgRole,
    createdAt: row.created_at as string,
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

function mapSigningKey(row: Record<string, unknown>): SigningKey {
  return {
    orgId: row.org_id as string,
    publicKey: row.public_key as string,
    privateKeyEnc: row.private_key_enc as string,
    algorithm: row.algorithm as string,
    createdAt: row.created_at as string,
  };
}

function mapSamlConfig(row: Record<string, unknown>): SamlConfig {
  return {
    orgId: row.org_id as string,
    idpEntityId: row.idp_entity_id as string,
    idpSsoUrl: row.idp_sso_url as string,
    idpCertificate: row.idp_certificate as string,
    spEntityId: row.sp_entity_id as string,
    enabled: (row.enabled as number) === 1,
    createdAt: row.created_at as string,
  };
}

function mapPendingInvite(row: Record<string, unknown>): PendingInvite {
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    email: row.email as string,
    role: row.role as OrgRole,
    invitedBy: row.invited_by as string,
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Query factory
// ---------------------------------------------------------------------------

export function getQueries(db: D1Database) {
  // ---- Orgs ----

  async function getOrg(id: string): Promise<Org | null> {
    const row = await db
      .prepare("SELECT * FROM orgs WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapOrg(row) : null;
  }

  async function createOrg(
    name: string,
    plan: Org["plan"] = "free",
  ): Promise<Org> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO orgs (id, name, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(id, name, plan, now, now)
      .run();
    return { id, name, plan, createdAt: now, updatedAt: now };
  }

  // ---- Tokens ----

  async function getTokenByHash(hash: string): Promise<Token | null> {
    const row = await db
      .prepare(
        "SELECT * FROM tokens WHERE token_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))",
      )
      .bind(hash)
      .first();
    return row ? mapToken(row) : null;
  }

  async function createToken(
    orgId: string,
    name: string,
    tokenHash: string,
    scope: Token["scope"] = "full",
    projectId?: string | null,
    expiresAt?: string | null,
    userId?: string | null,
  ): Promise<Token> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO tokens (id, org_id, user_id, name, token_hash, scope, project_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, orgId, userId ?? null, name, tokenHash, scope, projectId ?? null, expiresAt ?? null, now)
      .run();
    return {
      id,
      orgId,
      userId: userId ?? null,
      name,
      tokenHash,
      scope,
      projectId: projectId ?? null,
      expiresAt: expiresAt ?? null,
      lastUsed: null,
      createdAt: now,
      revokedAt: null,
    };
  }

  async function listTokens(orgId: string): Promise<Token[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM tokens WHERE org_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 100",
      )
      .bind(orgId)
      .all();
    return results.map(mapToken);
  }

  async function revokeToken(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .prepare(
        "UPDATE tokens SET revoked_at = datetime('now') WHERE id = ? AND org_id = ? AND revoked_at IS NULL",
      )
      .bind(id, orgId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function updateTokenLastUsed(id: string): Promise<void> {
    await db
      .prepare("UPDATE tokens SET last_used = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
  }

  // ---- Projects ----

  async function getProject(id: string): Promise<Project | null> {
    const row = await db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapProject(row) : null;
  }

  async function createProject(
    orgId: string,
    name: string,
    description?: string | null,
  ): Promise<Project> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO projects (id, org_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, orgId, name, description ?? null, now, now)
      .run();
    return {
      id,
      orgId,
      name,
      description: description ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function listProjects(orgId: string): Promise<Project[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM projects WHERE org_id = ? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(orgId)
      .all();
    return results.map(mapProject);
  }

  async function deleteProject(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM projects WHERE id = ? AND org_id = ?")
      .bind(id, orgId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function countProjects(orgId: string): Promise<number> {
    const row = await db
      .prepare("SELECT COUNT(*) as count FROM projects WHERE org_id = ?")
      .bind(orgId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async function updateProject(
    id: string,
    orgId: string,
    fields: Partial<Pick<Project, "name" | "description">>,
  ): Promise<Project | null> {
    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [new Date().toISOString()];

    if (fields.name !== undefined) {
      sets.push("name = ?");
      values.push(fields.name);
    }
    if (fields.description !== undefined) {
      sets.push("description = ?");
      values.push(fields.description);
    }

    if (sets.length === 1) return getProject(id);

    values.push(id, orgId);
    const result = await db
      .prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ? AND org_id = ?`)
      .bind(...values)
      .run();

    if ((result.meta?.changes ?? 0) === 0) return null;
    return getProject(id);
  }

  // ---- Suites ----

  async function getSuite(id: string): Promise<Suite | null> {
    const row = await db
      .prepare("SELECT * FROM suites WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapSuite(row) : null;
  }

  async function createSuite(
    projectId: string,
    name: string,
    configHash: string,
    description?: string | null,
    tags?: string | null,
  ): Promise<Suite> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO suites (id, project_id, name, config_hash, description, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, projectId, name, configHash, description ?? null, tags ?? null, now, now)
      .run();
    return {
      id,
      projectId,
      name,
      description: description ?? null,
      configHash,
      tags: tags ?? null,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function listSuites(projectId: string): Promise<Suite[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM suites WHERE project_id = ? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(projectId)
      .all();
    return results.map(mapSuite);
  }

  async function getOrCreateSuite(
    projectId: string,
    name: string,
    configHash: string,
  ): Promise<Suite> {
    const row = await db
      .prepare(
        "SELECT * FROM suites WHERE project_id = ? AND name = ?",
      )
      .bind(projectId, name)
      .first();
    if (row) return mapSuite(row);
    return createSuite(projectId, name, configHash);
  }

  async function deleteSuite(id: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM suites WHERE id = ?")
      .bind(id)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function updateSuite(
    id: string,
    fields: Partial<Pick<Suite, "name">>,
  ): Promise<Suite | null> {
    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [new Date().toISOString()];

    if (fields.name !== undefined) {
      sets.push("name = ?");
      values.push(fields.name);
    }

    if (sets.length === 1) return getSuite(id);

    values.push(id);
    const result = await db
      .prepare(`UPDATE suites SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    if ((result.meta?.changes ?? 0) === 0) return null;
    return getSuite(id);
  }

  // ---- Runs ----

  async function getRun(id: string): Promise<Run | null> {
    const row = await db
      .prepare("SELECT * FROM runs WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapRun(row) : null;
  }

  async function createRun(
    projectId: string,
    suiteId: string,
    metadata: {
      commitSha?: string | null;
      branch?: string | null;
      environment?: string | null;
      triggeredBy?: string | null;
    } = {},
  ): Promise<Run> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO runs (id, project_id, suite_id, status, commit_sha, branch, environment, triggered_by, started_at, created_at) VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        id,
        projectId,
        suiteId,
        metadata.commitSha ?? null,
        metadata.branch ?? null,
        metadata.environment ?? null,
        metadata.triggeredBy ?? null,
        now,
        now,
      )
      .run();
    return {
      id,
      projectId,
      suiteId,
      status: "running",
      commitSha: metadata.commitSha ?? null,
      branch: metadata.branch ?? null,
      environment: metadata.environment ?? null,
      triggeredBy: metadata.triggeredBy ?? null,
      passRate: null,
      driftScore: null,
      schemaFailCount: 0,
      piiFailCount: 0,
      keywordFailCount: 0,
      judgeAvgScore: null,
      costEstimateUsd: null,
      latencyAvgMs: null,
      testCount: 0,
      modelCount: 0,
      gatePassed: null,
      complianceReport: null,
      complianceHash: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
    };
  }

  async function updateRun(
    id: string,
    fields: Partial<
      Pick<
        Run,
        | "status"
        | "passRate"
        | "driftScore"
        | "schemaFailCount"
        | "piiFailCount"
        | "keywordFailCount"
        | "judgeAvgScore"
        | "costEstimateUsd"
        | "latencyAvgMs"
        | "testCount"
        | "modelCount"
        | "gatePassed"
        | "complianceReport"
        | "complianceHash"
        | "finishedAt"
      >
    >,
  ): Promise<Run | null> {
    const sets: string[] = [];
    const values: unknown[] = [];

    const columnMap: Record<string, string> = {
      status: "status",
      passRate: "pass_rate",
      driftScore: "drift_score",
      schemaFailCount: "schema_fail_count",
      piiFailCount: "pii_fail_count",
      keywordFailCount: "keyword_fail_count",
      judgeAvgScore: "judge_avg_score",
      costEstimateUsd: "cost_estimate_usd",
      latencyAvgMs: "latency_avg_ms",
      testCount: "test_count",
      modelCount: "model_count",
      gatePassed: "gate_passed",
      complianceReport: "compliance_report",
      complianceHash: "compliance_hash",
      finishedAt: "finished_at",
    };

    for (const [key, value] of Object.entries(fields)) {
      const col = columnMap[key];
      if (col) {
        sets.push(`${col} = ?`);
        values.push(value);
      }
    }

    if (sets.length === 0) return getRun(id);

    values.push(id);
    await db
      .prepare(`UPDATE runs SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
    return getRun(id);
  }

  async function listRuns(
    projectId: string,
    opts?: { suiteId?: string; limit?: number; offset?: number },
  ): Promise<{ runs: Run[]; total: number }> {
    const where = ["project_id = ?"];
    const params: unknown[] = [projectId];

    if (opts?.suiteId) {
      where.push("suite_id = ?");
      params.push(opts.suiteId);
    }

    const whereClause = where.join(" AND ");

    const countRow = await db
      .prepare(`SELECT COUNT(*) as count FROM runs WHERE ${whereClause}`)
      .bind(...params)
      .first<{ count: number }>();
    const total = countRow?.count ?? 0;

    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const { results } = await db
      .prepare(
        `SELECT * FROM runs WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all();

    return { runs: results.map(mapRun), total };
  }

  // ---- Results ----

  async function createResults(
    runId: string,
    results: Array<{
      testCaseName: string;
      modelId: string;
      passed: number;
      passRate: number;
      runCount: number;
      judgeAvg?: number | null;
      driftScore?: number | null;
      latencyAvgMs?: number | null;
      costUsd?: number | null;
      totalTokens?: number | null;
      failureCodes?: string | null;
      failureMessages?: string | null;
      assertionScores?: string | null;
    }>,
  ): Promise<void> {
    const stmts = results.map((r) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      return db
        .prepare(
          "INSERT INTO results (id, run_id, test_case_name, model_id, passed, pass_rate, run_count, judge_avg, drift_score, latency_avg_ms, cost_usd, total_tokens, failure_codes, failure_messages, assertion_scores, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          id,
          runId,
          r.testCaseName,
          r.modelId,
          r.passed,
          r.passRate,
          r.runCount,
          r.judgeAvg ?? null,
          r.driftScore ?? null,
          r.latencyAvgMs ?? null,
          r.costUsd ?? null,
          r.totalTokens ?? null,
          r.failureCodes ?? null,
          r.failureMessages ?? null,
          r.assertionScores ?? null,
          now,
        );
    });
    if (stmts.length > 0) {
      await db.batch(stmts);
    }
  }

  async function listResults(
    runId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<TestResult[]> {
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 1000);
    const offset = Math.max(opts?.offset ?? 0, 0);
    const { results } = await db
      .prepare(
        "SELECT * FROM results WHERE run_id = ? ORDER BY test_case_name, model_id LIMIT ? OFFSET ?",
      )
      .bind(runId, limit, offset)
      .all();
    return results.map(mapTestResult);
  }

  // ---- Baselines ----

  async function getBaseline(id: string): Promise<Baseline | null> {
    const row = await db
      .prepare("SELECT * FROM baselines WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapBaseline(row) : null;
  }

  async function createBaseline(
    suiteId: string,
    runId: string,
    label: string,
  ): Promise<Baseline> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO baselines (id, suite_id, run_id, label, is_active, created_at) VALUES (?, ?, ?, ?, 0, ?)",
      )
      .bind(id, suiteId, runId, label, now)
      .run();
    return {
      id,
      suiteId,
      runId,
      label,
      isActive: 0,
      createdAt: now,
      activatedAt: null,
    };
  }

  async function listBaselines(suiteId: string): Promise<Baseline[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM baselines WHERE suite_id = ? ORDER BY created_at DESC LIMIT 100",
      )
      .bind(suiteId)
      .all();
    return results.map(mapBaseline);
  }

  async function activateBaseline(
    id: string,
    suiteId: string,
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const stmts = [
      db
        .prepare(
          "UPDATE baselines SET is_active = 0, activated_at = NULL WHERE suite_id = ? AND is_active = 1",
        )
        .bind(suiteId),
      db
        .prepare(
          "UPDATE baselines SET is_active = 1, activated_at = ? WHERE id = ? AND suite_id = ?",
        )
        .bind(now, id, suiteId),
    ];
    const results = await db.batch(stmts);
    return (results[1]?.meta?.changes ?? 0) > 0;
  }

  async function deleteBaseline(id: string, suiteId: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM baselines WHERE id = ? AND suite_id = ?")
      .bind(id, suiteId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function getActiveBaseline(
    suiteId: string,
  ): Promise<Baseline | null> {
    const row = await db
      .prepare(
        "SELECT * FROM baselines WHERE suite_id = ? AND is_active = 1",
      )
      .bind(suiteId)
      .first();
    return row ? mapBaseline(row) : null;
  }

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

  // ---- Users ----

  async function getUser(id: string): Promise<User | null> {
    const row = await db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first();
    return row ? mapUser(row) : null;
  }

  async function getUserByGithubId(githubId: number): Promise<User | null> {
    const row = await db
      .prepare("SELECT * FROM users WHERE github_id = ?")
      .bind(githubId)
      .first();
    return row ? mapUser(row) : null;
  }

  async function createUser(
    githubId: number,
    githubLogin: string,
    email: string | null,
    avatarUrl: string | null,
  ): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO users (id, github_id, github_login, email, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, githubId, githubLogin, email, avatarUrl, now)
      .run();
    return { id, githubId, githubLogin, email, avatarUrl, createdAt: now };
  }

  async function updateUser(
    id: string,
    fields: Partial<Pick<User, "githubLogin" | "email" | "avatarUrl">>,
  ): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    if (fields.githubLogin !== undefined) {
      sets.push("github_login = ?");
      values.push(fields.githubLogin);
    }
    if (fields.email !== undefined) {
      sets.push("email = ?");
      values.push(fields.email);
    }
    if (fields.avatarUrl !== undefined) {
      sets.push("avatar_url = ?");
      values.push(fields.avatarUrl);
    }
    if (sets.length === 0) return;
    values.push(id);
    await db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  // ---- Org Members ----

  async function addOrgMember(
    orgId: string,
    userId: string,
    role: OrgRole = "member",
  ): Promise<OrgMember> {
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(orgId, userId, role, now)
      .run();
    return { orgId, userId, role, createdAt: now };
  }

  async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
    const { results } = await db
      .prepare(
        `SELECT om.org_id, om.user_id, om.role, om.created_at,
                u.id as u_id, u.github_id as u_github_id, u.github_login as u_github_login,
                u.email as u_email, u.avatar_url as u_avatar_url, u.created_at as u_created_at
         FROM org_members om
         JOIN users u ON om.user_id = u.id
         WHERE om.org_id = ?
         ORDER BY om.created_at`,
      )
      .bind(orgId)
      .all();
    return results.map((row) => {
      const member = mapOrgMember(row);
      member.user = {
        id: row.u_id as string,
        githubId: row.u_github_id as number,
        githubLogin: row.u_github_login as string,
        email: (row.u_email as string) ?? null,
        avatarUrl: (row.u_avatar_url as string) ?? null,
        createdAt: row.u_created_at as string,
      };
      return member;
    });
  }

  async function removeOrgMember(orgId: string, userId: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM org_members WHERE org_id = ? AND user_id = ?")
      .bind(orgId, userId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function updateOrgMemberRole(
    orgId: string,
    userId: string,
    role: OrgRole,
  ): Promise<boolean> {
    const result = await db
      .prepare("UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?")
      .bind(role, orgId, userId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function countOrgMembers(orgId: string): Promise<number> {
    const row = await db
      .prepare("SELECT COUNT(*) as count FROM org_members WHERE org_id = ?")
      .bind(orgId)
      .first<{ count: number }>();
    return row?.count ?? 0;
  }

  async function getOrgMember(orgId: string, userId: string): Promise<OrgMember | null> {
    const row = await db
      .prepare("SELECT * FROM org_members WHERE org_id = ? AND user_id = ?")
      .bind(orgId, userId)
      .first();
    return row ? mapOrgMember(row) : null;
  }

  async function getUserOrgs(userId: string): Promise<Org[]> {
    const { results } = await db
      .prepare(
        `SELECT o.* FROM orgs o
         JOIN org_members om ON o.id = om.org_id
         WHERE om.user_id = ?
         ORDER BY o.created_at`,
      )
      .bind(userId)
      .all();
    return results.map(mapOrg);
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

  // ---- Signing Keys ----

  async function getSigningKey(orgId: string): Promise<SigningKey | null> {
    const row = await db
      .prepare("SELECT * FROM signing_keys WHERE org_id = ?")
      .bind(orgId)
      .first();
    return row ? mapSigningKey(row) : null;
  }

  async function createSigningKey(
    orgId: string,
    publicKey: string,
    privateKeyEnc: string,
  ): Promise<SigningKey> {
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO signing_keys (org_id, public_key, private_key_enc, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(orgId, publicKey, privateKeyEnc, now)
      .run();
    return { orgId, publicKey, privateKeyEnc, algorithm: "Ed25519", createdAt: now };
  }

  // ---- SAML Config ----

  async function getSamlConfig(orgId: string): Promise<SamlConfig | null> {
    const row = await db
      .prepare("SELECT * FROM saml_configs WHERE org_id = ?")
      .bind(orgId)
      .first();
    return row ? mapSamlConfig(row) : null;
  }

  async function upsertSamlConfig(
    orgId: string,
    config: {
      idpEntityId: string;
      idpSsoUrl: string;
      idpCertificate: string;
      spEntityId: string;
      enabled?: boolean;
    },
  ): Promise<SamlConfig> {
    const existing = await getSamlConfig(orgId);
    const now = new Date().toISOString();

    if (existing) {
      await db
        .prepare(
          "UPDATE saml_configs SET idp_entity_id = ?, idp_sso_url = ?, idp_certificate = ?, sp_entity_id = ?, enabled = ? WHERE org_id = ?",
        )
        .bind(
          config.idpEntityId,
          config.idpSsoUrl,
          config.idpCertificate,
          config.spEntityId,
          config.enabled ? 1 : 0,
          orgId,
        )
        .run();
    } else {
      await db
        .prepare(
          "INSERT INTO saml_configs (org_id, idp_entity_id, idp_sso_url, idp_certificate, sp_entity_id, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          orgId,
          config.idpEntityId,
          config.idpSsoUrl,
          config.idpCertificate,
          config.spEntityId,
          config.enabled ? 1 : 0,
          now,
        )
        .run();
    }

    const result = await getSamlConfig(orgId);
    if (!result) throw new Error("SAML config not found after upsert");
    return result;
  }

  // ---- Pending Invites ----

  async function createPendingInvite(
    orgId: string,
    email: string,
    role: OrgRole,
    invitedBy: string,
    expiresAt: string,
  ): Promise<PendingInvite> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        "INSERT INTO pending_invites (id, org_id, email, role, invited_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, orgId, email, role, invitedBy, expiresAt, now)
      .run();
    return { id, orgId, email, role, invitedBy, expiresAt, createdAt: now };
  }

  async function getPendingInvitesByOrg(orgId: string): Promise<PendingInvite[]> {
    const { results } = await db
      .prepare(
        "SELECT * FROM pending_invites WHERE org_id = ? AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 100",
      )
      .bind(orgId)
      .all();
    return results.map(mapPendingInvite);
  }

  async function getPendingInviteByEmail(orgId: string, email: string): Promise<PendingInvite | null> {
    const row = await db
      .prepare(
        "SELECT * FROM pending_invites WHERE org_id = ? AND email = ? AND expires_at > datetime('now')",
      )
      .bind(orgId, email)
      .first();
    return row ? mapPendingInvite(row) : null;
  }

  async function deletePendingInvite(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM pending_invites WHERE id = ? AND org_id = ?")
      .bind(id, orgId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  // ---- Data Retention ----

  async function deleteOldRuns(plan: string, retentionDays: number): Promise<number> {
    const result = await db
      .prepare(
        `DELETE FROM runs WHERE id IN (
          SELECT r.id FROM runs r
          JOIN projects p ON r.project_id = p.id
          JOIN orgs o ON p.org_id = o.id
          WHERE o.plan = ? AND r.created_at < datetime('now', '-' || ? || ' days')
        )`,
      )
      .bind(plan, retentionDays)
      .run();
    return result.meta?.changes ?? 0;
  }

  async function cleanupExpiredIdempotencyKeys(): Promise<number> {
    const result = await db
      .prepare("DELETE FROM idempotency_keys WHERE expires_at < datetime('now')")
      .run();
    return result.meta?.changes ?? 0;
  }

  return {
    // Orgs
    getOrg,
    createOrg,
    // Tokens
    getTokenByHash,
    createToken,
    listTokens,
    revokeToken,
    updateTokenLastUsed,
    // Projects
    getProject,
    createProject,
    listProjects,
    deleteProject,
    countProjects,
    updateProject,
    // Suites
    getSuite,
    createSuite,
    listSuites,
    getOrCreateSuite,
    deleteSuite,
    updateSuite,
    // Runs
    getRun,
    createRun,
    updateRun,
    listRuns,
    // Results
    createResults,
    listResults,
    // Baselines
    getBaseline,
    createBaseline,
    listBaselines,
    activateBaseline,
    deleteBaseline,
    getActiveBaseline,
    // Webhooks
    createWebhook,
    listWebhooks,
    deleteWebhook,
    listWebhooksByEvent,
    getWebhook,
    updateWebhook,
    // Billing
    getBilling,
    upsertBilling,
    // Users
    getUser,
    getUserByGithubId,
    createUser,
    updateUser,
    // Org Members
    addOrgMember,
    listOrgMembers,
    removeOrgMember,
    updateOrgMemberRole,
    countOrgMembers,
    getOrgMember,
    getUserOrgs,
    // Audit Log
    logAudit,
    listAuditLog,
    // Signing Keys
    getSigningKey,
    createSigningKey,
    // SAML
    getSamlConfig,
    upsertSamlConfig,
    // Pending Invites
    createPendingInvite,
    getPendingInvitesByOrg,
    getPendingInviteByEmail,
    deletePendingInvite,
    // Data Retention
    deleteOldRuns,
    cleanupExpiredIdempotencyKeys,
  };
}

export type Queries = ReturnType<typeof getQueries>;
