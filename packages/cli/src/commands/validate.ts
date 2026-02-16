/* eslint-disable no-console */
import type { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import chalk from "chalk";
import { parseConfig } from "@kindlm/core";
import { createNodeFileReader } from "../utils/file-reader.js";

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
            console.error(chalk.red(`  - ${e}`));
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
