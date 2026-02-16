import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface ToolCallExpectation {
  tool: string;
  shouldNotCall?: boolean;
  argsMatch?: Record<string, unknown>;
  argsSchema?: string;
  order?: number;
}

export function createToolCalledAssertion(tool: string, argsMatch?: Record<string, unknown>): Assertion {
  return {
    type: "tool_called",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void tool;
      void argsMatch;
      throw new Error("Not implemented");
    },
  };
}

export function createToolNotCalledAssertion(tool: string): Assertion {
  return {
    type: "tool_not_called",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void tool;
      throw new Error("Not implemented");
    },
  };
}

export function createToolOrderAssertion(expectations: ToolCallExpectation[]): Assertion {
  return {
    type: "tool_order",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void expectations;
      throw new Error("Not implemented");
    },
  };
}
