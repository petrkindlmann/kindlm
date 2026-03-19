import { z } from "zod";
import type { Result, KindlmError } from "../types/result.js";
import { ok, err } from "../types/result.js";
import { TraceConfigSchema } from "../trace/types.js";

// ============================================================
// Primitive / Reusable Schemas
// ============================================================

const NonEmptyString = z.string().min(1, "Must not be empty");

const Temperature = z.number().min(0).max(2).default(0.2);

const Score01 = z.number().min(0).max(1);

const RegexPattern = z.string().refine(
  (val) => {
    try {
      new RegExp(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Must be a valid regex pattern" },
);

// ============================================================
// Provider Schemas
// ============================================================

const ProviderConfigSchema = z.object({
  apiKeyEnv: NonEmptyString.describe(
    "Environment variable name containing the API key. Never a raw key.",
  ),
  baseUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Custom base URL for API-compatible proxies (e.g., Azure OpenAI, LiteLLM)",
    ),
  organization: z
    .string()
    .optional()
    .describe("Organization ID (OpenAI-specific)"),
});

const OllamaProviderConfigSchema = z.object({
  apiKeyEnv: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Environment variable name containing the API key. Optional for Ollama (local).",
    ),
  baseUrl: z
    .string()
    .url()
    .optional()
    .describe(
      "Ollama server URL. Defaults to http://localhost:11434.",
    ),
});

const ProvidersSchema = z
  .object({
    openai: ProviderConfigSchema.optional(),
    anthropic: ProviderConfigSchema.optional(),
    ollama: OllamaProviderConfigSchema.optional(),
    gemini: ProviderConfigSchema.optional(),
    mistral: ProviderConfigSchema.optional(),
    cohere: ProviderConfigSchema.optional(),
  })
  .refine(
    (providers) =>
      Object.keys(providers).some(
        (k) => providers[k as keyof typeof providers] !== undefined,
      ),
    { message: "At least one provider must be configured" },
  );

// ============================================================
// Model Schema
// ============================================================

const ModelParamsSchema = z.object({
  temperature: Temperature,
  maxTokens: z.number().int().min(1).max(128000).default(1024),
  topP: z.number().min(0).max(1).optional(),
  stopSequences: z.array(z.string()).optional(),
  seed: z
    .number()
    .int()
    .optional()
    .describe("Seed for reproducibility (provider-dependent support)"),
});

const ModelSchema = z.object({
  id: NonEmptyString.describe(
    "Unique identifier for this model config, referenced in reports",
  ),
  provider: z
    .enum(["openai", "anthropic", "ollama", "gemini", "mistral", "cohere"])
    .describe("Must match a key in the providers section"),
  model: NonEmptyString.describe(
    "Model name as the provider expects it (e.g., 'gpt-4o', 'claude-sonnet-4-5-20250929')",
  ),
  params: ModelParamsSchema.default({}),
});

// ============================================================
// Prompt Schema
// ============================================================

const PromptSchema = z.object({
  system: z
    .string()
    .optional()
    .describe(
      "System prompt template. Supports {{variable}} interpolation.",
    ),
  user: NonEmptyString.describe(
    "User prompt template. Supports {{variable}} interpolation.",
  ),
  assistant: z
    .string()
    .optional()
    .describe("Prefill for assistant response (Anthropic-specific)"),
});

// ============================================================
// Assertion Schemas
// ============================================================

const OutputExpectSchema = z
  .object({
    format: z.enum(["text", "json"]).default("text"),
    schemaFile: z
      .string()
      .optional()
      .describe(
        "Path to JSON Schema file (relative to config file). Required if format is 'json'.",
      ),
    contains: z
      .array(z.string())
      .optional()
      .describe("Output must contain all of these substrings"),
    notContains: z
      .array(z.string())
      .optional()
      .describe("Output must not contain any of these substrings"),
    maxLength: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum character length of the output"),
  })
  .refine(
    (output) => {
      if (output.format === "json" && !output.schemaFile) {
        return false;
      }
      return true;
    },
    { message: "schemaFile is required when format is 'json'" },
  );

const PIIGuardrailSchema = z.object({
  enabled: z.boolean().default(true),
  denyPatterns: z
    .array(RegexPattern)
    .default([
      "\\b\\d{3}-\\d{2}-\\d{4}\\b",
      "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
      "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
    ])
    .describe(
      "Regex patterns that must NOT appear in output. Defaults include SSN, credit card, email.",
    ),
  customPatterns: z
    .array(
      z.object({
        name: NonEmptyString,
        pattern: RegexPattern,
      }),
    )
    .optional()
    .describe("Named custom PII patterns for reporting clarity"),
});

const KeywordGuardrailSchema = z.object({
  deny: z
    .array(z.string())
    .default([])
    .describe(
      "Words/phrases that must NOT appear in output (case-insensitive)",
    ),
  allow: z
    .array(z.string())
    .optional()
    .describe(
      "If set, output MUST contain at least one of these words/phrases",
    ),
});

const JudgeCriterionSchema = z.object({
  criteria: NonEmptyString.describe(
    "Natural language description of what to evaluate (e.g., 'Response is empathetic and professional')",
  ),
  minScore: Score01.default(0.7).describe(
    "Minimum score (0-1) for this criterion to pass",
  ),
  model: z
    .string()
    .optional()
    .describe(
      "Override judge model for this criterion. Defaults to first model in models list.",
    ),
  rubric: z
    .string()
    .optional()
    .describe(
      "Detailed rubric for the judge. If omitted, a default rubric is generated from criteria.",
    ),
});

const ToolCallExpectSchema = z.object({
  tool: NonEmptyString.describe("Expected tool/function name"),
  shouldNotCall: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, assert this tool was NOT called"),
  argsMatch: z
    .record(z.unknown())
    .optional()
    .describe(
      "Key-value pairs that must be present in the tool call arguments (partial match)",
    ),
  argsSchema: z
    .string()
    .optional()
    .describe(
      "Path to JSON Schema file to validate the tool call arguments",
    ),
  argsSchemaResolved: z
    .record(z.unknown())
    .optional()
    .describe(
      "Resolved JSON Schema content from argsSchema file. Populated during config parsing — not user-supplied.",
    ),
  order: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      "Expected position in the sequence of tool calls (0-indexed)",
    ),
  responseContains: z
    .string()
    .optional()
    .describe(
      "Assert the simulated tool response contains this substring",
    ),
});

