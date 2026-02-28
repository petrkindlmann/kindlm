import { getToken } from "./auth";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.kindlm.com";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  plan: "free" | "team" | "enterprise";
  github_org: string | null;
  created_at: string;
  updated_at: string;
}

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
  org_id: string;
  name: string;
  latest_run?: TestRun | null;
  test_count?: number;
  created_at: string;
}

export interface TestRun {
  id: string;
  project_id: string;
  git_commit: string | null;
  git_branch: string | null;
  ci_provider: string | null;
  total_tests: number;
  passed: number;
  failed: number;
  pass_rate: number;
  duration_ms: number;
  compliance_report: string | null;
  compliance_hash: string | null;
  created_at: string;
}

export interface TestResult {
  id: string;
  run_id: string;
  suite_name: string;
  test_name: string;
  pass: boolean;
  assertions: AssertionResultData[];
  response_text: string | null;
  tool_calls: ToolCallData[];
  latency_ms: number | null;
  cost_usd: number | null;
  created_at: string;
}

export interface AssertionResultData {
  type: string;
  pass: boolean;
  score?: number;
  message: string;
  details?: unknown;
}

export interface ToolCallData {
  name: string;
  arguments: Record<string, unknown>;
}

export interface Baseline {
  id: string;
  suite_id: string;
  name: string;
  active: boolean;
  snapshot_json: string;
  created_at: string;
}

export interface ComparisonData {
  run: TestRun;
  baseline: Baseline;
  regressions: ComparisonDelta[];
  improvements: ComparisonDelta[];
  unchanged: number;
}

export interface ComparisonDelta {
  test_name: string;
  suite_name: string;
  field: string;
  baseline_value: number;
  current_value: number;
  delta: number;
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export interface ApiTokenCreateResponse {
  id: string;
  name: string;
  token: string;
}

export interface Member {
  id: string;
  github_login: string;
  email: string | null;
  role: "owner" | "admin" | "member";
  avatar_url: string | null;
  created_at: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

export interface BillingInfo {
  plan: "free" | "team" | "enterprise";
  stripe_customer_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
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
