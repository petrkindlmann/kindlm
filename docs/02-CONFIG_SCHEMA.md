# KindLM Config Schema v1

## Overview

KindLM test suites are defined in `kindlm.yaml` files. The config schema is validated at parse time using Zod, providing clear error messages for invalid configs before any provider calls are made.

**Config version:** `kindlm: 1`  
**File format:** YAML (parsed with `yaml` npm package)  
**Validation:** Zod strict mode (unknown keys rejected)

---

## Complete Zod Schema

```typescript
// packages/core/src/config/schema.ts

import { z } from "zod";

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
  { message: "Must be a valid regex pattern" }
);

// ============================================================
// Provider Schemas
// ============================================================

const ProviderConfigSchema = z.object({
  apiKeyEnv: NonEmptyString.describe(
    "Environment variable name containing the API key. Never a raw key."
  ),
  baseUrl: z.string().url().optional().describe(
    "Custom base URL for API-compatible proxies (e.g., Azure OpenAI, LiteLLM)"
  ),
  organization: z.string().optional().describe(
    "Organization ID (OpenAI-specific)"
  ),
});

const ProvidersSchema = z.object({
  openai: ProviderConfigSchema.optional(),
  anthropic: ProviderConfigSchema.optional(),
  // Extensible: add more providers here
}).refine(
  (providers) => Object.keys(providers).some((k) => providers[k as keyof typeof providers] !== undefined),
  { message: "At least one provider must be configured" }
);

// ============================================================
// Model Schema
// ============================================================

const ModelParamsSchema = z.object({
  temperature: Temperature,
  maxTokens: z.number().int().min(1).max(128000).default(1024),
  topP: z.number().min(0).max(1).optional(),
  stopSequences: z.array(z.string()).optional(),
  seed: z.number().int().optional().describe(
    "Seed for reproducibility (provider-dependent support)"
  ),
});

const ModelSchema = z.object({
  id: NonEmptyString.describe(
    "Unique identifier for this model config, referenced in reports"
  ),
  provider: z.enum(["openai", "anthropic"]).describe(
    "Must match a key in the providers section"
  ),
  model: NonEmptyString.describe(
    "Model name as the provider expects it (e.g., 'gpt-4o', 'claude-sonnet-4-5-20250929')"
  ),
  params: ModelParamsSchema.default({}),
});

// ============================================================
// Prompt Schema
// ============================================================

const PromptSchema = z.object({
  system: z.string().optional().describe(
    "System prompt template. Supports {{variable}} interpolation."
  ),
  user: NonEmptyString.describe(
    "User prompt template. Supports {{variable}} interpolation."
  ),
  assistant: z.string().optional().describe(
    "Prefill for assistant response (Anthropic-specific)"
  ),
});

// ============================================================
// Assertion Schemas
// ============================================================

// --- Output format + schema ---
const OutputExpectSchema = z.object({
  format: z.enum(["text", "json"]).default("text"),
  schemaFile: z.string().optional().describe(
    "Path to JSON Schema file (relative to config file). Required if format is 'json'."
  ),
  contains: z.array(z.string()).optional().describe(
    "Output must contain all of these substrings"
  ),
  notContains: z.array(z.string()).optional().describe(
    "Output must not contain any of these substrings"
  ),
  maxLength: z.number().int().positive().optional().describe(
    "Maximum character length of the output"
  ),
}).refine(
  (output) => {
    if (output.format === "json" && !output.schemaFile) {
      return false;
    }
    return true;
  },
  { message: "schemaFile is required when format is 'json'" }
);

// --- PII guardrail ---
const PIIGuardrailSchema = z.object({
  enabled: z.boolean().default(true),
  denyPatterns: z.array(RegexPattern).default([
    "\\b\\d{3}-\\d{2}-\\d{4}\\b",           // US SSN
    "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b", // Credit card
    "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b", // Email
  ]).describe(
    "Regex patterns that must NOT appear in output. Defaults include SSN, credit card, email."
  ),
  customPatterns: z.array(
    z.object({
      name: NonEmptyString,
      pattern: RegexPattern,
    })
  ).optional().describe(
    "Named custom PII patterns for reporting clarity"
  ),
});

// --- Keyword guardrail ---
const KeywordGuardrailSchema = z.object({
  deny: z.array(z.string()).default([]).describe(
    "Words/phrases that must NOT appear in output (case-insensitive)"
  ),
  allow: z.array(z.string()).optional().describe(
    "If set, output MUST contain at least one of these words/phrases"
  ),
});

// --- LLM-as-judge ---
const JudgeCriterionSchema = z.object({
  criteria: NonEmptyString.describe(
    "Natural language description of what to evaluate (e.g., 'Response is empathetic and professional')"
  ),
  minScore: Score01.default(0.7).describe(
    "Minimum score (0-1) for this criterion to pass"
  ),
  model: z.string().optional().describe(
    "Override judge model for this criterion. Defaults to first model in models list."
  ),
  rubric: z.string().optional().describe(
    "Detailed rubric for the judge. If omitted, a default rubric is generated from criteria."
  ),
});

// --- Tool call assertions ---
const ToolCallExpectSchema = z.object({
  tool: NonEmptyString.describe(
    "Expected tool/function name"
  ),
  shouldNotCall: z.boolean().optional().default(false).describe(
    "If true, assert this tool was NOT called"
  ),
  argsMatch: z.record(z.unknown()).optional().describe(
    "Key-value pairs that must be present in the tool call arguments (partial match)"
  ),
  argsSchema: z.string().optional().describe(
    "Path to JSON Schema file to validate the tool call arguments"
  ),
  order: z.number().int().min(0).optional().describe(
    "Expected position in the sequence of tool calls (0-indexed)"
  ),
  responseContains: z.string().optional().describe(
    "Assert the simulated tool response contains this substring"
  ),
});

// --- Baseline drift ---
const BaselineDriftSchema = z.object({
  maxScore: Score01.default(0.15).describe(
    "Maximum drift score (0-1). Higher = more drift allowed. Fail if exceeded."
  ),
  method: z.enum(["judge", "embedding", "field-diff"]).default("judge").describe(
    "Drift detection method. 'judge' uses LLM comparison, 'embedding' uses cosine similarity, 'field-diff' compares JSON fields."
  ),
  fields: z.array(z.string()).optional().describe(
    "For field-diff method: JSON paths to compare (e.g., ['response.action', 'response.message'])"
  ),
});

// --- Combined guardrails ---
const GuardrailsSchema = z.object({
  pii: PIIGuardrailSchema.optional(),
  keywords: KeywordGuardrailSchema.optional(),
});

// --- Combined expect ---
const ExpectSchema = z.object({
  output: OutputExpectSchema.optional(),
  guardrails: GuardrailsSchema.optional(),
  judge: z.array(JudgeCriterionSchema).optional().describe(
    "LLM-as-judge evaluations. Each criterion is scored independently."
  ),
  toolCalls: z.array(ToolCallExpectSchema).optional().describe(
    "Expected tool/function calls in the model response"
  ),
  baseline: z.object({
    drift: BaselineDriftSchema.optional(),
  }).optional(),
});

// ============================================================
// Tool Simulation Schema (for agent testing)
// ============================================================

const ToolSimulationSchema = z.object({
  name: NonEmptyString.describe("Tool/function name as the model sees it"),
  description: z.string().optional().describe("Tool description for documentation"),
  parameters: z.record(z.unknown()).optional().describe(
    "JSON Schema for the tool's parameters"
  ),
  responses: z.array(
    z.object({
      when: z.record(z.unknown()).describe(
        "Condition: match tool call arguments (partial match)"
      ),
      then: z.unknown().describe(
        "Simulated response to return when condition matches"
      ),
    })
  ).optional().describe(
    "Simulated responses based on argument matching"
  ),
  defaultResponse: z.unknown().optional().describe(
    "Response when no 'when' condition matches"
  ),
});

// ============================================================
// Test Case Schema
// ============================================================

const TestCaseSchema = z.object({
  name: NonEmptyString.describe(
    "Unique test case name within the suite. Used in reports and JUnit output."
  ),
  prompt: NonEmptyString.optional().describe(
    "Reference to a key in the prompts section"
  ),
  command: NonEmptyString.optional().describe(
    "Shell command to execute as the test input (mutually exclusive with prompt)"
  ),
  vars: z.record(z.string()).default({}).describe(
    "Variables to interpolate into the prompt template"
  ),
  models: z.array(z.string()).optional().describe(
    "Override: run this test only against these model IDs. Defaults to all models."
  ),
  repeat: z.number().int().min(1).optional().describe(
    "Override: number of repeat runs for this specific test case"
  ),
  tools: z.array(ToolSimulationSchema).optional().describe(
    "Simulated tools available to the model for this test case"
  ),
  expect: ExpectSchema.describe(
    "Assertions to evaluate against the model output"
  ),
  tags: z.array(z.string()).optional().describe(
    "Tags for filtering test cases in CLI (e.g., --tags regression)"
  ),
  skip: z.boolean().optional().default(false).describe(
    "Skip this test case during execution"
  ),
}).refine(
  (tc) => (tc.prompt !== undefined) !== (tc.command !== undefined),
  { message: "Exactly one of 'prompt' or 'command' must be set" }
);

// ============================================================
// Gates Schema
// ============================================================

const GatesSchema = z.object({
  passRateMin: Score01.default(0.95).describe(
    "Minimum overall pass rate (0-1). Computed after repeats and aggregation."
  ),
  schemaFailuresMax: z.number().int().min(0).default(0).describe(
    "Maximum allowed schema validation failures across entire suite"
  ),
  judgeAvgMin: Score01.optional().describe(
    "Minimum average LLM-as-judge score across all criteria and test cases"
  ),
  driftScoreMax: Score01.optional().describe(
    "Maximum allowed drift score against active baseline"
  ),
  piiFailuresMax: z.number().int().min(0).default(0).describe(
    "Maximum allowed PII detection failures"
  ),
  keywordFailuresMax: z.number().int().min(0).default(0).describe(
    "Maximum allowed keyword guardrail failures"
  ),
  costMaxUsd: z.number().positive().optional().describe(
    "Maximum total cost in USD for the entire run. Aborts if exceeded mid-run."
  ),
  latencyMaxMs: z.number().positive().optional().describe(
    "Maximum average latency in ms. Fails gate if exceeded."
  ),
  deterministicPassRate: Score01.optional().describe(
    "Minimum pass rate for deterministic assertions (tool_called, schema, pii, keywords, etc.)"
  ),
  probabilisticPassRate: Score01.optional().describe(
    "Minimum pass rate for probabilistic assertions (judge, drift)"
  ),
});

// ============================================================
// Compliance Schema
// ============================================================

const ComplianceSchema = z.object({
  enabled: z.boolean().default(false),
  framework: z.enum(["eu-ai-act", "custom"]).default("eu-ai-act"),
  outputDir: z.string().default("./compliance-reports"),
  metadata: z.object({
    systemName: z.string().optional().describe("Name of the AI system being tested"),
    systemVersion: z.string().optional().describe("Version of the AI system"),
    riskLevel: z.enum(["high", "limited", "minimal"]).optional(),
    operator: z.string().optional().describe("Organization operating the AI system"),
    intendedPurpose: z.string().optional().describe("Documented intended purpose of the AI system"),
    dataGovernanceNotes: z.string().optional(),
  }).optional(),
});

// ============================================================
// Upload Schema
// ============================================================

const UploadSchema = z.object({
  enabled: z.boolean().default(false),
  includeArtifacts: z.boolean().default(false).describe(
    "Upload raw prompt inputs and model outputs. Disabled by default for privacy."
  ),
  redactPatterns: z.array(RegexPattern).optional().describe(
    "Patterns to redact from artifacts before upload (applied on top of PII guardrails)"
  ),
  apiUrl: z.string().url().default("https://api.kindlm.com/v1").describe(
    "Cloud API URL. Override for self-hosted deployments."
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
  project: NonEmptyString.describe("Project identifier for cloud upload and report grouping"),
  suite: SuiteSchema,
  providers: ProvidersSchema,
  models: z.array(ModelSchema).min(1, "At least one model must be configured"),
  prompts: z.record(PromptSchema).refine(
    (prompts) => Object.keys(prompts).length > 0,
    { message: "At least one prompt must be defined" }
  ),
  tests: z.array(TestCaseSchema).min(1, "At least one test case must be defined"),
  gates: GatesSchema.default({}),
  compliance: ComplianceSchema.optional(),
  trace: TraceConfigSchema.optional().describe(
    "OpenTelemetry trace ingestion configuration for the 'kindlm trace' command"
  ),
  upload: UploadSchema.default({}),
  defaults: z.object({
    repeat: z.number().int().min(1).default(1).describe("Default repeat count per test case"),
    concurrency: z.number().int().min(1).max(32).default(4).describe("Default concurrency for test execution"),
    timeoutMs: z.number().int().min(1000).default(60000).describe("Default timeout per provider call in ms"),
    judgeModel: z.string().optional().describe(
      "Default model ID for LLM-as-judge assertions. Must reference a configured model."
    ),
  }).default({}),
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
```

