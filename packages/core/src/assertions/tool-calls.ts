import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface ToolCallExpectation {
  tool: string;
  shouldNotCall?: boolean;
  argsMatch?: Record<string, unknown>;
  argsSchema?: string;
  order?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function partialDeepMatch(actual: unknown, expected: unknown): boolean {
  // Exact primitive match
  if (Object.is(actual, expected)) return true;

  // Array: exact deep equality (order matters)
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (!partialDeepMatch(actual[i], expected[i])) return false;
    }
    return true;
  }

  // Object: partial match (every expected key must match, extra actual keys allowed)
  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) return false;
    for (const [key, expectedValue] of Object.entries(expected)) {
      if (!(key in actual)) return false;
      if (!partialDeepMatch(actual[key], expectedValue)) return false;
    }
    return true;
  }

  return false;
}

function matchArgs(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!(key in actual)) return false;
    if (!partialDeepMatch(actual[key], expectedValue)) return false;
  }
  return true;
}

function computeArgDiffs(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): Record<string, { expected: unknown; received: unknown }> {
  const diffs: Record<string, { expected: unknown; received: unknown }> = {};
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!(key in actual) || !partialDeepMatch(actual[key], expectedValue)) {
      diffs[key] = { expected: expectedValue, received: actual[key] };
    }
  }
  return diffs;
}

function evaluateArgsSchema(
  tool: string,
  assertionType: string,
  argsSchema: string | undefined,
  matching: { arguments: Record<string, unknown> }[],
  context: AssertionContext,
  results: AssertionResult[],
): void {
  if (!argsSchema) return;

  if (!context.validateJsonSchema) {
    results.push({
      assertionType,
      label: `Tool "${tool}" args schema valid`,
      passed: false,
      score: 0,
      failureCode: "INTERNAL_ERROR",
      failureMessage:
        "argsSchema provided but no JSON Schema validator was injected",
    });
    return;
  }

  const schemaObj =
    typeof argsSchema === "string" ? JSON.parse(argsSchema) : argsSchema;
  const anySchemaMatch = matching.some((tc) => {
    const validator = context.validateJsonSchema;
    if (!validator) return false;
    const result = validator(
      schemaObj as Record<string, unknown>,
      tc.arguments,
    );
    return result.valid;
  });
  results.push({
    assertionType,
    label: `Tool "${tool}" args schema valid`,
    passed: anySchemaMatch,
    score: anySchemaMatch ? 1 : 0,
    failureCode: anySchemaMatch ? undefined : "TOOL_CALL_ARGS_SCHEMA_INVALID",
    failureMessage: anySchemaMatch
      ? undefined
      : `Tool "${tool}" arguments did not match argsSchema`,
  });
}

export function createToolCalledAssertion(
  tool: string,
  argsMatch?: Record<string, unknown>,
  argsSchema?: string,
): Assertion {
  return {
    type: "tool_called",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const results: AssertionResult[] = [];
      const matching = context.toolCalls.filter((tc) => tc.name === tool);
      const actualNames = context.toolCalls.map((tc) => tc.name);

      if (matching.length === 0) {
        results.push({
          assertionType: "tool_called",
          label: `Tool "${tool}" called`,
          passed: false,
          score: 0,
          failureCode: "TOOL_CALL_MISSING",
          failureMessage: `Expected tool "${tool}" to be called, but got: [${actualNames.join(", ")}]`,
          metadata: {
            receivedToolCalls: context.toolCalls,
            expectedTool: tool,
            expectedArgs: argsMatch,
            argDiffs: undefined,
          },
        });
        return Promise.resolve(results);
      }

      // matching.length > 0 is guaranteed here (early return above handles 0 case)
      const firstMatchArgs = matching.length > 0 ? matching[0]?.arguments ?? {} : {};
      results.push({
        assertionType: "tool_called",
        label: `Tool "${tool}" called`,
        passed: true,
        score: 1,
        metadata: { argCount: Object.keys(firstMatchArgs).length },
      });

      if (argsMatch) {
        const anyMatch = matching.some((tc) =>
          matchArgs(tc.arguments, argsMatch),
        );
        const diffs = anyMatch ? undefined : computeArgDiffs(firstMatchArgs, argsMatch);
        results.push({
          assertionType: "tool_called",
          label: `Tool "${tool}" args match`,
          passed: anyMatch,
          score: anyMatch ? 1 : 0,
          failureCode: anyMatch ? undefined : "TOOL_CALL_ARGS_MISMATCH",
          failureMessage: anyMatch
            ? undefined
            : `Expected args ${JSON.stringify(argsMatch)}, got ${JSON.stringify(firstMatchArgs)}`,
          metadata: anyMatch
            ? undefined
            : {
                receivedToolCalls: context.toolCalls,
                expectedTool: tool,
                expectedArgs: argsMatch,
                argDiffs: diffs,
              },
        });
      }

      evaluateArgsSchema(
        tool,
        "tool_called",
        argsSchema,
        matching,
        context,
        results,
      );

      return Promise.resolve(results);
    },
  };
}

