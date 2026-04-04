import { z } from "zod";
import type { Result, KindlmError } from "../types/result.js";
import { ok, err } from "../types/result.js";
import { formatZodPath } from "../config/schema.js";

// ============================================================
// Primitive / Reusable Schemas
// ============================================================

const NonEmptyString = z.string().min(1, "Must not be empty");
const Score01 = z.number().min(0).max(1);
const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);

// ============================================================
// Plugin Entry Schema
// ============================================================

const RedTeamPluginEntrySchema = z
  .object({
    id: NonEmptyString.describe(
      "Plugin identifier (e.g. 'prompt-injection', 'pii-disclosure', 'policy').",
    ),
    numTests: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(5)
      .describe("Number of attack probes to generate for this plugin (1-50)."),
    severity: SeveritySchema.optional().describe(
      "Override the plugin's default severity for this run.",
    ),
    config: z
      .record(z.unknown())
      .optional()
      .describe("Plugin-specific configuration bag."),
  })
  .superRefine((plugin, ctx) => {
    if (plugin.id === "policy") {
      const policy =
        plugin.config && typeof plugin.config === "object"
          ? (plugin.config as Record<string, unknown>).policy
          : undefined;
      if (typeof policy !== "string" || policy.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["config", "policy"],
          message:
            "The 'policy' plugin requires a non-empty config.policy string describing the policy to enforce.",
        });
      }
    }
  });

// ============================================================
// Sub-schemas
// ============================================================

const TargetSchema = z.object({
  model: NonEmptyString.describe(
    "Model id to red team. Must reference a configured model in the main config (checked in parser).",
  ),
  prompt: z
    .string()
    .optional()
    .describe(
      "Optional base system prompt the target uses in production. Probes will be layered on top.",
    ),
});

const JudgeSchema = z.object({
  model: z
    .string()
    .optional()
    .describe(
      "Model id used for LLM-as-judge graders. Must reference a configured model (checked in parser).",
    ),
  betaJudge: z
    .boolean()
    .optional()
    .describe("Enable the beta multi-judge / ensemble grading path."),
});

const StrategySchema = z.object({
  concurrency: z
    .number()
    .int()
    .min(1)
    .max(16)
    .default(4)
    .describe("Parallel probes across the entire run (1-16)."),
  maxBudgetUsd: z
    .number()
    .positive()
    .optional()
    .describe("Hard stop when aggregate spend exceeds this USD amount."),
});

const GatesSchema = z.object({
  maxCriticalFailures: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Maximum allowed critical-severity failures before the run fails."),
  maxHighFailures: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Maximum allowed high-severity failures before the run fails."),
  minOverallPassRate: Score01.optional().describe(
    "Minimum overall pass rate across every attack probe (0-1).",
  ),
});

// ============================================================
// Top-Level Red Team Config Schema
// ============================================================

export const RedTeamConfigSchema = z.object({
  purpose: NonEmptyString.describe(
    "The target application's stated purpose. Used by plugins to craft targeted attacks.",
  ),
  target: TargetSchema,
  judge: JudgeSchema.optional(),
  plugins: z
    .array(RedTeamPluginEntrySchema)
    .min(1, "At least one red team plugin must be configured"),
  strategy: StrategySchema.default({}),
  gates: GatesSchema.default({}),
});

// ============================================================
// Inferred Types
// ============================================================

export type RedTeamConfig = z.infer<typeof RedTeamConfigSchema>;
export type RedTeamPluginEntry = z.infer<typeof RedTeamPluginEntrySchema>;
export type RedTeamTargetConfig = z.infer<typeof TargetSchema>;
export type RedTeamJudgeConfig = z.infer<typeof JudgeSchema>;
export type RedTeamStrategyConfig = z.infer<typeof StrategySchema>;
export type RedTeamGatesConfig = z.infer<typeof GatesSchema>;

// ============================================================
// Validation Helper
// ============================================================

/**
 * Validate a raw red team config block in isolation.
 *
 * Used by S01's schema tests and by any downstream tool that wants to
 * round-trip a `redteam:` YAML section without the full KindLM config.
 * Cross-reference checks (target/judge model ids, plugin id catalog) live
 * in the main parser — they need the full config graph.
 */
export function validateRedTeamConfig(
  raw: unknown,
): Result<RedTeamConfig, KindlmError> {
  const result = RedTeamConfigSchema.safeParse(raw);
  if (!result.success) {
    return err({
      code: "CONFIG_VALIDATION_ERROR",
      message: "Red team config validation failed",
      details: {
        errors: result.error.issues.map(
          (issue) => `${formatZodPath(issue.path)}: ${issue.message}`,
        ),
      },
    });
  }
  return ok(result.data);
}
