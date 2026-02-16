export type Plan = "free" | "team" | "enterprise";

export interface Org {
  id: string;
  name: string;
  plan: Plan;
  createdAt: string;
  updatedAt: string;
}

export interface Token {
  id: string;
  orgId: string;
  name: string;
  tokenHash: string;
  scope: "full" | "ci" | "readonly";
  projectId: string | null;
  expiresAt: string | null;
  lastUsed: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Suite {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  configHash: string;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Run {
  id: string;
  projectId: string;
  suiteId: string;
  status: "running" | "completed" | "failed";
  commitSha: string | null;
  branch: string | null;
  environment: string | null;
  triggeredBy: string | null;
  passRate: number | null;
  driftScore: number | null;
  schemaFailCount: number;
  piiFailCount: number;
  keywordFailCount: number;
  judgeAvgScore: number | null;
  costEstimateUsd: number | null;
  latencyAvgMs: number | null;
  testCount: number;
  modelCount: number;
  gatePassed: number | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface TestResult {
  id: string;
  runId: string;
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
  createdAt: string;
}

export interface Baseline {
  id: string;
  suiteId: string;
  runId: string;
  label: string;
  isActive: number;
  createdAt: string;
  activatedAt: string | null;
}

export interface Bindings {
  DB: D1Database;
  ENVIRONMENT: string;
}

export interface AuthContext {
  org: Org;
  token: Token;
}