export function createToolNotCalledAssertion(tool: string): Assertion {
  return {
    type: "tool_not_called",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const found = context.toolCalls.some((tc) => tc.name === tool);
      return Promise.resolve([
        {
          assertionType: "tool_not_called",
          label: `Tool "${tool}" not called`,
          passed: !found,
          score: found ? 0 : 1,
          failureCode: found ? "TOOL_CALL_UNEXPECTED" : undefined,
          failureMessage: found
            ? `Expected tool "${tool}" to NOT be called, but it was`
            : undefined,
          metadata: found
            ? { receivedToolCalls: context.toolCalls, expectedTool: tool }
            : undefined,
        },
      ]);
    },
  };
}

export function createToolOrderAssertion(
  expectations: ToolCallExpectation[],
): Assertion {
  return {
    type: "tool_order",
    evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const results: AssertionResult[] = [];

      for (const exp of expectations) {
        // shouldNotCall entries are negative assertions — they verify a tool was NOT called.
        // When mixed with order checks, skip them for ordering purposes; order values
        // always refer to indices in the actual context.toolCalls array.
        if (exp.shouldNotCall) {
          const found = context.toolCalls.some((tc) => tc.name === exp.tool);
          results.push({
            assertionType: "tool_order",
            label: `Tool "${exp.tool}" not called`,
            passed: !found,
            score: found ? 0 : 1,
            failureCode: found ? "TOOL_CALL_UNEXPECTED" : undefined,
            failureMessage: found
              ? `Expected tool "${exp.tool}" to NOT be called, but it was`
              : undefined,
            metadata: found
              ? { receivedToolCalls: context.toolCalls, expectedTool: exp.tool }
              : undefined,
          });
          continue;
        }

        const matching = context.toolCalls.filter(
          (tc) => tc.name === exp.tool,
        );
        if (matching.length === 0) {
          results.push({
            assertionType: "tool_order",
            label: `Tool "${exp.tool}" called`,
            passed: false,
            score: 0,
            failureCode: "TOOL_CALL_MISSING",
            failureMessage: `Expected tool "${exp.tool}" to be called, but it was not`,
            metadata: {
              receivedToolCalls: context.toolCalls,
              expectedTool: exp.tool,
              expectedArgs: exp.argsMatch,
              argDiffs: undefined,
            },
          });
          continue;
        }

        // matching.length > 0 is guaranteed here (early return above handles 0 case)
        const firstOrderArgs = matching.length > 0 ? matching[0]?.arguments ?? {} : {};
        results.push({
          assertionType: "tool_order",
          label: `Tool "${exp.tool}" called`,
          passed: true,
          score: 1,
          metadata: { argCount: Object.keys(firstOrderArgs).length },
        });

        if (exp.argsMatch) {
          const anyMatch = matching.some((tc) =>
            matchArgs(tc.arguments, exp.argsMatch ?? {}),
          );
          const diffs = anyMatch
            ? undefined
            : computeArgDiffs(firstOrderArgs, exp.argsMatch ?? {});
          results.push({
            assertionType: "tool_order",
            label: `Tool "${exp.tool}" args match`,
            passed: anyMatch,
            score: anyMatch ? 1 : 0,
            failureCode: anyMatch ? undefined : "TOOL_CALL_ARGS_MISMATCH",
            failureMessage: anyMatch
              ? undefined
              : `Expected args ${JSON.stringify(exp.argsMatch)}, got ${JSON.stringify(firstOrderArgs)}`,
            metadata: anyMatch
              ? undefined
              : {
                  receivedToolCalls: context.toolCalls,
                  expectedTool: exp.tool,
                  expectedArgs: exp.argsMatch,
                  argDiffs: diffs,
                },
          });
        }

        evaluateArgsSchema(
          exp.tool,
          "tool_order",
          exp.argsSchema,
          matching,
          context,
          results,
        );

        // order refers to the position in the actual context.toolCalls array.
        // When a tool appears multiple times, validate the specific occurrence at that index.
        if (exp.order !== undefined) {
          const toolAtPosition = context.toolCalls[exp.order];
          const orderMatch = toolAtPosition?.name === exp.tool;
          const actualIndex = context.toolCalls.findIndex(
            (tc) => tc.name === exp.tool,
          );
          results.push({
            assertionType: "tool_order",
            label: `Tool "${exp.tool}" at position ${exp.order}`,
            passed: orderMatch,
            score: orderMatch ? 1 : 0,
            failureCode: orderMatch ? undefined : "TOOL_CALL_ORDER_WRONG",
            failureMessage: orderMatch
              ? undefined
              : `Expected "${exp.tool}" at position ${exp.order}, but found at position ${actualIndex}`,
            metadata: orderMatch
              ? undefined
              : { receivedToolCalls: context.toolCalls, expectedTool: exp.tool },
          });
        }
      }

      return Promise.resolve(results);
    },
  };
}
