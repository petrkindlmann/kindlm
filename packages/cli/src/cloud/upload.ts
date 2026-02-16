import type { CloudClient } from "./client.js";
import type { RunnerResult } from "@kindlm/core";
import type { AggregatedTestResult } from "@kindlm/core";

function e(segment: string): string {
  return encodeURIComponent(segment);
}

export interface UploadOptions {
  projectName: string;
  suiteName: string;
  configHash: string;
  commitSha?: string;
  branch?: string;
  environment?: string;
  triggeredBy?: string;
}

interface CloudProject {
  id: string;
  name: string;
}

interface CloudSuite {
  id: string;
  name: string;
}

interface CloudRun {
  id: string;
}

export interface UploadResult {
  runId: string;
  projectId: string;
}

export async function uploadResults(
  client: CloudClient,
  runnerResult: RunnerResult,
  options: UploadOptions,
): Promise<UploadResult> {
  // 1. Find or create project
  const projectId = await findOrCreateProject(client, options.projectName);

  // 2. Find or create suite
  const suiteId = await findOrCreateSuite(client, projectId, options.suiteName, options.configHash);

  // 3. Create run
  const run = await client.post<CloudRun>(`/v1/runs/${e(projectId)}/runs`, {
    suiteId,
    commitSha: options.commitSha,
    branch: options.branch,
    environment: options.environment,
    triggeredBy: options.triggeredBy,
  });

  // 4. Batch insert results (chunks of 50 to avoid payload limits)
  const results = mapAggregatedResults(runnerResult.aggregated);
  const BATCH_SIZE = 50;
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    await client.post(`/v1/results/${e(run.id)}/results`, { results: batch });
  }

  // 5. Compute run-level metrics and finalize
  const { runResult } = runnerResult;
  const passRate = runResult.totalTests > 0
    ? runResult.passed / runResult.totalTests
    : 0;

  const modelIds = new Set(runnerResult.aggregated.map((a) => a.modelId));
  const judgeScores = runnerResult.aggregated
    .map((a) => a.assertionScores["judge"]?.mean)
    .filter((s): s is number => s !== undefined);
  const judgeAvgScore = judgeScores.length > 0
    ? judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length
    : undefined;

  const latencies = runnerResult.aggregated.map((a) => a.latencyAvgMs);
  const latencyAvgMs = latencies.length > 0
    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
    : undefined;

  const totalCost = runnerResult.aggregated.reduce((sum, a) => sum + a.totalCostUsd, 0);
  const costEstimateUsd = totalCost > 0 ? totalCost : undefined;

  await client.patch(`/v1/runs/${e(run.id)}`, {
    status: "completed",
    passRate,
    testCount: runResult.totalTests,
    modelCount: modelIds.size,
    judgeAvgScore,
    latencyAvgMs,
    costEstimateUsd,
    finishedAt: new Date().toISOString(),
  });

  return { runId: run.id, projectId };
}

async function findOrCreateProject(client: CloudClient, name: string): Promise<string> {
  const { projects } = await client.get<{ projects: CloudProject[] }>("/v1/projects");
  const existing = projects.find((p) => p.name === name);
  if (existing) return existing.id;

  const created = await client.post<CloudProject>("/v1/projects", { name });
  return created.id;
}

async function findOrCreateSuite(
  client: CloudClient,
  projectId: string,
  name: string,
  configHash: string,
): Promise<string> {
  const { suites } = await client.get<{ suites: CloudSuite[] }>(
    `/v1/suites/${e(projectId)}/suites`,
  );
  const existing = suites.find((s) => s.name === name);
  if (existing) return existing.id;

  const created = await client.post<CloudSuite>(`/v1/suites/${e(projectId)}/suites`, {
    name,
    configHash,
  });
  return created.id;
}

interface CloudTestResult {
  testCaseName: string;
  modelId: string;
  passed: number;
  passRate: number;
  runCount: number;
  judgeAvg: number | null;
  driftScore: number | null;
  latencyAvgMs: number | null;
  costUsd: number | null;
  totalTokens: number | null;
  failureCodes: string | null;
  failureMessages: string | null;
  assertionScores: string | null;
}

export function mapAggregatedResults(aggregated: AggregatedTestResult[]): CloudTestResult[] {
  return aggregated.map((agg) => {
    // Extract failure messages from runs, or use pre-computed value from cache
    const cached = agg as AggregatedTestResult & { failureMessages?: string[] };
    const failureMessages = agg.runs.length > 0
      ? agg.runs
          .flatMap((r) => r.assertions.filter((a) => !a.passed).map((a) => a.failureMessage))
          .filter((m): m is string => m !== undefined)
      : (cached.failureMessages ?? []);

    return {
      testCaseName: agg.testCaseName,
      modelId: agg.modelId,
      passed: agg.passed ? 1 : 0,
      passRate: agg.passRate,
      runCount: agg.runCount,
      judgeAvg: agg.assertionScores["judge"]?.mean ?? null,
      driftScore: agg.assertionScores["drift"]?.mean ?? null,
      latencyAvgMs: agg.latencyAvgMs ?? null,
      costUsd: agg.totalCostUsd ?? null,
      totalTokens: agg.totalTokens ?? null,
      failureCodes: agg.failureCodes.length > 0 ? JSON.stringify(agg.failureCodes) : null,
      failureMessages: failureMessages.length > 0 ? JSON.stringify(failureMessages) : null,
      assertionScores: Object.keys(agg.assertionScores).length > 0
        ? JSON.stringify(agg.assertionScores)
        : null,
    };
  });
}
