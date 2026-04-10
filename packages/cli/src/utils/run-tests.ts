/* eslint-disable no-console */
import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import chalk from "chalk";
import {
  parseConfig,
  createRunner,
} from "@kindlm/core";
import type {
  KindLMConfig,
  RunEvent,
  RunnerResult,
  BaselineData,
} from "@kindlm/core";
import { createSpinner } from "./spinner.js";
import { createNodeFileReader } from "./file-reader.js";
import { createNodeCommandExecutor } from "./command-executor.js";
import { initProviderAdapters } from "./init-adapters.js";
import { loadFeatureFlags, isEnabled } from "./features.js";
import type { FeatureFlags } from "./features.js";
import { writeRunArtifacts } from "./artifacts.js";
import type { RunArtifactPaths } from "./artifacts.js";
import { computeConfigHash } from "./last-run.js";
import { getGitInfo } from "./git.js";

export interface RunTestsOptions {
  configPath: string;
  runs?: number;
  gate?: number;
  suite?: string;
  baselineData?: BaselineData;
  noCache?: boolean;
  featureFlags?: FeatureFlags;
  concurrency?: number;
  timeout?: number;
}

export interface RunTestsResult {
  config: KindLMConfig;
  runnerResult: RunnerResult;
  configDir: string;
  yamlContent: string;
  featureFlags: FeatureFlags;
  artifactPaths?: RunArtifactPaths;
}

const MAX_CONFIG_SIZE = 1_048_576; // 1MB

export async function runTests(options: RunTestsOptions): Promise<RunTestsResult> {
  const spinner = createSpinner();

  // SIGINT handler: stop spinner, print partial results, exit 130
  let interrupted = false;
  const sigintHandler = () => {
    if (interrupted) process.exit(130);
    interrupted = true;
    spinner.stop();
    console.error(chalk.yellow("\nInterrupted. Exiting..."));
    process.exit(130);
  };
  process.on("SIGINT", sigintHandler);

  try {
    return await runTestsInner(options, spinner);
  } finally {
    process.removeListener("SIGINT", sigintHandler);
  }
}

