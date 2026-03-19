import type { Assertion } from "./interface.js";
import type { Expect } from "../types/config.js";
import {
  createToolCalledAssertion,
  createToolNotCalledAssertion,
  createToolOrderAssertion,
} from "./tool-calls.js";
import { createSchemaAssertion } from "./schema.js";
import { createPiiAssertion } from "./pii.js";
import {
  createKeywordsPresentAssertion,
  createKeywordsAbsentAssertion,
} from "./keywords.js";
import { createJudgeAssertion } from "./judge.js";
import { createDriftAssertion } from "./drift.js";
import { createLatencyAssertion } from "./latency.js";
import { createCostAssertion } from "./cost.js";

export type AssertionFactory = (config: Expect) => Assertion;

export interface AssertionOverrides {
  schemaContent?: Record<string, unknown>;
}

export function createAssertionsFromExpect(expect: Expect, overrides?: AssertionOverrides): Assertion[] {
  const assertions: Assertion[] = [];

  if (expect.toolCalls) {
    const hasOrder = expect.toolCalls.some((tc) => tc.order !== undefined);

    if (hasOrder) {
      assertions.push(createToolOrderAssertion(expect.toolCalls));
    } else {
      for (const tc of expect.toolCalls) {
        if (tc.shouldNotCall) {
          assertions.push(createToolNotCalledAssertion(tc.tool));
        } else {
          assertions.push(
            createToolCalledAssertion(
              tc.tool,
              tc.argsMatch ?? undefined,
              tc.argsSchema ?? undefined,
            ),
          );
        }
      }
    }
  }

  if (expect.output) {
    assertions.push(
      createSchemaAssertion({
        format: expect.output.format,
        schemaFile: expect.output.schemaFile,
        schemaContent: overrides?.schemaContent,
        contains: expect.output.contains,
        notContains: expect.output.notContains,
        maxLength: expect.output.maxLength,
      }),
    );
  }

  if (expect.guardrails?.pii) {
    assertions.push(
      createPiiAssertion({
        denyPatterns: expect.guardrails.pii.denyPatterns,
        customPatterns: expect.guardrails.pii.customPatterns,
      }),
    );
  }

  if (expect.guardrails?.keywords) {
    if (
      expect.guardrails.keywords.allow &&
      expect.guardrails.keywords.allow.length > 0
    ) {
      assertions.push(
        createKeywordsPresentAssertion(expect.guardrails.keywords.allow),
      );
    }
    if (expect.guardrails.keywords.deny.length > 0) {
      assertions.push(
        createKeywordsAbsentAssertion(expect.guardrails.keywords.deny),
      );
    }
  }

  if (expect.judge) {
    for (const criterion of expect.judge) {
      assertions.push(
        createJudgeAssertion({
          criteria: criterion.criteria,
          minScore: criterion.minScore,
          rubric: criterion.rubric,
        }),
      );
    }
  }

  if (expect.baseline?.drift) {
    assertions.push(
      createDriftAssertion({
        maxScore: expect.baseline.drift.maxScore,
        method: expect.baseline.drift.method,
        fields: expect.baseline.drift.fields,
      }),
    );
  }

  return assertions;
}

export function createAssertionRegistry(): Map<string, AssertionFactory> {
  return new Map<string, AssertionFactory>([
    ["tool_called", (config) => createToolCalledAssertion(config.toolCalls?.[0]?.tool ?? "")],
    ["schema", (config) => createSchemaAssertion(config.output ?? { format: "text" })],
    ["pii", (config) => createPiiAssertion(config.guardrails?.pii ?? { denyPatterns: [] })],
    ["judge", (config) => createJudgeAssertion(config.judge?.[0] ?? { criteria: "", minScore: 0.7 })],
    ["drift", (config) => createDriftAssertion(config.baseline?.drift ?? { maxScore: 0.15, method: "judge" })],
    ["latency", () => createLatencyAssertion({ maxMs: 60000 })],
    ["cost", () => createCostAssertion({ maxUsd: 1.0 })],
  ]);
}