---

## Config Parser

```typescript
// packages/core/src/config/parser.ts

import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import { resolve, dirname } from "path";
import { KindLMConfigSchema, type KindLMConfig } from "./schema";

export interface ParseResult {
  success: true;
  config: KindLMConfig;
  configHash: string;
} | {
  success: false;
  errors: string[];
}

export function parseConfig(filePath: string): ParseResult {
  const absolutePath = resolve(filePath);
  const configDir = dirname(absolutePath);

  // Step 1: Read and parse YAML
  let raw: unknown;
  try {
    const content = readFileSync(absolutePath, "utf-8");
    raw = parseYaml(content);
  } catch (err) {
    return {
      success: false,
      errors: [`Failed to read or parse YAML: ${(err as Error).message}`],
    };
  }

  // Step 2: Validate against Zod schema
  const result = KindLMConfigSchema.safeParse(raw);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      ),
    };
  }

  const config = result.data;

  // Step 3: Cross-reference validation
  const crossErrors: string[] = [];

  // Verify all test.prompt references exist
  for (const test of config.tests) {
    if (test.prompt && !(test.prompt in config.prompts)) {
      crossErrors.push(
        `Test "${test.name}" references prompt "${test.prompt}" which is not defined`
      );
    }
  }

  // Verify all test.models references exist
  const modelIds = new Set(config.models.map((m) => m.id));
  for (const test of config.tests) {
    if (test.models) {
      for (const modelId of test.models) {
        if (!modelIds.has(modelId)) {
          crossErrors.push(
            `Test "${test.name}" references model "${modelId}" which is not configured`
          );
        }
      }
    }
  }

  // Verify all model.provider references exist
  for (const model of config.models) {
    if (!config.providers[model.provider as keyof typeof config.providers]) {
      crossErrors.push(
        `Model "${model.id}" references provider "${model.provider}" which is not configured`
      );
    }
  }

  // Verify judgeModel references a valid model
  if (config.defaults.judgeModel && !modelIds.has(config.defaults.judgeModel)) {
    crossErrors.push(
      `defaults.judgeModel "${config.defaults.judgeModel}" is not a configured model`
    );
  }

  // Verify schemaFile paths exist (relative to config file)
  for (const test of config.tests) {
    if (test.expect.output?.schemaFile) {
      const schemaPath = resolve(configDir, test.expect.output.schemaFile);
      try {
        readFileSync(schemaPath, "utf-8");
      } catch {
        crossErrors.push(
          `Test "${test.name}": schemaFile "${test.expect.output.schemaFile}" not found at ${schemaPath}`
        );
      }
    }
  }

  if (crossErrors.length > 0) {
    return { success: false, errors: crossErrors };
  }

  // Step 4: Compute config hash for cache/comparison
  const { createHash } = require("crypto");
  const configHash = createHash("sha256")
    .update(JSON.stringify(config))
    .digest("hex")
    .slice(0, 12);

  return { success: true, config, configHash };
}
```

