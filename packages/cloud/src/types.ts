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
  userId: string | null;
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
  complianceReport: string | null;
  complianceHash: string | null;
  complianceSignature: string | null;
  complianceSignedAt: string | null;
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

export type WebhookEvent = "run.completed" | "run.failed";

export interface Webhook {
  id: string;
  orgId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  createdAt: string;
}

export interface Billing {
  orgId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: Plan;
  periodEnd: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  githubId: number;
  githubLogin: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export type OrgRole = "owner" | "admin" | "member";

export interface OrgMember {
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  user?: User;
}

export interface AuditEntry {
  id: string;
  orgId: string;
  actorId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface SigningKey {
  orgId: string;
  publicKey: string;
  // Stored encrypted with AES-256-GCM (envelope encryption via SIGNING_KEY_SECRET).
  privateKeyEnc: string;
  algorithm: string;
  createdAt: string;
}

export interface PendingInvite {
  id: string;
  orgId: string;
  email: string;
  role: OrgRole;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface SamlConfig {
  orgId: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpCertificate: string;
  spEntityId: string;
  enabled: boolean;
  createdAt: string;
}

export interface Bindings {
  DB: D1Database;
  ENVIRONMENT: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SIGNING_KEY_SECRET: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_TEAM_PRICE_ID?: string;
  STRIPE_ENTERPRISE_PRICE_ID?: string;
}

export interface AuthContext {
  org: Org;
  token: Token;
  user: User | null;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: { auth: AuthContext };
};

export function apiError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