const BaselineDriftSchema = z.object({
  maxScore: Score01.default(0.15).describe(
    "Maximum drift score (0-1). Higher = more drift allowed. Fail if exceeded.",
  ),
  method: z
    .enum(["judge", "embedding", "field-diff"])
    .default("judge")
    .describe(
      "Drift detection method. 'judge' uses LLM comparison, 'embedding' uses cosine similarity, 'field-diff' compares JSON fields.",
    ),
  fields: z
    .array(z.string())
    .optional()
    .describe(
      "For field-diff method: JSON paths to compare (e.g., ['response.action', 'response.message'])",
    ),
});

const GuardrailsSchema = z.object({
  pii: PIIGuardrailSchema.optional(),
  keywords: KeywordGuardrailSchema.optional(),
});

const ExpectSchema = z.object({
  output: OutputExpectSchema.optional(),
  guardrails: GuardrailsSchema.optional(),
  judge: z
    .array(JudgeCriterionSchema)
    .optional()
    .describe(
      "LLM-as-judge evaluations. Each criterion is scored independently.",
    ),
  toolCalls: z
    .array(ToolCallExpectSchema)
    .optional()
    .describe("Expected tool/function calls in the model response"),
  baseline: z
    .object({
      drift: BaselineDriftSchema.optional(),
    })
    .optional(),
});

// ============================================================
// Tool Simulation Schema (for agent testing)
// ============================================================