---

## Variable Interpolation

```typescript
// packages/core/src/config/interpolation.ts

/**
 * Interpolates {{variable}} placeholders in a template string.
 * Throws on missing variables (strict mode — no silent empty strings).
 */
export function interpolate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in vars)) {
      throw new Error(
        `Missing variable "{{${key}}}" in template. Available: ${Object.keys(vars).join(", ") || "(none)"}`
      );
    }
    return vars[key];
  });
}

/**
 * Validates that all {{variables}} in a prompt have matching vars.
 * Returns list of missing variable names.
 */
export function findMissingVars(
  template: string,
  vars: Record<string, string>
): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const missing: string[] = [];
  for (const match of matches) {
    if (!(match[1] in vars)) {
      missing.push(match[1]);
    }
  }
  return [...new Set(missing)];
}
```

---

## Full YAML Example

```yaml
kindlm: 1
project: "acme-support"

suite:
  name: "support-agent-regression"
  description: "Regression suite for customer support agent with tool calls"
  tags: ["support", "agent", "regression"]

providers:
  anthropic:
    apiKeyEnv: "ANTHROPIC_API_KEY"
  openai:
    apiKeyEnv: "OPENAI_API_KEY"

models:
  - id: "claude-sonnet"
    provider: "anthropic"
    model: "claude-sonnet-4-5-20250929"
    params:
      temperature: 0.2
      maxTokens: 1024
  - id: "gpt-4o"
    provider: "openai"
    model: "gpt-4o"
    params:
      temperature: 0.2
      maxTokens: 1024

prompts:
  support_agent:
    system: |
      You are a customer support agent for ACME Corp.
      You have access to the following tools:
      - lookup_order(order_id: string) → order details JSON
      - issue_refund(order_id: string, amount: number, reason: string) → confirmation
      - escalate_to_human(reason: string) → ticket number

      Rules:
      - Always look up the order before issuing a refund
      - Never refund more than the order total
      - Escalate if the customer is threatening legal action
      - Respond in valid JSON matching the support_response schema
    user: |
      Customer message: {{message}}

tests:
  # --- Happy path: straightforward refund ---
  - name: "refund-double-charge"
    prompt: "support_agent"
    vars:
      message: "I was charged twice for order #ORD-1234. Please refund the duplicate."
    tools:
      - name: "lookup_order"
        responses:
          - when: { order_id: "ORD-1234" }
            then:
              order_id: "ORD-1234"
              total: 49.99
              status: "delivered"
              charges: [49.99, 49.99]
      - name: "issue_refund"
        defaultResponse:
          success: true
          refund_id: "REF-5678"
      - name: "escalate_to_human"
        defaultResponse:
          ticket: "TKT-0001"
    expect:
      output:
        format: "json"
        schemaFile: "./schemas/support_response.schema.json"
      toolCalls:
        - tool: "lookup_order"
          argsMatch:
            order_id: "ORD-1234"
          order: 0
        - tool: "issue_refund"
          argsMatch:
            order_id: "ORD-1234"
        - tool: "escalate_to_human"
          shouldNotCall: true
      guardrails:
        pii:
          enabled: true
        keywords:
          deny: ["not my problem", "tough luck", "deal with it"]
      judge:
        - criteria: "Response acknowledges the double charge and confirms refund action"
          minScore: 0.9
        - criteria: "Tone is empathetic and professional"
          minScore: 0.8
      baseline:
        drift:
          maxScore: 0.15
          method: "judge"

  # --- Edge case: order not found ---
  - name: "refund-order-not-found"
    prompt: "support_agent"
    vars:
      message: "Please refund order #FAKE-9999"
    tools:
      - name: "lookup_order"
        responses:
          - when: { order_id: "FAKE-9999" }
            then: { error: "Order not found" }
      - name: "issue_refund"
        defaultResponse: { success: true }
    expect:
      toolCalls:
        - tool: "lookup_order"
          argsMatch:
            order_id: "FAKE-9999"
        - tool: "issue_refund"
          shouldNotCall: true
      judge:
        - criteria: "Agent explains the order could not be found and does NOT issue a refund"
          minScore: 0.9
        - criteria: "Agent offers alternative help or asks for correct order number"
          minScore: 0.7

  # --- Guardrail: legal escalation ---
  - name: "escalation-legal-threat"
    prompt: "support_agent"
    vars:
      message: "This is the third time I'm asking. If you don't refund me I'm calling my lawyer."
    tools:
      - name: "lookup_order"
        defaultResponse: { order_id: "ORD-0000", total: 99.99, status: "delivered" }
      - name: "escalate_to_human"
        defaultResponse: { ticket: "TKT-0002" }
    expect:
      toolCalls:
        - tool: "escalate_to_human"
      judge:
        - criteria: "Agent correctly escalates to a human agent due to legal threat"
          minScore: 0.9
        - criteria: "Agent remains calm and does not become adversarial"
          minScore: 0.9

  # --- Simple text output test (no tools) ---
  - name: "greeting-response"
    prompt: "support_agent"
    vars:
      message: "Hi, I just have a quick question"
    expect:
      output:
        format: "text"
        notContains: ["error", "exception", "undefined"]
      guardrails:
        pii:
          enabled: true
      judge:
        - criteria: "Response is a friendly greeting that asks how to help"
          minScore: 0.8
    tags: ["smoke"]

gates:
  passRateMin: 0.95
  schemaFailuresMax: 0
  judgeAvgMin: 0.8
  driftScoreMax: 0.15
  piiFailuresMax: 0
  # deterministicPassRate: 0.99   # Minimum pass rate for deterministic assertions
  # probabilisticPassRate: 0.80   # Minimum pass rate for probabilistic assertions

defaults:
  repeat: 3
  concurrency: 4
  timeoutMs: 30000
  judgeModel: "claude-sonnet"

compliance:
  enabled: true
  framework: "eu-ai-act"
  outputDir: "./compliance-reports"
  metadata:
    systemName: "ACME Customer Support Agent"
    systemVersion: "2.1.0"
    riskLevel: "limited"
    operator: "ACME Corp"
    intendedPurpose: "Automated customer support for order inquiries and refund processing"

# trace:                          # OpenTelemetry trace ingestion configuration
#   endpoint: "http://localhost:4318/v1/traces"
#   headers:
#     Authorization: "Bearer ${OTEL_TOKEN}"

upload:
  enabled: false
```
