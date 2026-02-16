/* eslint-disable no-console */
import type { Command } from "commander";
import { resolve, dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import chalk from "chalk";
import {
  parseConfig,
  readBaseline,
  writeBaseline,
  listBaselines,
  buildBaselineData,
  compareBaseline,
  deserializeBaseline,
} from "@kindlm/core";
import { runTests } from "../utils/run-tests.js";
import { createFileBaselineIO } from "../utils/baseline-io.js";
import { createNodeFileReader } from "../utils/file-reader.js";

interface BaselineSetOptions {
  config: string;
  runs?: string;
}

interface BaselineCompareOptions {
  config: string;
  runs?: string;
}

interface BaselineListOptions {
  config: string;
}

export function registerBaselineCommand(program: Command): void {
  const baseline = program
    .command("baseline")
    .description("Manage test baselines");

  baseline
    .command("set")
    .description("Save current results as baseline")
    .option("-c, --config <path>", "Path to config file", "kindlm.yaml")
    .option("--runs <count>", "Override run count")
    .action(async (options: BaselineSetOptions) => {
      try {
        const configDir = dirname(resolve(process.cwd(), options.config));
        const kindlmDir = join(configDir, ".kindlm");
        const io = createFileBaselineIO(kindlmDir);

        // Run tests
        const { config, runnerResult } = await runTests({
          configPath: options.config,
          runs: options.runs ? parseInt(options.runs, 10) : undefined,
        });

        const { aggregated } = runnerResult;

        // Build + write baseline
        const baselineData = buildBaselineData(
          config.suite.name,
          aggregated,
          new Date().toISOString(),
        );

        const writeResult = writeBaseline(baselineData, io);
        if (!writeResult.success) {
          console.error(chalk.red(`Failed to save baseline: ${writeResult.error.message}`));
          process.exit(1);
        }

        const testCount = Object.keys(baselineData.results).length;
        console.log("");
        console.log(
          chalk.green(`Baseline saved for suite "${config.suite.name}" (${testCount} test${testCount === 1 ? "" : "s"})`),
        );
        console.log(chalk.dim(`  Location: ${kindlmDir}/baselines/`));
        process.exit(0);
      } catch (e) {
        console.error(chalk.red(`Error: ${e instanceof Error ? e.message : String(e)}`));
        process.exit(1);
      }
    });

  baseline
    .command("compare")
    .description("Compare latest against baseline")
    .option("-c, --config <path>", "Path to config file", "kindlm.yaml")
    .option("--runs <count>", "Override run count")
    .action(async (options: BaselineCompareOptions) => {
      try {
        const configDir = dirname(resolve(process.cwd(), options.config));
        const kindlmDir = join(configDir, ".kindlm");
        const io = createFileBaselineIO(kindlmDir);

        // We need the suite name from config before running tests.
        // Parse config minimally to get the suite name for baseline lookup.
        const configPath = resolve(process.cwd(), options.config);
        let yamlContent: string;
        try {
          yamlContent = readFileSync(configPath, "utf-8");
        } catch {
          console.error(chalk.red(`Config file not found: ${configPath}`));
          process.exit(1);
        }

        const fileReader = createNodeFileReader();
        const parseResult = parseConfig(yamlContent, {
          configDir,
          fileReader,
        });

        if (!parseResult.success) {
          console.error(chalk.red(`Config validation failed: ${parseResult.error.message}`));
          process.exit(1);
        }

        const suiteName = parseResult.data.suite.name;

        // Load baseline — fail fast if missing
        const baselineResult = readBaseline(suiteName, io);
        if (!baselineResult.success) {
          if (baselineResult.error.code === "BASELINE_NOT_FOUND") {
            console.error(chalk.red(`No baseline found for suite "${suiteName}". Run \`kindlm baseline set\` first.`));
          } else {
            console.error(chalk.red(`Failed to read baseline: ${baselineResult.error.message}`));
          }
          process.exit(1);
        }

        const baselineData = baselineResult.data;

        // Run tests with baseline injected for drift assertions
        const { runnerResult } = await runTests({
          configPath: options.config,
          runs: options.runs ? parseInt(options.runs, 10) : undefined,
          baselineData,
        });

        const { aggregated } = runnerResult;

        // Build current baseline data for comparison
        const currentData = buildBaselineData(
          suiteName,
          aggregated,
          new Date().toISOString(),
        );

        // Compare
        const comparison = compareBaseline(baselineData, currentData.results);

        // Print comparison report
        console.log("");
        console.log(chalk.bold(`Baseline comparison for "${suiteName}"`));
        console.log(chalk.dim(`  Baseline from: ${baselineData.createdAt}`));
        console.log("");

        if (comparison.regressions.length > 0) {
          console.log(chalk.red.bold(`  Regressions (${comparison.regressions.length}):`));
          for (const r of comparison.regressions) {
            console.log(chalk.red(`    ${r.testName}: ${formatPercent(r.baselinePassRate)} → ${formatPercent(r.currentPassRate)}`));
            if (r.newFailureCodes.length > 0) {
              console.log(chalk.red(`      New failures: ${r.newFailureCodes.join(", ")}`));
            }
          }
          console.log("");
        }

        if (comparison.improvements.length > 0) {
          console.log(chalk.green.bold(`  Improvements (${comparison.improvements.length}):`));
          for (const imp of comparison.improvements) {
            console.log(chalk.green(`    ${imp.testName}: ${formatPercent(imp.baselinePassRate)} → ${formatPercent(imp.currentPassRate)}`));
          }
          console.log("");
        }

        if (comparison.unchanged.length > 0) {
          console.log(chalk.dim(`  Unchanged (${comparison.unchanged.length}):`));
          for (const u of comparison.unchanged) {
            console.log(chalk.dim(`    ${u.testName}: ${formatPercent(u.passRate)}`));
          }
          console.log("");
        }

        if (comparison.newTests.length > 0) {
          console.log(chalk.cyan(`  New tests (${comparison.newTests.length}):`));
          for (const t of comparison.newTests) {
            console.log(chalk.cyan(`    ${t}`));
          }
          console.log("");
        }

        if (comparison.removedTests.length > 0) {
          console.log(chalk.yellow(`  Removed tests (${comparison.removedTests.length}):`));
          for (const t of comparison.removedTests) {
            console.log(chalk.yellow(`    ${t}`));
          }
          console.log("");
        }

        // Exit 1 if any regressions
        process.exit(comparison.regressions.length > 0 ? 1 : 0);
      } catch (e) {
        console.error(chalk.red(`Error: ${e instanceof Error ? e.message : String(e)}`));
        process.exit(1);
      }
    });

  baseline
    .command("list")
    .description("List saved baselines")
    .option("-c, --config <path>", "Path to config file", "kindlm.yaml")
    .action((options: BaselineListOptions) => {
      try {
        const configDir = dirname(resolve(process.cwd(), options.config));
        const kindlmDir = join(configDir, ".kindlm");
        const io = createFileBaselineIO(kindlmDir);

        const listResult = listBaselines(io);
        if (!listResult.success) {
          console.error(chalk.red(`Failed to list baselines: ${listResult.error.message}`));
          process.exit(1);
        }

        const names = listResult.data;

        if (names.length === 0) {
          console.log(chalk.dim("No baselines saved yet. Run `kindlm baseline set` to create one."));
          process.exit(0);
        }

        console.log(chalk.bold("Saved baselines:"));
        console.log("");

        for (const name of names) {
          const readResult = io.read(name);
          if (!readResult.success) {
            console.log(`  ${name} ${chalk.dim("(unreadable)")}`);
            continue;
          }

          const parsed = deserializeBaseline(readResult.data);
          if (!parsed.success) {
            console.log(`  ${name} ${chalk.dim("(corrupt)")}`);
            continue;
          }

          const testCount = Object.keys(parsed.data.results).length;
          console.log(`  ${chalk.cyan(parsed.data.suiteName)} — ${testCount} test${testCount === 1 ? "" : "s"}, saved ${chalk.dim(parsed.data.createdAt)}`);
        }

        process.exit(0);
      } catch (e) {
        console.error(chalk.red(`Error: ${e instanceof Error ? e.message : String(e)}`));
        process.exit(1);
      }
    });
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