const ToolSimulationSchema = z.object({
  name: NonEmptyString.describe("Tool/function name as the model sees it"),
  description: z
    .string()
    .optional()
    .describe("Tool description for documentation"),
  parameters: z
    .record(z.unknown())
    .optional()
    .describe("JSON Schema for the tool's parameters"),
  responses: z
    .array(
      z.object({
        when: z
          .record(z.unknown())
          .describe(
            "Condition: match tool call arguments (partial match)",
          ),
        then: z.unknown().describe(
          "Simulated response to return when condition matches",
        ),
      }),
    )
    .optional()
    .describe("Simulated responses based on argument matching"),
  defaultResponse: z
    .unknown()
    .optional()
    .describe("Response when no 'when' condition matches"),
});

// ============================================================
// Test Case Schema
// ============================================================

const TestCaseSchema = z.object({
  name: NonEmptyString.describe(
    "Unique test case name within the suite. Used in reports and JUnit output.",
  ),
  prompt: NonEmptyString.optional().describe(
    "Reference to a key in the prompts section. Exactly one of prompt or command must be set.",
  ),
  command: NonEmptyString.optional().describe(
    "Shell command to execute. Stdout is captured and assertions run against it. Exactly one of prompt or command must be set.",
  ),
  vars: z
    .record(z.string())
    .default({})
    .describe("Variables to interpolate into the prompt template or command"),
  models: z
    .array(z.string())
    .optional()
    .describe(
      "Override: run this test only against these model IDs. Defaults to all models. Ignored for command tests.",
    ),
  repeat: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      "Override: number of repeat runs for this specific test case",
    ),
  tools: z
    .array(ToolSimulationSchema)
    .optional()
    .describe(
      "Simulated tools available to the model for this test case",
    ),
  expect: ExpectSchema.describe(
    "Assertions to evaluate against the model output",
  ),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      "Tags for filtering test cases in CLI (e.g., --tags regression)",
    ),
  skip: z
    .boolean()
    .optional()
    .default(false)
    .describe("Skip this test case during execution"),
}).refine(
  (test) => {
    const hasPrompt = test.prompt !== undefined;
    const hasCommand = test.command !== undefined;
    return (hasPrompt || hasCommand) && !(hasPrompt && hasCommand);
  },
  { message: "Exactly one of 'prompt' or 'command' must be set on each test case" },
);

// ============================================================
// Gates Schema
// ============================================================

const GatesSchema = z.object({
  passRateMin: Score01.default(0.95).describe(
    "Minimum overall pass rate (0-1). Computed after repeats and aggregation.",
  ),
  schemaFailuresMax: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe(
      "Maximum allowed schema validation failures across entire suite",
    ),
  judgeAvgMin: Score01.optional().describe(
    "Minimum average LLM-as-judge score across all criteria and test cases",
  ),
  driftScoreMax: Score01.optional().describe(
    "Maximum allowed drift score against active baseline",
  ),
  piiFailuresMax: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Maximum allowed PII detection failures"),
  keywordFailuresMax: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Maximum allowed keyword guardrail failures"),
  costMaxUsd: z
    .number()
    .positive()
    .optional()
    .describe(
      "Maximum total cost in USD for the entire run. Aborts if exceeded mid-run.",
    ),
  latencyMaxMs: z
    .number()
    .positive()
    .optional()
    .describe(
      "Maximum average latency in ms. Fails gate if exceeded.",
    ),
  deterministicPassRate: Score01.optional().describe(
    "Minimum pass rate for deterministic assertions only (tool_called, schema, pii, keywords, etc.)",
  ),
  probabilisticPassRate: Score01.optional().describe(
    "Minimum pass rate for probabilistic assertions only (judge, drift)",
  ),
});

// ============================================================
// Compliance Schema
// ============================================================

