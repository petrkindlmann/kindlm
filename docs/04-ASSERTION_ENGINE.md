# KindLM Assertion Engine

## Overview

The assertion engine evaluates model outputs against configured expectations. Each assertion produces a typed result with a score, pass/fail status, and failure reason code. Results are aggregated across repeat runs, then evaluated against gates to determine the final run status.

---

## Assertion Lifecycle

```
Config (expect) → Assertion Instances → Execute → Results → Aggregate → Gates → Exit Code
```

1. **Parse:** Config `expect` section is parsed into assertion instances
2. **Execute:** Each assertion evaluates the model output independently
3. **Score:** Each assertion produces a score (0-1) and pass/fail
4. **Aggregate:** Multiple runs of the same test case are aggregated
5. **Gate:** Aggregated results are checked against suite-level gates
6. **Report:** Results are formatted for terminal, JSON, JUnit, and compliance

---

## Assertion Interface

```typescript
// packages/core/src/assertions/interface.ts

import type { ProviderResponse, ProviderToolCall } from "../types/provider";

/** Canonical failure reason codes — used in reports, JUnit, and compliance docs */
export type FailureCode =
  | "SCHEMA_INVALID"
  | "SCHEMA_PARSE_ERROR"
  | "PII_DETECTED"
  | "KEYWORD_DENIED"
  | "KEYWORD_MISSING"
  | "CONTAINS_FAILED"
  | "NOT_CONTAINS_FAILED"
  | "MAX_LENGTH_EXCEEDED"
  | "JUDGE_BELOW_THRESHOLD"
  | "TOOL_CALL_MISSING"
  | "TOOL_CALL_UNEXPECTED"
  | "TOOL_CALL_ARGS_MISMATCH"
  | "TOOL_CALL_ORDER_WRONG"
  | "TOOL_CALL_ARGS_SCHEMA_INVALID"
  | "DRIFT_EXCEEDED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_ERROR"
  | "INTERNAL_ERROR";

export interface AssertionResult {
  /** Name of the assertion type (e.g., "schema", "pii", "judge") */
  assertionType: string;
  /** Human-readable label for this specific check */
  label: string;
  /** Whether this assertion passed */
  passed: boolean;
  /** Score from 0 to 1 (1 = perfect) */
  score: number;
  /** Failure code if not passed */
  failureCode?: FailureCode;
  /** Human-readable failure message */
  failureMessage?: string;
  /** Additional metadata (e.g., matched PII patterns, judge reasoning) */
  metadata?: Record<string, unknown>;
}

export interface AssertionContext {
  /** The model's text output */
  outputText: string;
  /** Parsed JSON output (if format=json and parse succeeded) */
  outputJson?: unknown;
  /** Tool calls made by the model */
  toolCalls: ProviderToolCall[];
  /** Baseline output for drift comparison (if baseline exists) */
  baselineText?: string;
  baselineJson?: unknown;
  /** The provider adapter (needed for LLM-as-judge) */
  judgeAdapter?: import("../types/provider").ProviderAdapter;
  /** Judge model name */
  judgeModel?: string;
  /** Config directory (for resolving relative paths) */
  configDir: string;
}

export interface Assertion {
  /** Unique type identifier */
  readonly type: string;
  /** Execute the assertion and return results */
  evaluate(context: AssertionContext): Promise<AssertionResult[]>;
}
```

---

## Built-in Assertions

### 1. JSON Schema Validation

