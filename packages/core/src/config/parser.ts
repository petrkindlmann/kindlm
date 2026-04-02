import { parse as parseYaml } from "yaml";
import type { KindLMConfig } from "./schema.js";
import { validateConfig } from "./schema.js";
import type { Result } from "../types/result.js";
import { ok, err } from "../types/result.js";

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  // Row-based DP — prev holds distance for row i-1, curr for row i
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const sub = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,        // deletion
        (curr[j - 1] ?? 0) + 1,    // insertion
        (prev[j - 1] ?? 0) + sub,  // substitution
      );
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

export function suggestClosest(input: string, candidates: string[]): string | null {
  if (!input || candidates.length === 0) return null;
  const threshold = Math.max(2, Math.floor(input.length * 0.4));
  const lower = input.toLowerCase();
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = levenshtein(lower, c.toLowerCase());
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

export interface FileReader {
  readFile(path: string): Result<string>;
}

export interface ParseOptions {
  configDir: string;
  fileReader?: FileReader;
}

const MAX_CONFIG_SIZE = 1_048_576; // 1MB
const MAX_TESTS = 1000;
const MAX_MODELS = 50;

export function parseConfig(
  yamlContent: string,
  options: ParseOptions,
): Result<KindLMConfig> {
  // Step 0: Size guard
  if (yamlContent.length > MAX_CONFIG_SIZE) {
    return err({
      code: "CONFIG_TOO_LARGE",
      message: `Config exceeds maximum size of 1MB (got ${(yamlContent.length / 1_048_576).toFixed(1)}MB)`,
    });
  }

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

  // Step 2.5: Cardinality limits
  if (config.tests.length > MAX_TESTS) {
    return err({
      code: "CONFIG_VALIDATION_ERROR",
      message: `Config exceeds maximum of ${MAX_TESTS} tests (got ${config.tests.length})`,
    });
  }

  // Count unique suites by model grouping — but here "suites" are implicit via test groupings
  // For simplicity, use the models array length as a proxy
  if (config.models.length > MAX_MODELS) {
    return err({
      code: "CONFIG_VALIDATION_ERROR",
      message: `Config exceeds maximum of ${MAX_MODELS} models (got ${config.models.length})`,
    });
  }

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

  // test.prompt must exist in config.prompts (only for prompt-based tests)
  for (const test of config.tests) {
    if (test.prompt && !(test.prompt in config.prompts)) {
      const promptNames = Object.keys(config.prompts);
      const suggestion = suggestClosest(test.prompt, promptNames);
      const hint = suggestion
        ? ` Did you mean: "${suggestion}"?`
        : ` Available prompts: ${promptNames.map((p) => `"${p}"`).join(", ")}`;
      errors.push(
        `Test "${test.name}" references prompt "${test.prompt}" which is not defined.${hint}`,
      );
    }
  }

  // test.models[] must reference valid model IDs
  for (const test of config.tests) {
    if (test.models) {
      for (const modelId of test.models) {
        if (!modelIds.has(modelId)) {
          const allModelIds = [...modelIds];
          const suggestion = suggestClosest(modelId, allModelIds);
          const hint = suggestion
            ? ` Did you mean: "${suggestion}"?`
            : ` Available models: ${allModelIds.map((m) => `"${m}"`).join(", ")}`;
          errors.push(
            `Test "${test.name}" references model "${modelId}" which is not configured.${hint}`,
          );
        }
      }
    }
  }

  // model.provider must exist in config.providers
  for (const model of config.models) {
    const providers = config.providers as Record<string, unknown>;
    if (!providers[model.provider]) {
      const providerNames = Object.keys(providers);
      const suggestion = suggestClosest(model.provider, providerNames);
      const hint = suggestion
        ? ` Did you mean: "${suggestion}"?`
        : ` Available providers: ${providerNames.map((p) => `"${p}"`).join(", ")}`;
      errors.push(
        `Model "${model.id}" references provider "${model.provider}" which is not configured.${hint}`,
      );
    }
  }

  // defaults.judgeModel must reference valid model ID
  if (
    config.defaults.judgeModel &&
    !modelIds.has(config.defaults.judgeModel)
  ) {
    const allModelIds2 = [...modelIds];
    const suggestion = suggestClosest(config.defaults.judgeModel, allModelIds2);
    const hint = suggestion
      ? ` Did you mean: "${suggestion}"?`
      : ` Available models: ${allModelIds2.map((m) => `"${m}"`).join(", ")}`;
    errors.push(
      `defaults.judgeModel "${config.defaults.judgeModel}" is not a configured model.${hint}`,
    );
  }

  // schemaFile / argsSchema path verification via fileReader
  if (options.fileReader) {
    for (const test of config.tests) {
      if (test.expect.output?.schemaFile) {
        const pathResult = safePath(
          options.configDir,
          test.expect.output.schemaFile,
        );
        if (!pathResult.success) {
          errors.push(
            `Test "${test.name}": schemaFile "${test.expect.output.schemaFile}" — ${pathResult.error.message}`,
          );
        } else {
          const result = options.fileReader.readFile(pathResult.data);
          if (!result.success) {
            errors.push(
              `Test "${test.name}": schemaFile "${test.expect.output.schemaFile}" not found at ${pathResult.data}`,
            );
          }
        }
      }

      if (test.expect.toolCalls) {
        for (const tc of test.expect.toolCalls) {
          if (tc.argsSchema) {
            const pathResult = safePath(
              options.configDir,
              tc.argsSchema,
            );
            if (!pathResult.success) {
              errors.push(
                `Test "${test.name}": argsSchema "${tc.argsSchema}" for tool "${tc.tool}" — ${pathResult.error.message}`,
              );
            } else {
              const result = options.fileReader.readFile(pathResult.data);
              if (!result.success) {
                errors.push(
                  `Test "${test.name}": argsSchema "${tc.argsSchema}" for tool "${tc.tool}" not found at ${pathResult.data}`,
                );
              } else {
                try {
                  tc.argsSchemaResolved = JSON.parse(result.data) as Record<string, unknown>;
                } catch {
                  errors.push(
                    `Test "${test.name}": argsSchema "${tc.argsSchema}" for tool "${tc.tool}" is not valid JSON`,
                  );
                }
              }
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

export function safePath(base: string, relative: string): Result<string> {
  // Block absolute paths
  if (relative.startsWith("/") || relative.startsWith("\\")) {
    return err({
      code: "PATH_TRAVERSAL",
      message: "Absolute paths are not allowed in config references",
    });
  }

  // Block Windows absolute paths (e.g. C:\)
  if (/^[a-zA-Z]:/.test(relative)) {
    return err({
      code: "PATH_TRAVERSAL",
      message: "Absolute paths are not allowed in config references",
    });
  }

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const joined = `${normalizedBase}/${relative}`;

  // Normalize away .. and . segments
  const resolved = normalizePath(joined);

  // Verify resolved path stays under config directory
  const normalizedRoot = normalizePath(normalizedBase);
  if (!resolved.startsWith(normalizedRoot + "/") && resolved !== normalizedRoot) {
    return err({
      code: "PATH_TRAVERSAL",
      message: `Path "${relative}" escapes the config directory`,
    });
  }

  return ok(resolved);
}

function normalizePath(p: string): string {
  const parts = p.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      result.pop();
    } else {
      result.push(part);
    }
  }
  // Preserve leading slash for absolute paths
  const prefix = p.startsWith("/") ? "/" : "";
  return prefix + result.join("/");
}