async function runTestsInner(
  options: RunTestsOptions,
  spinner: ReturnType<typeof createSpinner>,
): Promise<RunTestsResult> {
  const featureFlags = options.featureFlags ?? loadFeatureFlags(process.cwd());

  // 1. Read config
  const configPath = resolve(process.cwd(), options.configPath);
  const configDir = dirname(configPath);

  // Check file size before reading
  try {
    const stat = statSync(configPath);
    if (stat.size > MAX_CONFIG_SIZE) {
      console.error(chalk.red(`Config file exceeds 1MB limit (${(stat.size / 1_048_576).toFixed(1)}MB): ${configPath}`));
      process.exit(1);
    }
  } catch {
    console.error(chalk.red(`Config file not found: ${configPath}`));
    process.exit(1);
  }

  let yamlContent: string;
  try {
    yamlContent = readFileSync(configPath, "utf-8");
  } catch {
    console.error(chalk.red(`Config file not found: ${configPath}`));
    process.exit(1);
  }

  // 2. Parse + validate
  const fileReader = createNodeFileReader();
  const parseResult = parseConfig(yamlContent, { configDir, fileReader });
  if (!parseResult.success) {
    console.error(chalk.red("Config validation failed:"));
    const details = parseResult.error.details;
    if (details && Array.isArray(details["errors"])) {
      for (const e of details["errors"] as string[]) {
        console.error(chalk.red(`  - ${e}`));
      }
    } else {
      console.error(chalk.red(`  ${parseResult.error.message}`));
    }
    process.exit(1);
  }

  const config: KindLMConfig = parseResult.data;

  // 2b. Filter by suite name if --suite is provided
  if (options.suite !== undefined) {
    if (config.suite.name !== options.suite) {
      console.error(chalk.red(`Suite "${options.suite}" not found. Available suite: "${config.suite.name}"`));
      process.exit(1);
    }
  }

  // 3. Apply CLI overrides
  if (options.runs !== undefined) {
    if (!Number.isInteger(options.runs) || options.runs < 1) {
      console.error(chalk.red(`Invalid --runs value: ${options.runs}. Must be a positive integer (>= 1).`));
      process.exit(1);
    }
    config.defaults.repeat = options.runs;
  }
  if (options.gate !== undefined) {
    if (Number.isNaN(options.gate) || options.gate < 0 || options.gate > 100) {
      console.error(chalk.red(`Invalid --gate value: ${options.gate}. Must be between 0 and 100.`));
      process.exit(1);
    }
    if (options.gate > 0 && options.gate <= 1) {
      console.error(chalk.yellow(`Warning: --gate ${options.gate} looks like a decimal. Did you mean --gate ${Math.round(options.gate * 100)}? (--gate uses 0-100 scale)`));
    }
    if (!config.gates) {
      config.gates = { passRateMin: options.gate / 100 } as KindLMConfig["gates"];
    } else {
      config.gates.passRateMin = options.gate / 100;
    }
  }

  if (options.concurrency !== undefined) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
      console.error(chalk.red(`Invalid --concurrency value: ${options.concurrency}. Must be a positive integer (>= 1).`));
      process.exit(1);
    }
    config.defaults.concurrency = options.concurrency;
  }
  if (options.timeout !== undefined) {
    if (!Number.isInteger(options.timeout) || options.timeout < 0) {
      console.error(chalk.red(`Invalid --timeout value: ${options.timeout}. Must be a non-negative integer (>= 0).`));
      process.exit(1);
    }
    config.defaults.timeoutMs = options.timeout;
  }
  if (!isEnabled(featureFlags, "costGating") && config.gates) {
    config.gates = { ...config.gates, costMaxUsd: undefined };
  }

  // 4. Resolve API keys + create provider adapters (shared with `kindlm redteam generate`)
  const adapters = await initProviderAdapters(config, { noCache: options.noCache });

  // 5. Create + run
  let completedTests = 0;
  const totalTests = countExecutionUnits(config);

  const onEvent = (event: RunEvent) => {
    if (event.type === "test.started") {
      spinner.start(`Running ${event.test} [${event.model}] (${completedTests}/${totalTests})`);
    } else if (event.type === "test.completed" || event.type === "test.errored") {
      completedTests++;
    }
  };

  // Check if any tests use command mode
  const hasCommandTests = config.tests.some((t) => t.command);
  const commandExecutor = hasCommandTests ? createNodeCommandExecutor() : undefined;

  const runner = createRunner(config, {
    adapters,
    configDir,
    fileReader,
    onEvent,
    baselineData: options.baselineData,
    commandExecutor,
    betaJudge: isEnabled(featureFlags, "betaJudge"),
  });

  const runResult = await runner.run();

  spinner.stop();

  if (!runResult.success) {
    console.error(chalk.red(`Run failed: ${runResult.error.message}`));
    process.exit(1);
  }

  let artifactPaths: RunArtifactPaths | undefined;
  if (isEnabled(featureFlags, "runArtifacts")) {
    try {
      const gitInfo = getGitInfo();
      const configHash = computeConfigHash(yamlContent);
      artifactPaths = writeRunArtifacts(
        runResult.data,
        config.suite.name,
        configHash,
        gitInfo.commitSha ?? null,
        yamlContent,
      );
    } catch {
      console.warn(chalk.yellow("Warning: failed to write run artifacts (non-fatal)"));
    }
  }

  return {
    config,
    runnerResult: runResult.data,
    configDir,
    yamlContent,
    featureFlags,
    artifactPaths,
  };
}

function countExecutionUnits(config: KindLMConfig): number {
  let count = 0;
  for (const test of config.tests) {
    if (test.skip) continue;
    const repeat = test.repeat ?? config.defaults.repeat;
    if (test.command) {
      count += repeat;
    } else {
      const modelCount = test.models?.length ?? config.models.length;
      count += modelCount * repeat;
    }
  }
  return count;
}