```typescript
// packages/core/src/assertions/schema.ts

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Assertion, AssertionContext, AssertionResult } from "./interface";

export class SchemaAssertion implements Assertion {
  readonly type = "schema";

  constructor(
    private format: "text" | "json",
    private schemaFile?: string,
    private contains?: string[],
    private notContains?: string[],
    private maxLength?: number,
  ) {}

  async evaluate(ctx: AssertionContext): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];

    // --- JSON parse check ---
    if (this.format === "json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(ctx.outputText);
        ctx.outputJson = parsed;
        results.push({
          assertionType: "schema",
          label: "JSON parse",
          passed: true,
          score: 1,
        });
      } catch (err) {
        results.push({
          assertionType: "schema",
          label: "JSON parse",
          passed: false,
          score: 0,
          failureCode: "SCHEMA_PARSE_ERROR",
          failureMessage: `Output is not valid JSON: ${(err as Error).message}`,
          metadata: { outputPreview: ctx.outputText.slice(0, 200) },
        });
        return results; // Can't validate schema if parse failed
      }

      // --- JSON Schema validation ---
      if (this.schemaFile) {
        const schemaPath = resolve(ctx.configDir, this.schemaFile);
        const schemaContent = JSON.parse(readFileSync(schemaPath, "utf-8"));

        const ajv = new Ajv({ allErrors: true, strict: false });
        addFormats(ajv);

        const validate = ajv.compile(schemaContent);
        const valid = validate(parsed);

        if (valid) {
          results.push({
            assertionType: "schema",
            label: `Schema: ${this.schemaFile}`,
            passed: true,
            score: 1,
          });
        } else {
          const errors = validate.errors?.map(
            (e) => `${e.instancePath || "/"}: ${e.message}`
          ) ?? [];
          results.push({
            assertionType: "schema",
            label: `Schema: ${this.schemaFile}`,
            passed: false,
            score: 0,
            failureCode: "SCHEMA_INVALID",
            failureMessage: errors.join("; "),
            metadata: { schemaErrors: validate.errors },
          });
        }
      }
    }

    // --- Contains checks (case-insensitive) ---
    if (this.contains) {
      const lowerOutput = ctx.outputText.toLowerCase();
      for (const substring of this.contains) {
        const found = lowerOutput.includes(substring.toLowerCase());
        results.push({
          assertionType: "schema",
          label: `Contains: "${substring}"`,
          passed: found,
          score: found ? 1 : 0,
          ...(!found && {
            failureCode: "CONTAINS_FAILED" as const,
            failureMessage: `Output does not contain "${substring}"`,
          }),
        });
      }
    }

    // --- NotContains checks (case-insensitive) ---
    if (this.notContains) {
      const lowerOutput = ctx.outputText.toLowerCase();
      for (const substring of this.notContains) {
        const found = lowerOutput.includes(substring.toLowerCase());
        results.push({
          assertionType: "schema",
          label: `Not contains: "${substring}"`,
          passed: !found,
          score: found ? 0 : 1,
          ...(found && {
            failureCode: "NOT_CONTAINS_FAILED" as const,
            failureMessage: `Output contains forbidden substring "${substring}"`,
          }),
        });
      }
    }

    // --- Max length ---
    if (this.maxLength !== undefined) {
      const withinLimit = ctx.outputText.length <= this.maxLength;
      results.push({
        assertionType: "schema",
        label: `Max length: ${this.maxLength}`,
        passed: withinLimit,
        score: withinLimit ? 1 : 0,
        ...(!withinLimit && {
          failureCode: "MAX_LENGTH_EXCEEDED" as const,
          failureMessage: `Output length ${ctx.outputText.length} exceeds max ${this.maxLength}`,
        }),
      });
    }

    return results;
  }
}
```

### 2. PII Detection

```typescript
// packages/core/src/assertions/pii.ts

export class PIIAssertion implements Assertion {
  readonly type = "pii";

  constructor(
    private denyPatterns: string[],
    private customPatterns?: Array<{ name: string; pattern: string }>,
  ) {}

  async evaluate(ctx: AssertionContext): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];
    const allPatterns = [
      ...this.denyPatterns.map((p, i) => ({ name: `pii-pattern-${i}`, pattern: p })),
      ...(this.customPatterns ?? []),
    ];

    for (const { name, pattern } of allPatterns) {
      const regex = new RegExp(pattern, "gi");
      const matches = ctx.outputText.match(regex);

      if (matches && matches.length > 0) {
        results.push({
          assertionType: "pii",
          label: `PII: ${name}`,
          passed: false,
          score: 0,
          failureCode: "PII_DETECTED",
          failureMessage: `Found ${matches.length} PII match(es) for pattern "${name}"`,
          metadata: {
            pattern: name,
            matchCount: matches.length,
            // Redact actual matches in metadata for safety
            redactedMatches: matches.map((m) => m.slice(0, 3) + "***"),
          },
        });
      } else {
        results.push({
          assertionType: "pii",
          label: `PII: ${name}`,
          passed: true,
          score: 1,
        });
      }
    }

    return results;
  }
}
```

