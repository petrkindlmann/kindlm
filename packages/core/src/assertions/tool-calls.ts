import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface ToolCallExpectation {
  tool: string;
  shouldNotCall?: boolean;
  argsMatch?: Record<string, unknown>;
  argsSchema?: string;
  order?: number;
}

function matchArgs(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
): boolean {
  for (const [key, value] of Object.entries(expected)) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(value)) {
      return false;
    }
  }
  return true;
}

export function createToolCalledAssertion(
  tool: string,
  argsMatch?: Record<string, unknown>,
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
        });
        return Promise.resolve(results);
      }

      results.push({
        assertionType: "tool_called",
        label: `Tool "${tool}" called`,
        passed: true,
        score: 1,
      });

      if (argsMatch) {
        const anyMatch = matching.some((tc) => matchArgs(tc.arguments, argsMatch));
        results.push({
          assertionType: "tool_called",
          label: `Tool "${tool}" args match`,
          passed: anyMatch,
          score: anyMatch ? 1 : 0,
          failureCode: anyMatch ? undefined : "TOOL_CALL_ARGS_MISMATCH",
          failureMessage: anyMatch
            ? undefined
            : `Expected args ${JSON.stringify(argsMatch)}, got ${JSON.stringify(matching[0]?.arguments)}`,
        });
      }

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
          });
          continue;
        }

        const matching = context.toolCalls.filter((tc) => tc.name === exp.tool);
        if (matching.length === 0) {
          results.push({
            assertionType: "tool_order",
            label: `Tool "${exp.tool}" called`,
            passed: false,
            score: 0,
            failureCode: "TOOL_CALL_MISSING",
            failureMessage: `Expected tool "${exp.tool}" to be called, but it was not`,
          });
          continue;
        }

        results.push({
          assertionType: "tool_order",
          label: `Tool "${exp.tool}" called`,
          passed: true,
          score: 1,
        });

        if (exp.argsMatch) {
          const anyMatch = matching.some((tc) =>
            matchArgs(tc.arguments, exp.argsMatch ?? {}),
          );
          results.push({
            assertionType: "tool_order",
            label: `Tool "${exp.tool}" args match`,
            passed: anyMatch,
            score: anyMatch ? 1 : 0,
            failureCode: anyMatch ? undefined : "TOOL_CALL_ARGS_MISMATCH",
            failureMessage: anyMatch
              ? undefined
              : `Expected args ${JSON.stringify(exp.argsMatch)}, got ${JSON.stringify(matching[0]?.arguments)}`,
          });
        }

        if (exp.order !== undefined) {
          const actualIndex = context.toolCalls.findIndex(
            (tc) => tc.name === exp.tool,
          );
          const orderMatch = actualIndex === exp.order;
          results.push({
            assertionType: "tool_order",
            label: `Tool "${exp.tool}" at position ${exp.order}`,
            passed: orderMatch,
            score: orderMatch ? 1 : 0,
            failureCode: orderMatch ? undefined : "TOOL_CALL_ORDER_WRONG",
            failureMessage: orderMatch
              ? undefined
              : `Expected "${exp.tool}" at position ${exp.order}, but found at position ${actualIndex}`,
          });
        }
      }

      return Promise.resolve(results);
    },
  };
}
