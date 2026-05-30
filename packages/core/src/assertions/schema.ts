import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { Assertion, AssertionContext, AssertionResult } from "./interface.js";

interface AjvInstance {
  compile(schema: object): AjvValidateFunction;
  errorsText(errors: unknown[] | null | undefined): string;
}

interface AjvValidateFunction {
  (data: unknown): boolean;
  errors: unknown[] | null;
}

/**
 * Result of validating a value against a JSON Schema. Matches the
 * `AssertionContext.validateJsonSchema` contract in interface.ts.
 */
export type JsonSchemaValidationResult =
  | { valid: true }
  | { valid: false; errors: string[]; compileError?: boolean };

/**
 * Single source of truth for AJV configuration. Returns a synchronous
 * validator that compiles (and caches) each schema lazily, with
 * `ajv-formats` enabled. Both the output-schema assertion and the runner's
 * injected `AssertionContext.validateJsonSchema` consume this so AJV behavior
 * (options + formats + caching) never diverges. AJV is a pure dependency, so
 * this keeps core I/O-free.
 */
export function createJsonSchemaValidator(): (
  schema: Record<string, unknown>,
  data: unknown,
) => JsonSchemaValidationResult {
  // `Ajv`/`addFormats` are exported as CJS default constructs; cast to the
  // minimal shapes we use to keep strict typing without pulling AJV's types.
  const AjvCtor = Ajv as unknown as { new (opts: object): AjvInstance };
  const applyFormats = addFormats as unknown as (ajv: AjvInstance) => void;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  applyFormats(ajv);

  const validatorCache = new Map<string, AjvValidateFunction>();

  function getOrCompileValidator(
    schema: Record<string, unknown>,
  ): AjvValidateFunction | { compileError: string } {
    const key = JSON.stringify(schema);
    const cached = validatorCache.get(key);
    if (cached) return cached;
    try {
      const validate = ajv.compile(schema);
      validatorCache.set(key, validate);
      return validate;
    } catch (e) {
      return { compileError: e instanceof Error ? e.message : String(e) };
    }
  }

  return (schema, data) => {
    const validateOrError = getOrCompileValidator(schema);
    if ("compileError" in validateOrError) {
      return {
        valid: false,
        errors: [validateOrError.compileError],
        compileError: true,
      };
    }
    const validate = validateOrError;
    const valid = validate(data);
    if (valid) return { valid: true };
    return { valid: false, errors: [ajv.errorsText(validate.errors)] };
  };
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
  // Reuse the single shared AJV configuration. The validator is local to each
  // assertion handler, avoiding module-level mutable state and keeping core pure.
  const validateSchema = createJsonSchemaValidator();
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
        const result = validateSchema(
          config.schemaContent,
          parsed ?? context.outputText,
        );
        results.push({
          assertionType: "schema",
          label: "Output matches JSON Schema",
          passed: result.valid,
          score: result.valid ? 1 : 0,
          failureCode: result.valid ? undefined : "SCHEMA_INVALID",
          failureMessage: result.valid
            ? undefined
            : result.compileError
              ? `Schema compilation failed: ${result.errors.join("; ")}`
              : `Schema validation failed: ${result.errors.join("; ")}`,
          metadata: result.valid ? undefined : { errors: result.errors },
        });
      }

      if (config.contains) {
        const lowerOutput = context.outputText.toLowerCase();
        for (const substring of config.contains) {
          const found = lowerOutput.includes(substring.toLowerCase());
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
        const lowerOutputNc = context.outputText.toLowerCase();
        for (const substring of config.notContains) {
          const found = lowerOutputNc.includes(substring.toLowerCase());
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
