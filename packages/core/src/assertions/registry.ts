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
    const hasNumericOrder = expect.toolCalls.some(
      (tc) => tc.order !== undefined,
    );
    // The opt-in `toolCallsOrdered: true` enforces the declared SEQUENCE by
    // synthesizing order indices from array position. A numeric `order:` on any
    // entry takes precedence (back-compat positional matching) — when present we
    // pass entries through untouched and never synthesize.
    const useOrdered = hasNumericOrder || expect.toolCallsOrdered === true;

    if (useOrdered) {
      // When relying solely on the opt-in (no numeric order anywhere), derive the
      // expected position from the entry's index among the positive calls,
      // skipping shouldNotCall negatives (those are name-presence checks, not
      // positional). When numeric order is present we leave entries as-is.
      let synthesizedPosition = 0;
      const mapped = expect.toolCalls.map((tc) => {
        const order =
          hasNumericOrder || tc.shouldNotCall
            ? tc.order
            : synthesizedPosition++;
        return {
          ...tc,
          order,
          argsSchema: tc.argsSchemaResolved
            ? JSON.stringify(tc.argsSchemaResolved)
            : tc.argsSchema,
        };
      });
      assertions.push(createToolOrderAssertion(mapped));
    } else {
      for (const tc of expect.toolCalls) {
        if (tc.shouldNotCall) {
          assertions.push(createToolNotCalledAssertion(tc.tool));
        } else {
          const resolvedSchema = tc.argsSchemaResolved
            ? JSON.stringify(tc.argsSchemaResolved)
            : tc.argsSchema ?? undefined;
          assertions.push(
            createToolCalledAssertion(
              tc.tool,
              tc.argsMatch ?? undefined,
              resolvedSchema,
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
        detectors: expect.guardrails.pii.detectors,
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
          model: criterion.model,
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

  if (expect.latency) {
    assertions.push(
      createLatencyAssertion({ maxMs: expect.latency.maxMs }),
    );
  }

  if (expect.cost) {
    assertions.push(
      createCostAssertion({ maxUsd: expect.cost.maxUsd }),
    );
  }

  return assertions;
}