### 3. Keyword Guardrails

```typescript
// packages/core/src/assertions/keywords.ts

export class KeywordAssertion implements Assertion {
  readonly type = "keywords";

  constructor(
    private deny: string[],
    private allow?: string[],
  ) {}

  async evaluate(ctx: AssertionContext): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];
    const lowerOutput = ctx.outputText.toLowerCase();

    // Deny list
    for (const keyword of this.deny) {
      const found = lowerOutput.includes(keyword.toLowerCase());
      if (found) {
        results.push({
          assertionType: "keywords",
          label: `Keyword deny: "${keyword}"`,
          passed: false,
          score: 0,
          failureCode: "KEYWORD_DENIED",
          failureMessage: `Output contains denied keyword "${keyword}"`,
        });
      }
    }

    // If no denied keywords found, pass
    if (this.deny.length > 0 && results.length === 0) {
      results.push({
        assertionType: "keywords",
        label: "Keyword deny list",
        passed: true,
        score: 1,
      });
    }

    // Allow list (at least one must be present)
    if (this.allow && this.allow.length > 0) {
      const found = this.allow.some((kw) =>
        lowerOutput.includes(kw.toLowerCase())
      );
      results.push({
        assertionType: "keywords",
        label: "Keyword allow list",
        passed: found,
        score: found ? 1 : 0,
        ...(!found && {
          failureCode: "KEYWORD_MISSING" as const,
          failureMessage: `Output must contain at least one of: ${this.allow.join(", ")}`,
        }),
      });
    }

    return results;
  }
}
```

### 4. LLM-as-Judge

```typescript
// packages/core/src/assertions/judge.ts

export class JudgeAssertion implements Assertion {
  readonly type = "judge";

  constructor(
    private criteria: string,
    private minScore: number,
    private rubric?: string,
  ) {}

  async evaluate(ctx: AssertionContext): Promise<AssertionResult[]> {
    if (!ctx.judgeAdapter || !ctx.judgeModel) {
      return [{
        assertionType: "judge",
        label: `Judge: ${this.criteria}`,
        passed: false,
        score: 0,
        failureCode: "INTERNAL_ERROR",
        failureMessage: "No judge model configured for LLM-as-judge assertions",
      }];
    }

    const judgePrompt = this.buildJudgePrompt(ctx.outputText);

    const response = await ctx.judgeAdapter.complete({
      model: ctx.judgeModel,
      messages: [
        { role: "system", content: JUDGE_SYSTEM_PROMPT },
        { role: "user", content: judgePrompt },
      ],
      params: {
        temperature: 0,
        maxTokens: 512,
      },
    });

    const parsed = this.parseJudgeResponse(response.text);

    return [{
      assertionType: "judge",
      label: `Judge: ${this.criteria}`,
      passed: parsed.score >= this.minScore,
      score: parsed.score,
      ...(parsed.score < this.minScore && {
        failureCode: "JUDGE_BELOW_THRESHOLD" as const,
        failureMessage: `Judge score ${parsed.score.toFixed(2)} below threshold ${this.minScore}`,
      }),
      metadata: {
        reasoning: parsed.reasoning,
        judgeModel: ctx.judgeModel,
        criteria: this.criteria,
      },
    }];
  }

  private buildJudgePrompt(output: string): string {
    const rubricSection = this.rubric
      ? `\n\nRubric:\n${this.rubric}`
      : "";

    return `Evaluate the following AI output against this criterion:

