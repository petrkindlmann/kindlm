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
  RunEvent,
  RunnerResult,
  BaselineData,
} from "@kindlm/core";
import { createHttpClient } from "./http.js";
import { createSpinner } from "./spinner.js";
import { createNodeFileReader } from "./file-reader.js";
import { createNodeCommandExecutor } from "./command-executor.js";
import { createCachingAdapter } from "./caching-adapter.js";
import { loadFeatureFlags, isEnabled } from "./features.js";
import type { FeatureFlags } from "./features.js";

export interface RunTestsOptions {
  configPath: string;
  runs?: number;
  gate?: number;
  suite?: string;
  baselineData?: BaselineData;
  noCache?: boolean;
  featureFlags?: FeatureFlags;
}

export interface RunTestsResult {
  config: KindLMConfig;
  runnerResult: RunnerResult;
  configDir: string;
  yamlContent: string;
  featureFlags: FeatureFlags;
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

  // 4. Resolve API keys + create provider adapters
  const httpClient = createHttpClient();
  const adapters = new Map<string, ProviderAdapter>();

  const providers = config.providers as Record<string, Record<string, unknown> | undefined>;
  for (const [name, providerConfig] of Object.entries(providers)) {
    if (!providerConfig) continue;

    const apiKeyEnv = providerConfig.apiKeyEnv as string | undefined;
    let apiKey = "";
    if (apiKeyEnv) {
      const key = process.env[apiKeyEnv];
      if (!key) {
        console.error(chalk.red(`Missing environment variable: ${apiKeyEnv}`));
        process.exit(1);
      }
      apiKey = key.trim();
    } else if (name !== "ollama" && name !== "http" && name !== "mcp") {
      console.error(chalk.red(`Provider "${name}" requires apiKeyEnv to be configured`));
      process.exit(1);
    }

    let adapter: ProviderAdapter;
    try {
      if (name === "http") {
        // HTTP provider gets its config object directly + env lookup
        const httpProviderConfig = providerConfig as {
          url: string;
          method?: string;
          headers?: Record<string, string>;
          body?: string;
          responsePath?: string;
          toolCallsPath?: string;
          usagePaths?: {
            inputTokens?: string;
            outputTokens?: string;
            totalTokens?: string;
          };
          modelIdPath?: string;
        };
        adapter = createProvider(name, httpClient, {
          httpConfig: httpProviderConfig,
          envLookup: (envName: string) => process.env[envName],
        });
      } else if (name === "mcp") {
        const mcpProviderConfig = providerConfig as {
          serverUrl: string;
          toolName: string;
          headers?: Record<string, string>;
        };
        // Resolve env: headers before passing to core (core is I/O-free)
        const resolvedHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(mcpProviderConfig.headers ?? {})) {
          if (v.startsWith("env:")) {
            const envVal = process.env[v.slice(4)];
            if (!envVal) {
              console.error(chalk.red(`Missing environment variable for MCP header "${k}": ${v.slice(4)}`));
              process.exit(1);
            }
            resolvedHeaders[k] = envVal;
          } else {
            resolvedHeaders[k] = v;
          }
        }
        adapter = createProvider(name, httpClient, {
          mcpConfig: {
            serverUrl: mcpProviderConfig.serverUrl,
            toolName: mcpProviderConfig.toolName,
            headers: resolvedHeaders,
          },
        });
      } else {
        adapter = createProvider(name, httpClient);
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      console.error(chalk.red(`Failed to create provider "${name}": ${msg}`));
      process.exit(1);
    }

    await adapter.initialize({
      apiKey,
      baseUrl: providerConfig.baseUrl as string | undefined,
      organization: providerConfig.organization as string | undefined,
      timeoutMs: config.defaults.timeoutMs,
      maxRetries: 2,
    });

    // Wrap with caching unless --no-cache
    if (!options.noCache) {
      adapters.set(name, createCachingAdapter(adapter));
    } else {
      adapters.set(name, adapter);
    }
  }

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
  });

  const runResult = await runner.run();

  // runArtifacts flag: only write run artifacts when explicitly opted in.
  // Phase 02 wires the actual writer here once that phase ships.
  if (isEnabled(featureFlags, "runArtifacts")) {
    // artifact writer will be injected here in phase 02
  }

  spinner.stop();

  if (!runResult.success) {
    console.error(chalk.red(`Run failed: ${runResult.error.message}`));
    process.exit(1);
  }

  // betaJudge flag: reserved for assertion layer — gates experimental judge scoring in phase 03.
  // costGating flag: reserved for gate enforcement — gates cost-based pass/fail thresholds.

  return {
    config,
    runnerResult: runResult.data,
    configDir,
    yamlContent,
    featureFlags,
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
