import { parse as parseYaml } from "yaml";
import type { KindLMConfig } from "./schema.js";
import { validateConfig } from "./schema.js";
import type { Result } from "../types/result.js";
import { ok, err } from "../types/result.js";

export interface FileReader {
  readFile(path: string): Result<string>;
}

export interface ParseOptions {
  configDir: string;
  fileReader?: FileReader;
}

export function parseConfig(
  yamlContent: string,
  options: ParseOptions,
): Result<KindLMConfig> {
  // Step 1: YAML parse
  let raw: unknown;
  try {
    raw = parseYaml(yamlContent);
  } catch (cause) {
    return err({
      code: "CONFIG_PARSE_ERROR",
      message: `Failed to parse YAML: ${(cause as Error).message}`,
      cause: cause as Error,
    });
  }

  // Step 2: Zod structural validation
  const validated = validateConfig(raw);
  if (!validated.success) {
    return validated;
  }
  const config = validated.data;

  // Step 3: Cross-reference validation (collect all errors)
  const errors: string[] = [];

  // Unique model IDs
  const modelIds = new Set<string>();
  for (const model of config.models) {
    if (modelIds.has(model.id)) {
      errors.push(`Duplicate model ID "${model.id}"`);
    }
    modelIds.add(model.id);
  }

  // Unique test names
  const testNames = new Set<string>();
  for (const test of config.tests) {
    if (testNames.has(test.name)) {
      errors.push(`Duplicate test name "${test.name}"`);
    }
    testNames.add(test.name);
  }

  // test.prompt must exist in config.prompts
  for (const test of config.tests) {
    if (!(test.prompt in config.prompts)) {
      errors.push(
        `Test "${test.name}" references prompt "${test.prompt}" which is not defined`,
      );
    }
  }

  // test.models[] must reference valid model IDs
  for (const test of config.tests) {
    if (test.models) {
      for (const modelId of test.models) {
        if (!modelIds.has(modelId)) {
          errors.push(
            `Test "${test.name}" references model "${modelId}" which is not configured`,
          );
        }
      }
    }
  }

  // model.provider must exist in config.providers
  for (const model of config.models) {
    const providers = config.providers as Record<string, unknown>;
    if (!providers[model.provider]) {
      errors.push(
        `Model "${model.id}" references provider "${model.provider}" which is not configured`,
      );
    }
  }

  // defaults.judgeModel must reference valid model ID
  if (
    config.defaults.judgeModel &&
    !modelIds.has(config.defaults.judgeModel)
  ) {
    errors.push(
      `defaults.judgeModel "${config.defaults.judgeModel}" is not a configured model`,
    );
  }

  // schemaFile / argsSchema path verification via fileReader
  if (options.fileReader) {
    for (const test of config.tests) {
      if (test.expect.output?.schemaFile) {
        const fullPath = joinPath(
          options.configDir,
          test.expect.output.schemaFile,
        );
        const result = options.fileReader.readFile(fullPath);
        if (!result.success) {
          errors.push(
            `Test "${test.name}": schemaFile "${test.expect.output.schemaFile}" not found at ${fullPath}`,
          );
        }
      }

      if (test.expect.toolCalls) {
        for (const tc of test.expect.toolCalls) {
          if (tc.argsSchema) {
            const fullPath = joinPath(
              options.configDir,
              tc.argsSchema,
            );
            const result = options.fileReader.readFile(fullPath);
            if (!result.success) {
              errors.push(
                `Test "${test.name}": argsSchema "${tc.argsSchema}" for tool "${tc.tool}" not found at ${fullPath}`,
              );
            }
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return err({
      code: "CONFIG_VALIDATION_ERROR",
      message: "Config cross-reference validation failed",
      details: { errors },
    });
  }

  return ok(config);
}

function joinPath(base: string, relative: string): string {
  if (relative.startsWith("/")) return relative;
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalizedBase}/${relative}`;
}