Criterion: ${this.criteria}${rubricSection}

AI Output:
---
${output}
---

Respond with ONLY a JSON object:
{
  "score": <number 0.0 to 1.0>,
  "reasoning": "<brief explanation>"
}`;
  }

  private parseJudgeResponse(text: string): { score: number; reasoning: string } {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
        reasoning: String(parsed.reasoning || ""),
      };
    } catch {
      return { score: 0, reasoning: `Failed to parse judge response: ${text.slice(0, 200)}` };
    }
  }
}

const JUDGE_SYSTEM_PROMPT = `You are an impartial AI output evaluator. Your job is to score an AI system's output against a specific criterion.

Rules:
- Score from 0.0 (completely fails the criterion) to 1.0 (perfectly meets the criterion)
- Be objective and consistent
- Provide brief, specific reasoning
- Respond ONLY with a JSON object containing "score" and "reasoning"
- Do not be lenient — a score of 1.0 means genuinely excellent`;
```

### 5. Tool Call Assertions

```typescript
// packages/core/src/assertions/tool-calls.ts

export class ToolCallAssertion implements Assertion {
  readonly type = "tool-calls";

  constructor(
    private expectations: Array<{
      tool: string;
      shouldNotCall?: boolean;
      argsMatch?: Record<string, unknown>;
      argsSchema?: string;
      order?: number;
    }>,
  ) {}

  async evaluate(ctx: AssertionContext): Promise<AssertionResult[]> {
    const results: AssertionResult[] = [];

    for (const expect of this.expectations) {
      const matchingCalls = ctx.toolCalls.filter((tc) => tc.name === expect.tool);

      // --- shouldNotCall ---
      if (expect.shouldNotCall) {
        const passed = matchingCalls.length === 0;
        results.push({
          assertionType: "tool-calls",
          label: `Tool NOT called: ${expect.tool}`,
          passed,
          score: passed ? 1 : 0,
          ...(!passed && {
            failureCode: "TOOL_CALL_UNEXPECTED",
            failureMessage: `Tool "${expect.tool}" was called ${matchingCalls.length} time(s) but should not have been`,
          }),
        });
        continue;
      }

      // --- Tool was called ---
      if (matchingCalls.length === 0) {
        results.push({
          assertionType: "tool-calls",
          label: `Tool called: ${expect.tool}`,
          passed: false,
          score: 0,
          failureCode: "TOOL_CALL_MISSING",
          failureMessage: `Expected tool "${expect.tool}" was never called. Called: ${
            ctx.toolCalls.map((tc) => tc.name).join(", ") || "(none)"
          }`,
        });
        continue;
      }

      results.push({
        assertionType: "tool-calls",
        label: `Tool called: ${expect.tool}`,
        passed: true,
        score: 1,
      });

      // --- Argument matching ---
      if (expect.argsMatch) {
        const call = matchingCalls[0]; // Check first matching call
        const mismatches: string[] = [];

        for (const [key, expectedValue] of Object.entries(expect.argsMatch)) {
          const actualValue = call.arguments[key];
          if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
            mismatches.push(
              `${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
            );
          }
        }

        const passed = mismatches.length === 0;
        results.push({
          assertionType: "tool-calls",
          label: `Tool args: ${expect.tool}`,
          passed,
          score: passed ? 1 : 0,
          ...(!passed && {
            failureCode: "TOOL_CALL_ARGS_MISMATCH",
            failureMessage: `Argument mismatches: ${mismatches.join("; ")}`,
            metadata: { mismatches, actualArgs: call.arguments },
          }),
        });
      }

      // --- Order check ---
      if (expect.order !== undefined) {
        const actualIndex = ctx.toolCalls.findIndex((tc) => tc.name === expect.tool);
        const passed = actualIndex === expect.order;
        results.push({
          assertionType: "tool-calls",
          label: `Tool order: ${expect.tool} at position ${expect.order}`,
          passed,
          score: passed ? 1 : 0,
          ...(!passed && {
            failureCode: "TOOL_CALL_ORDER_WRONG",
            failureMessage: `Expected "${expect.tool}" at position ${expect.order}, found at ${actualIndex}`,
          }),
        });
      }
    }

    return results;
  }
}
```

### 6. Baseline Drift

```typescript
// packages/core/src/assertions/drift.ts

