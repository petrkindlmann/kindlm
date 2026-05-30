/* eslint-disable no-console */
import type { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import chalk from "chalk";
import { parseConfig, suggestClosest } from "@kindlm/core";
import { createNodeFileReader } from "../utils/file-reader.js";

// Valid keys for each strict `expect` sub-schema. Used to power the
// did-you-mean hint when Zod reports an unrecognized_keys issue. Sourced
// from the strict sub-schemas in @kindlm/core config/schema.ts.
const EXPECT_KEYS: Record<string, string[]> = {
  expect: ["output", "guardrails", "judge", "toolCalls", "baseline", "latency", "cost"],
  output: ["format", "schemaFile", "contains", "notContains", "maxLength"],
  guardrails: ["pii", "keywords"],
  toolCalls: ["tool", "shouldNotCall", "argsMatch", "argsSchema", "order"],
  judge: ["criteria", "minScore", "model", "rubric"],
};

/**
 * Zod renders unrecognized_keys as `Unrecognized key(s) in object: 'foo'`.
 * Extract the offending key names so we can offer a closest-match suggestion.
 */
function extractUnrecognizedKeys(message: string): string[] {
  const match = message.match(/Unrecognized key\(s\) in object:\s*(.+)$/);
  const captured = match?.[1];
  if (!captured) return [];
  return Array.from(captured.matchAll(/'([^']+)'/g))
    .map((m) => m[1])
    .filter((k): k is string => k !== undefined);
}

/**
 * Given a rendered cross-reference / Zod error string, append a
 * did-you-mean hint for any unrecognized expect key. Returns the original
 * string unchanged when no suggestion applies.
 */
function withDidYouMean(error: string): string {
  const badKeys = extractUnrecognizedKeys(error);
  if (badKeys.length === 0) return error;

  // Pick the candidate set from the deepest known schema segment in the path
  // prefix (the part before the colon), falling back to the expect keys.
  const pathPrefix = error.split(":")[0] ?? "";
  let candidates: string[] = EXPECT_KEYS["expect"] ?? [];
  for (const [segment, keys] of Object.entries(EXPECT_KEYS)) {
    if (pathPrefix.includes(`.${segment}`) || pathPrefix.endsWith(segment)) {
      candidates = keys;
    }
  }

  const hints: string[] = [];
  for (const key of badKeys) {
    const suggestion = suggestClosest(key, candidates);
    if (suggestion) {
      hints.push(`did you mean "${suggestion}"?`);
    }
  }
  return hints.length > 0 ? `${error} (${hints.join(" ")})` : error;
}

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate kindlm.yaml configuration")
    .option("-c, --config <path>", "Path to config file", "kindlm.yaml")
    .action((options: { config: string }) => {
      const configPath = resolve(process.cwd(), options.config);
      const configDir = dirname(configPath);

      let yamlContent: string;
      try {
        yamlContent = readFileSync(configPath, "utf-8");
      } catch {
        console.error(chalk.red(`Config file not found: ${configPath}`));
        process.exit(1);
      }

      const fileReader = createNodeFileReader();
      const result = parseConfig(yamlContent, { configDir, fileReader });

      if (!result.success) {
        console.error(chalk.red("Validation failed:"));
        const details = result.error.details;
        if (details && Array.isArray(details["errors"])) {
          for (const e of details["errors"] as string[]) {
            console.error(chalk.red(`  - ${withDidYouMean(e)}`));
          }
        } else {
          console.error(chalk.red(`  ${result.error.message}`));
        }
        process.exit(1);
      }

      const config = result.data;
      console.log(chalk.green("Config is valid!"));
      console.log("");
      console.log(`  Suite:  ${chalk.bold(config.suite.name)}`);
      console.log(`  Tests:  ${chalk.bold(String(config.tests.length))}`);
      console.log(`  Models: ${chalk.bold(String(config.models.length))}`);
    });
}
