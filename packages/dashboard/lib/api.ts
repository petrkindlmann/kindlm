import { getToken } from "./auth";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.kindlm.com";

// ---------------------------------------------------------------------------
// Response types — matched to cloud API (packages/cloud/src/types.ts)
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  plan: "free" | "team" | "enterprise";
  createdAt: string;
  updatedAt: string;
}

/** Shape returned by GET /v1/auth/me (snake_case — explicit mapping in auth route) */
export interface User {
  id: string;
  github_id: number;
  github_login: string;
  email: string | null;
  org_id: string;
  role: "owner" | "admin" | "member";
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Matches cloud Run type from packages/cloud/src/types.ts */
export interface TestRun {
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

/** Matches cloud TestResult type from packages/cloud/src/types.ts */
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

/** Matches cloud Baseline type from packages/cloud/src/types.ts */
export interface Baseline {
  id: string;
  suiteId: string;
  runId: string;
  label: string;
  isActive: number;
  createdAt: string;
  activatedAt: string | null;
}

export interface ComparisonData {
  run: TestRun;
  baseline: Baseline;
  regressions: ComparisonDelta[];
  improvements: ComparisonDelta[];
  unchanged: number;
}

export interface ComparisonDelta {
  testCaseName: string;
  field: string;
  baselineValue: number;
  currentValue: number;
  delta: number;
}

/** Matches shape returned by GET /v1/auth/tokens (auth route maps each token) */
export interface ApiToken {
  id: string;
  name: string;
  scope: "full" | "ci" | "readonly";
  projectId: string | null;
  expiresAt: string | null;
  lastUsed: string | null;
  createdAt: string;
}

/** Matches shape returned by POST /v1/auth/tokens */
export interface ApiTokenCreateResponse {
  token: string;
  id: string;
  name: string;
  scope: "full" | "ci" | "readonly";
  projectId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** Matches shape returned by GET /v1/org/members (member route maps each member) */
export interface Member {
  userId: string;
  role: "owner" | "admin" | "member";
  createdAt: string;
  user: {
    id: string;
    githubLogin: string;
    email: string | null;
    avatarUrl: string | null;
  } | null;
}

/** Matches cloud Webhook type (with masked secret from list route) */
export interface Webhook {
  id: string;
  orgId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: string;
}

/** Matches shape returned by GET /v1/billing */
export interface BillingInfo {
  plan: "free" | "team" | "enterprise";
  billing: {
    plan: "free" | "team" | "enterprise";
    periodEnd: string | null;
    hasPaymentMethod: boolean;
  } | null;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// SWR fetcher
// ---------------------------------------------------------------------------

export const fetcher = <T>(path: string): Promise<T> => apiClient<T>(path);
