/* eslint-disable no-console */
import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import chalk from "chalk";
import {
  parseConfig,
  createProvider,
  createRunner,
} from "@kindlm/core";
import type {
  ProviderAdapter,
  KindLMConfig,
  ProgressEvent,
  RunnerResult,
  BaselineData,
} from "@kindlm/core";
import { createHttpClient } from "./http.js";
import { createSpinner } from "./spinner.js";
import { createNodeFileReader } from "./file-reader.js";

export interface RunTestsOptions {
  configPath: string;
  runs?: number;
  gate?: number;
  baselineData?: BaselineData;
}

export interface RunTestsResult {
  config: KindLMConfig;
  runnerResult: RunnerResult;
  configDir: string;
  yamlContent: string;
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
    console.error(chalk.red(`Config validation failed: ${parseResult.error.message}`));
    process.exit(1);
  }

  const config: KindLMConfig = parseResult.data;

  // 3. Apply CLI overrides
  if (options.runs !== undefined) {
    config.defaults.repeat = options.runs;
  }
  if (options.gate !== undefined) {
    if (!config.gates) {
      config.gates = { passRateMin: options.gate / 100 } as KindLMConfig["gates"];
    } else {
      config.gates.passRateMin = options.gate / 100;
    }
  }

  // 4. Resolve API keys + create provider adapters
  const httpClient = createHttpClient();
  const adapters = new Map<string, ProviderAdapter>();

  const providers = config.providers as Record<string, { apiKeyEnv?: string; baseUrl?: string; organization?: string } | undefined>;
  for (const [name, providerConfig] of Object.entries(providers)) {
    if (!providerConfig) continue;

    let apiKey = "";
    if (providerConfig.apiKeyEnv) {
      const key = process.env[providerConfig.apiKeyEnv];
      if (!key) {
        console.error(chalk.red(`Missing environment variable: ${providerConfig.apiKeyEnv}`));
        process.exit(1);
      }
      apiKey = key.trim();
    } else if (name !== "ollama") {
      console.error(chalk.red(`Provider "${name}" requires apiKeyEnv to be configured`));
      process.exit(1);
    }

    let adapter: ProviderAdapter;
    try {
      adapter = createProvider(name, httpClient);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      console.error(chalk.red(`Failed to create provider "${name}": ${msg}`));
      process.exit(1);
    }

    await adapter.initialize({
      apiKey,
      baseUrl: providerConfig.baseUrl,
      organization: providerConfig.organization,
      timeoutMs: config.defaults.timeoutMs,
      maxRetries: 2,
    });

    adapters.set(name, adapter);
  }

  // 5. Create + run
  let completedTests = 0;
  const totalTests = countExecutionUnits(config);

  const onProgress = (event: ProgressEvent) => {
    if (event.type === "test_start") {
      spinner.start(`Running ${event.test} [${event.model}] (${completedTests}/${totalTests})`);
    } else if (event.type === "test_complete") {
      completedTests++;
    }
  };

  const runner = createRunner(config, {
    adapters,
    configDir,
    fileReader,
    onProgress,
    baselineData: options.baselineData,
  });

  const runResult = await runner.run();
  spinner.stop();

  if (!runResult.success) {
    console.error(chalk.red(`Run failed: ${runResult.error.message}`));
    process.exit(1);
  }

  return {
    config,
    runnerResult: runResult.data,
    configDir,
    yamlContent,
  };
}

function countExecutionUnits(config: KindLMConfig): number {
  let count = 0;
  for (const test of config.tests) {
    if (test.skip) continue;
    const modelCount = test.models?.length ?? config.models.length;
    const repeat = test.repeat ?? config.defaults.repeat;
    count += modelCount * repeat;
  }
  return count;
}