export class DriftAssertion implements Assertion {
  readonly type = "drift";

  constructor(
    private maxScore: number,
    private method: "judge" | "embedding" | "field-diff",
    private fields?: string[],
  ) {}

  async evaluate(ctx: AssertionContext): Promise<AssertionResult[]> {
    if (!ctx.baselineText) {
      return [{
        assertionType: "drift",
        label: "Baseline drift",
        passed: true,
        score: 1,
        metadata: { reason: "No baseline available — skipping drift check" },
      }];
    }

    switch (this.method) {
      case "judge":
        return this.evaluateWithJudge(ctx);
      case "field-diff":
        return this.evaluateFieldDiff(ctx);
      case "embedding":
        return this.evaluateEmbedding(ctx);
    }
  }

  private async evaluateWithJudge(ctx: AssertionContext): Promise<AssertionResult[]> {
    if (!ctx.judgeAdapter || !ctx.judgeModel) {
      return [{ assertionType: "drift", label: "Drift (judge)", passed: false, score: 0,
        failureCode: "INTERNAL_ERROR", failureMessage: "No judge model for drift comparison" }];
    }

    const response = await ctx.judgeAdapter.complete({
      model: ctx.judgeModel,
      messages: [
        { role: "system", content: DRIFT_JUDGE_SYSTEM },
        { role: "user", content: `Baseline output:\n---\n${ctx.baselineText}\n---\n\nCurrent output:\n---\n${ctx.outputText}\n---` },
      ],
      params: { temperature: 0, maxTokens: 512 },
    });

    const parsed = this.parseDriftResponse(response.text);
    const passed = parsed.driftScore <= this.maxScore;

    return [{
      assertionType: "drift",
      label: "Baseline drift (judge)",
      passed,
      score: 1 - parsed.driftScore, // Invert: higher score = less drift = better
      ...(!passed && {
        failureCode: "DRIFT_EXCEEDED",
        failureMessage: `Drift score ${parsed.driftScore.toFixed(3)} exceeds max ${this.maxScore}`,
      }),
      metadata: { driftScore: parsed.driftScore, reasoning: parsed.reasoning, method: "judge" },
    }];
  }

  private evaluateFieldDiff(ctx: AssertionContext): Promise<AssertionResult[]> {
    // Compare specific JSON fields between baseline and current
    // Returns per-field drift results
    // Implementation uses deep equality + Levenshtein for string fields
    // ...
  }

  private evaluateEmbedding(ctx: AssertionContext): Promise<AssertionResult[]> {
    // Cosine similarity between embeddings
    // Falls back to judge if embedding provider not available
    // ...
  }
}

const DRIFT_JUDGE_SYSTEM = `You compare two AI outputs and score their semantic drift.
A drift score of 0.0 means the outputs are semantically identical.
A drift score of 1.0 means the outputs are completely different in meaning.

Focus on:
- Same factual content conveyed?
- Same actions taken (tool calls, decisions)?
- Same tone and professionalism?
- Same structure and format?

Minor wording changes = low drift. Different conclusions or missing information = high drift.

Respond ONLY with JSON: { "driftScore": <0.0-1.0>, "reasoning": "<brief explanation>" }`;
```

---

## Aggregation

```typescript
// packages/core/src/engine/aggregator.ts

import type { AssertionResult } from "../assertions/interface";

export interface TestCaseRunResult {
  testCaseName: string;
  modelId: string;
  runIndex: number;
  outputText: string;
  assertions: AssertionResult[];
  latencyMs: number;
  tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  costEstimateUsd: number | null;
}