const ComplianceSchema = z.object({
  enabled: z.boolean().default(false),
  framework: z.enum(["eu-ai-act", "custom"]).default("eu-ai-act"),
  outputDir: z.string().default("./compliance-reports"),
  metadata: z
    .object({
      systemName: z
        .string()
        .optional()
        .describe("Name of the AI system being tested"),
      systemVersion: z
        .string()
        .optional()
        .describe("Version of the AI system"),
      riskLevel: z.enum(["high", "limited", "minimal"]).optional(),
      operator: z
        .string()
        .optional()
        .describe("Organization operating the AI system"),
      intendedPurpose: z
        .string()
        .optional()
        .describe(
          "Documented intended purpose of the AI system",
        ),
      dataGovernanceNotes: z.string().optional(),
    })
    .optional(),
});

// ============================================================
// Upload Schema
// ============================================================

const UploadSchema = z.object({
  enabled: z.boolean().default(false),
  includeArtifacts: z
    .boolean()
    .default(false)
    .describe(
      "Upload raw prompt inputs and model outputs. Disabled by default for privacy.",
    ),
  redactPatterns: z
    .array(RegexPattern)
    .optional()
    .describe(
      "Patterns to redact from artifacts before upload (applied on top of PII guardrails)",
    ),
  apiUrl: z
    .string()
    .url()
    .default("https://api.kindlm.com/v1")
    .describe(
      "Cloud API URL. Override for self-hosted deployments.",
    ),
});

// ============================================================
// Suite Schema
// ============================================================

const SuiteSchema = z.object({
  name: NonEmptyString,
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

// ============================================================
// Top-Level Config Schema
// ============================================================

export const KindLMConfigSchema = z.object({
  kindlm: z.literal(1).describe("Config schema version. Must be 1."),
  project: NonEmptyString.describe(
    "Project identifier for cloud upload and report grouping",
  ),
  suite: SuiteSchema,
  providers: ProvidersSchema,
  models: z
    .array(ModelSchema)
    .min(1, "At least one model must be configured"),
  prompts: z
    .record(PromptSchema)
    .refine((prompts) => Object.keys(prompts).length > 0, {
      message: "At least one prompt must be defined",
    }),
  tests: z
    .array(TestCaseSchema)
    .min(1, "At least one test case must be defined"),
  gates: GatesSchema.default({}),
  compliance: ComplianceSchema.optional(),
  trace: TraceConfigSchema.optional().describe(
    "OpenTelemetry trace ingestion configuration for the 'kindlm trace' command",
  ),
  upload: UploadSchema.default({}),
  defaults: z
    .object({
      repeat: z
        .number()
        .int()
        .min(1)
        .default(1)
        .describe("Default repeat count per test case"),
      concurrency: z
        .number()
        .int()
        .min(1)
        .max(32)
        .default(4)
        .describe("Default concurrency for test execution"),
      timeoutMs: z
        .number()
        .int()
        .min(1000)
        .default(60000)
        .describe("Default timeout per provider call in ms"),
      judgeModel: z
        .string()
        .optional()
        .describe(
          "Default model ID for LLM-as-judge assertions. Must reference a configured model.",
        ),
    })
    .default({}),
});

// ============================================================
// Inferred Types
// ============================================================

export type KindLMConfig = z.infer<typeof KindLMConfigSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type Expect = z.infer<typeof ExpectSchema>;
export type ModelConfig = z.infer<typeof ModelSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type GatesConfig = z.infer<typeof GatesSchema>;
export type JudgeCriterion = z.infer<typeof JudgeCriterionSchema>;
export type ToolCallExpect = z.infer<typeof ToolCallExpectSchema>;
export type ToolSimulation = z.infer<typeof ToolSimulationSchema>;
export type ComplianceConfig = z.infer<typeof ComplianceSchema>;

// ============================================================
// Validation
// ============================================================

export function validateConfig(
  raw: unknown,
): Result<KindLMConfig, KindlmError> {
  const result = KindLMConfigSchema.safeParse(raw);
  if (!result.success) {
    return err({
      code: "CONFIG_VALIDATION_ERROR",
      message: "Config validation failed",
      details: {
        errors: result.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      },
    });
  }
  return ok(result.data);
}
