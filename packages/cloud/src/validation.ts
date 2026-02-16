import { z } from "zod";

// Shared helpers

const nameField = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name must be 100 characters or fewer")
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/,
    "Name must start with alphanumeric and contain only letters, numbers, spaces, dashes, underscores",
  );

const validEvents = ["run.completed", "run.failed"] as const;

// --- Project ---

export const createProjectBody = z.object({
  name: nameField,
  description: z.string().max(500).optional(),
});

// --- Suite ---

export const createSuiteBody = z.object({
  name: nameField,
  configHash: z.string().min(1, "configHash is required").max(128),
  description: z.string().max(500).optional(),
  tags: z.string().max(500).optional(),
});

// --- Run ---

export const createRunBody = z.object({
  suiteId: z.string().min(1, "suiteId is required"),
  commitSha: z.string().max(64).optional(),
  branch: z.string().max(256).optional(),
  environment: z.string().max(100).optional(),
  triggeredBy: z.string().max(100).optional(),
});

export const updateRunBody = z.object({
  status: z.enum(["running", "completed", "failed"]).optional(),
  passRate: z.number().min(0).max(1).optional(),
  driftScore: z.number().optional(),
  schemaFailCount: z.number().int().min(0).optional(),
  piiFailCount: z.number().int().min(0).optional(),
  keywordFailCount: z.number().int().min(0).optional(),
  judgeAvgScore: z.number().min(0).max(1).optional(),
  costEstimateUsd: z.number().min(0).optional(),
  latencyAvgMs: z.number().min(0).optional(),
  testCount: z.number().int().min(0).optional(),
  modelCount: z.number().int().min(0).optional(),
  gatePassed: z.number().int().min(0).max(1).optional(),
  finishedAt: z.string().optional(),
});

// --- Results ---

export const resultItem = z.object({
  testCaseName: z.string().min(1).max(256),
  modelId: z.string().min(1).max(128),
  passed: z.number().int().min(0),
  passRate: z.number().min(0).max(1),
  runCount: z.number().int().min(1),
  judgeAvg: z.number().min(0).max(1).nullable().optional(),
  driftScore: z.number().nullable().optional(),
  latencyAvgMs: z.number().min(0).nullable().optional(),
  costUsd: z.number().min(0).nullable().optional(),
  totalTokens: z.number().int().min(0).nullable().optional(),
  failureCodes: z.string().max(10_000).nullable().optional(),
  failureMessages: z.string().max(50_000).nullable().optional(),
  assertionScores: z.string().max(50_000).nullable().optional(),
});

export const uploadResultsBody = z.object({
  results: z.array(resultItem).min(1).max(500),
});

// --- Webhook ---

export const createWebhookBody = z.object({
  url: z.string().url("url must be a valid URL").refine(
    (u) => u.startsWith("https://"),
    "url must use HTTPS",
  ),
  events: z.array(z.enum(validEvents)).min(1, "At least one event is required"),
  secret: z.string().max(256).optional(),
});

// --- Token ---

export const createTokenBody = z.object({
  orgId: z.string().optional(),
  name: nameField,
  scope: z.enum(["full", "ci", "readonly"]).optional(),
  projectId: z.string().optional(),
  expiresAt: z.string().optional(),
});

// --- Members ---

export const inviteMemberBody = z.object({
  githubLogin: z.string().min(1, "githubLogin is required").max(100),
  role: z.enum(["owner", "admin", "member"]).optional(),
});

export const updateMemberRoleBody = z.object({
  role: z.enum(["owner", "admin", "member"]),
});

// --- Baselines ---

export const createBaselineBody = z.object({
  runId: z.string().min(1, "runId is required"),
  label: z.string().min(1, "label is required").max(256),
});

// --- Helpers ---

export function parseIntBounded(
  raw: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
): number {
  if (raw === undefined) return defaultValue;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

type ValidationOk<T> = { readonly success: true; readonly data: T };
type ValidationErr = { readonly success: false; readonly error: string };
export type ValidationResult<T> = ValidationOk<T> | ValidationErr;

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.errors[0];
    const message = firstError
      ? `${firstError.path.join(".")}: ${firstError.message}`.replace(/^: /, "")
      : "Invalid request body";
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}