export interface AggregatedTestResult {
  testCaseName: string;
  modelId: string;
  runCount: number;
  /** true if pass rate across runs meets threshold */
  passed: boolean;
  passRate: number;
  /** Per-assertion aggregated scores (mean across runs) */
  assertionScores: Record<string, { mean: number; min: number; max: number }>;
  /** Unique failure codes across all runs */
  failureCodes: string[];
  /** Average latency */
  latencyAvgMs: number;
  /** Total cost across all runs */
  totalCostUsd: number;
  /** Total tokens across all runs */
  totalTokens: number;
  /** Individual run results (for detailed reports) */
  runs: TestCaseRunResult[];
}

/**
 * Aggregate multiple runs of the same test case + model into a single result.
 */
export function aggregateRuns(runs: TestCaseRunResult[]): AggregatedTestResult {
  if (runs.length === 0) throw new Error("Cannot aggregate zero runs");

  const { testCaseName, modelId } = runs[0];

  // A single run passes if ALL its assertions pass
  const runPassStates = runs.map((run) =>
    run.assertions.every((a) => a.passed)
  );
  const passRate = runPassStates.filter(Boolean).length / runs.length;

  // Aggregate assertion scores by label
  const scoresByLabel = new Map<string, number[]>();
  for (const run of runs) {
    for (const assertion of run.assertions) {
      const key = `${assertion.assertionType}:${assertion.label}`;
      if (!scoresByLabel.has(key)) scoresByLabel.set(key, []);
      scoresByLabel.get(key)!.push(assertion.score);
    }
  }

  const assertionScores: Record<string, { mean: number; min: number; max: number }> = {};
  for (const [key, scores] of scoresByLabel) {
    assertionScores[key] = {
      mean: scores.reduce((a, b) => a + b, 0) / scores.length,
      min: Math.min(...scores),
      max: Math.max(...scores),
    };
  }

  // Collect unique failure codes
  const failureCodes = [
    ...new Set(
      runs.flatMap((r) =>
        r.assertions
          .filter((a) => !a.passed && a.failureCode)
          .map((a) => a.failureCode!)
      )
    ),
  ];

  return {
    testCaseName,
    modelId,
    runCount: runs.length,
    passed: passRate >= 1.0, // Default: all runs must pass. Gates can override.
    passRate,
    assertionScores,
    failureCodes,
    latencyAvgMs: runs.reduce((sum, r) => sum + r.latencyMs, 0) / runs.length,
    totalCostUsd: runs.reduce((sum, r) => sum + (r.costEstimateUsd ?? 0), 0),
    totalTokens: runs.reduce(
      (sum, r) => sum + r.tokenUsage.totalTokens, 0
    ),
    runs,
  };
}
```

---

## Gate Evaluation

```typescript
// packages/core/src/engine/gate.ts

import type { GatesConfig } from "../types/config";
import type { AggregatedTestResult } from "./aggregator";

export interface GateResult {
  gateName: string;
  passed: boolean;
  actual: number;
  threshold: number;
  message: string;
}

export interface GateEvaluation {
  passed: boolean;
  gates: GateResult[];
}

