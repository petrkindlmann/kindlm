import type {
  Suite,
  Run,
  TestResult,
  Baseline,
} from "../../types.js";

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
    complianceSignature: (row.compliance_signature as string) ?? null,
    complianceSignedAt: (row.compliance_signed_at as string) ?? null,
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
    responseText: (row.response_text as string) ?? null,
    toolCallsJson: (row.tool_calls_json as string) ?? null,
    createdAt: row.created_at as string,
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

export function getTestingQueries(db: D1Database) {
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
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    // Atomic INSERT ... ON CONFLICT to avoid TOCTOU race
    await db
      .prepare(
        "INSERT INTO suites (id, project_id, name, config_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(project_id, name) DO NOTHING",
      )
      .bind(id, projectId, name, configHash, now, now)
      .run();
    // Fetch the existing or newly created row
    const row = await db
      .prepare("SELECT * FROM suites WHERE project_id = ? AND name = ?")
      .bind(projectId, name)
      .first();
    if (!row) throw new Error("Suite not found after upsert");
    return mapSuite(row);
  }

  async function deleteSuite(id: string, projectId: string): Promise<boolean> {
    const result = await db
      .prepare("DELETE FROM suites WHERE id = ? AND project_id = ?")
      .bind(id, projectId)
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }

  async function updateSuite(
    id: string,
    orgId: string,
    fields: Partial<Pick<Suite, "name">>,
  ): Promise<Suite | null> {
    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [new Date().toISOString()];

    if (fields.name !== undefined) {
      sets.push("name = ?");
      values.push(fields.name);
    }

    if (sets.length === 1) return getSuite(id);

    values.push(id, orgId);
    const result = await db
      .prepare(
        `UPDATE suites SET ${sets.join(", ")} WHERE id = ? AND project_id IN (SELECT id FROM projects WHERE org_id = ?)`,
      )
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
      complianceSignature: null,
      complianceSignedAt: null,
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
        | "complianceSignature"
        | "complianceSignedAt"
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
      complianceSignature: "compliance_signature",
      complianceSignedAt: "compliance_signed_at",
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
    opts?: { suiteId?: string; branch?: string; dateFrom?: string; dateTo?: string; limit?: number; offset?: number },
  ): Promise<{ runs: Run[]; total: number }> {
    const where = ["project_id = ?"];
    const params: unknown[] = [projectId];

    if (opts?.suiteId) {
      where.push("suite_id = ?");
      params.push(opts.suiteId);
    }

    if (opts?.branch) {
      where.push("branch = ?");
      params.push(opts.branch);
    }

    if (opts?.dateFrom) {
      where.push("created_at >= ?");
      params.push(opts.dateFrom);
    }

    if (opts?.dateTo) {
      where.push("created_at <= ?");
      params.push(opts.dateTo);
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

  async function getRunTrends(
    projectId: string,
    limit: number = 30,
  ): Promise<Array<{ day: string; avgPassRate: number | null; totalCostUsd: number | null; runCount: number }>> {
    const { results } = await db
      .prepare(
        `SELECT
          strftime('%Y-%m-%d', created_at) AS day,
          AVG(pass_rate) AS avg_pass_rate,
          SUM(cost_estimate_usd) AS total_cost_usd,
          COUNT(*) AS run_count
        FROM runs
        WHERE project_id = ? AND status = 'completed'
        GROUP BY day
        ORDER BY day DESC
        LIMIT ?`,
      )
      .bind(projectId, limit)
      .all();
    return results.map((r) => ({
      day: r.day as string,
      avgPassRate: (r.avg_pass_rate as number) ?? null,
      totalCostUsd: (r.total_cost_usd as number) ?? null,
      runCount: r.run_count as number,
    }));
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
      responseText?: string | null;
      toolCallsJson?: string | null;
    }>,
  ): Promise<void> {
    const stmts = results.map((r) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      return db
        .prepare(
          "INSERT INTO results (id, run_id, test_case_name, model_id, passed, pass_rate, run_count, judge_avg, drift_score, latency_avg_ms, cost_usd, total_tokens, failure_codes, failure_messages, assertion_scores, response_text, tool_calls_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
          r.responseText ?? null,
          r.toolCallsJson ?? null,
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

  // ---- Data Retention ----

  async function deleteBaselinesForOldRuns(plan: string, retentionDays: number): Promise<number> {
    const result = await db
      .prepare(
        `DELETE FROM baselines WHERE run_id IN (
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

  return {
    getSuite,
    createSuite,
    listSuites,
    getOrCreateSuite,
    deleteSuite,
    updateSuite,
    getRun,
    createRun,
    updateRun,
    listRuns,
    getRunTrends,
    createResults,
    listResults,
    getBaseline,
    createBaseline,
    listBaselines,
    activateBaseline,
    deleteBaseline,
    getActiveBaseline,
    deleteBaselinesForOldRuns,
    deleteOldRuns,
  };
}
