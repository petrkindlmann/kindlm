import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

// AJV is CJS — dynamic import to avoid verbatimModuleSyntax issues
async function getAjv() {
  const ajvMod = await import("ajv");
  const formatsMod = await import("ajv-formats");
  const Ajv = (ajvMod as unknown as { default: { new (opts: object): AjvInstance } }).default;
  const addFormats = (formatsMod as unknown as { default: (ajv: AjvInstance) => void }).default;
  return { Ajv, addFormats };
}

interface AjvInstance {
  compile(schema: object): AjvValidateFunction;
  errorsText(errors: unknown[] | null | undefined): string;
}

interface AjvValidateFunction {
  (data: unknown): boolean;
  errors: unknown[] | null;
}

export interface SchemaAssertionConfig {
  format: "text" | "json";
  schemaFile?: string;
  schemaContent?: Record<string, unknown>;
  contains?: string[];
  notContains?: string[];
  maxLength?: number;
}

export function createSchemaAssertion(config: SchemaAssertionConfig): Assertion {
  return {
    type: "schema",
    async evaluate(context: AssertionContext): Promise<AssertionResult[]> {
      const results: AssertionResult[] = [];
      let parsed: unknown = undefined;

      if (config.format === "json") {
        try {
          parsed = JSON.parse(context.outputText);
          results.push({
            assertionType: "schema",
            label: "Output is valid JSON",
            passed: true,
            score: 1,
          });
        } catch (e) {
          results.push({
            assertionType: "schema",
            label: "Output is valid JSON",
            passed: false,
            score: 0,
            failureCode: "SCHEMA_PARSE_ERROR",
            failureMessage: `Failed to parse output as JSON: ${e instanceof Error ? e.message : String(e)}`,
          });
          return results;
        }
      }

      if (config.schemaContent) {
        const { Ajv, addFormats } = await getAjv();
        const ajv = new Ajv({ allErrors: true, strict: false });
        addFormats(ajv);
        const validate = ajv.compile(config.schemaContent);
        const valid = validate(parsed ?? context.outputText);
        results.push({
          assertionType: "schema",
          label: "Output matches JSON Schema",
          passed: valid,
          score: valid ? 1 : 0,
          failureCode: valid ? undefined : "SCHEMA_INVALID",
          failureMessage: valid
            ? undefined
            : `Schema validation failed: ${ajv.errorsText(validate.errors)}`,
          metadata: valid ? undefined : { errors: validate.errors },
        });
      }

      if (config.contains) {
        for (const substring of config.contains) {
          const found = context.outputText.includes(substring);
          results.push({
            assertionType: "schema",
            label: `Output contains "${substring}"`,
            passed: found,
            score: found ? 1 : 0,
            failureCode: found ? undefined : "CONTAINS_FAILED",
            failureMessage: found
              ? undefined
              : `Expected output to contain "${substring}"`,
          });
        }
      }

      if (config.notContains) {
        for (const substring of config.notContains) {
          const found = context.outputText.includes(substring);
          results.push({
            assertionType: "schema",
            label: `Output does not contain "${substring}"`,
            passed: !found,
            score: found ? 0 : 1,
            failureCode: found ? "NOT_CONTAINS_FAILED" : undefined,
            failureMessage: found
              ? `Expected output to NOT contain "${substring}"`
              : undefined,
          });
        }
      }

      if (config.maxLength !== undefined) {
        const withinLimit = context.outputText.length <= config.maxLength;
        results.push({
          assertionType: "schema",
          label: `Output length <= ${config.maxLength}`,
          passed: withinLimit,
          score: withinLimit ? 1 : 0,
          failureCode: withinLimit ? undefined : "MAX_LENGTH_EXCEEDED",
          failureMessage: withinLimit
            ? undefined
            : `Output length ${context.outputText.length} exceeds max ${config.maxLength}`,
        });
      }

      return results;
    },
  };
}