export function evaluateGates(
  config: GatesConfig,
  results: AggregatedTestResult[],
): GateEvaluation {
  const gates: GateResult[] = [];

  // --- Pass rate ---
  const totalPassed = results.filter((r) => r.passed).length;
  const passRate = results.length > 0 ? totalPassed / results.length : 0;
  gates.push({
    gateName: "passRateMin",
    passed: passRate >= config.passRateMin,
    actual: passRate,
    threshold: config.passRateMin,
    message: `Pass rate: ${(passRate * 100).toFixed(1)}% (min: ${(config.passRateMin * 100).toFixed(1)}%)`,
  });

  // --- Schema failures ---
  const schemaFails = results.reduce(
    (sum, r) => sum + r.failureCodes.filter((c) => c.startsWith("SCHEMA_")).length, 0
  );
  gates.push({
    gateName: "schemaFailuresMax",
    passed: schemaFails <= config.schemaFailuresMax,
    actual: schemaFails,
    threshold: config.schemaFailuresMax,
    message: `Schema failures: ${schemaFails} (max: ${config.schemaFailuresMax})`,
  });

  // --- PII failures ---
  const piiFails = results.reduce(
    (sum, r) => sum + (r.failureCodes.includes("PII_DETECTED") ? 1 : 0), 0
  );
  gates.push({
    gateName: "piiFailuresMax",
    passed: piiFails <= config.piiFailuresMax,
    actual: piiFails,
    threshold: config.piiFailuresMax,
    message: `PII failures: ${piiFails} (max: ${config.piiFailuresMax})`,
  });

  // --- Judge average ---
  if (config.judgeAvgMin !== undefined) {
    const judgeScores = results.flatMap((r) =>
      Object.entries(r.assertionScores)
        .filter(([key]) => key.startsWith("judge:"))
        .map(([, v]) => v.mean)
    );
    const judgeAvg = judgeScores.length > 0
      ? judgeScores.reduce((a, b) => a + b, 0) / judgeScores.length
      : 1;
    gates.push({
      gateName: "judgeAvgMin",
      passed: judgeAvg >= config.judgeAvgMin,
      actual: judgeAvg,
      threshold: config.judgeAvgMin,
      message: `Judge avg: ${(judgeAvg * 100).toFixed(1)}% (min: ${(config.judgeAvgMin * 100).toFixed(1)}%)`,
    });
  }

  // --- Drift score ---
  if (config.driftScoreMax !== undefined) {
    const driftScores = results.flatMap((r) =>
      Object.entries(r.assertionScores)
        .filter(([key]) => key.startsWith("drift:"))
        .map(([, v]) => 1 - v.mean) // Invert: assertion score is 1-drift
    );
    const maxDrift = driftScores.length > 0 ? Math.max(...driftScores) : 0;
    gates.push({
      gateName: "driftScoreMax",
      passed: maxDrift <= config.driftScoreMax,
      actual: maxDrift,
      threshold: config.driftScoreMax,
      message: `Drift score: ${maxDrift.toFixed(3)} (max: ${config.driftScoreMax})`,
    });
  }

  return {
    passed: gates.every((g) => g.passed),
    gates,
  };
}
```

### Deterministic vs Probabilistic Gates

Assertions are classified into two categories:

| Category | Assertion Types |
|----------|----------------|
| **Deterministic** | tool_called, tool_not_called, tool_order, schema, pii, keywords_present, keywords_absent, contains, not_contains, max_length, latency, cost |
| **Probabilistic** | judge, drift |

Two optional gate fields allow separate pass-rate thresholds for each category:

```yaml
gates:
  passRateMin: 0.90           # Overall minimum
  deterministicPassRate: 0.99  # Stricter for deterministic checks
  probabilisticPassRate: 0.75  # Looser for LLM-scored checks
```

**Why split?** Deterministic assertions (schema validation, tool calls) should almost never fail — a 1% failure rate indicates a real bug. Probabilistic assertions (LLM-as-judge, drift) have inherent variance and benefit from a separate, more lenient threshold.

The classification is implemented in `packages/core/src/assertions/classification.ts`:

```typescript
import { classifyAssertion, isDeterministic, isProbabilistic } from "@kindlm/core";

classifyAssertion("schema");  // "deterministic"
classifyAssertion("judge");   // "probabilistic"
classifyAssertion("unknown"); // "deterministic" (default)
```

Pass rates are computed per-assertion across all runs, not per-test. If no assertions of a given category exist, the gate passes by default (rate = 1.0).

---

## Exit Code Mapping

| Exit Code | Meaning |
|-----------|---------|
| 0 | All gates passed |
| 1 | One or more gates failed |
| 2 | Config invalid (parse or validation error) |
| 3 | Provider error (auth, network, timeout) |
| 4 | Internal error (unexpected exception) |
