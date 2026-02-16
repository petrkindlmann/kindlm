import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

export interface SchemaAssertionConfig {
  format: "text" | "json";
  schemaFile?: string;
  contains?: string[];
  notContains?: string[];
  maxLength?: number;
}

export function createSchemaAssertion(config: SchemaAssertionConfig): Assertion {
  return {
    type: "schema",
    evaluate(_context: AssertionContext): Promise<AssertionResult[]> {
      void config;
      throw new Error("Not implemented");
    },
  };
}
