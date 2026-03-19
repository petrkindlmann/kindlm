/* eslint-disable no-console */
import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawn } from "node:child_process";
import type { Command } from "commander";
import chalk from "chalk";
import {
  parseConfig,
  createProvider,
  filterSpans,
  mapSpansToResult,
  buildContextFromTrace,
  createAssertionsFromExpect,
} from "@kindlm/core";
import type {
  KindLMConfig,
  ProviderAdapter,
  TraceConfig,
  AssertionResult,
} from "@kindlm/core";
import { createTraceServer } from "../utils/trace-server.js";
import { createSpinner } from "../utils/spinner.js";
import { createNodeFileReader } from "../utils/file-reader.js";
import { createHttpClient } from "../utils/http.js";

export function registerTraceCommand(program: Command): void {
  program
    .command("trace")
    .description("Ingest OpenTelemetry traces and run assertions against them")
    .option("-c, --config <path>", "Config file path", "kindlm.yaml")
    .option("--port <port>", "OTLP HTTP port", "4318")
    .option("--command <cmd>", "Command to spawn (traces are collected while it runs)")
    .option("--timeout <ms>", "Timeout in ms to wait for traces", "30000")
    .option("--reporter <type>", "Report format: pretty, json, junit", "pretty")
    .action(async (opts: {
      config: string;
      port: string;
      command?: string;
      timeout: string;
      reporter: string;
    }) => {
      const spinner = createSpinner();

      try {
        // 1. Read and parse config
        const configPath = resolve(process.cwd(), opts.config);
        const configDir = dirname(configPath);

        try {
          const stat = statSync(configPath);
          if (stat.size > 1_048_576) {
            console.error(chalk.red("Config file exceeds 1MB limit"));
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

        const fileReader = createNodeFileReader();
        const parseResult = parseConfig(yamlContent, { configDir, fileReader });
        if (!parseResult.success) {
          console.error(chalk.red(`Config validation failed: ${parseResult.error.message}`));
          process.exit(1);
        }

        const config: KindLMConfig = parseResult.data;
        const traceConfig: TraceConfig = config.trace ?? {
          port: parseInt(opts.port, 10),
          timeoutMs: parseInt(opts.timeout, 10),
          spanMapping: {
            outputTextAttr: "gen_ai.completion.0.content",
            modelAttr: "gen_ai.response.model",
            systemAttr: "gen_ai.system",
            inputTokensAttr: "gen_ai.usage.input_tokens",
            outputTokensAttr: "gen_ai.usage.output_tokens",
          },
        };

        const port = parseInt(opts.port, 10) || traceConfig.port;
        const timeoutMs = parseInt(opts.timeout, 10) || traceConfig.timeoutMs;

        // 2. Start trace server
        const traceServer = createTraceServer(port);
        await traceServer.start();
        let child: ReturnType<typeof spawn> | undefined;
        try {
          spinner.start(`Listening for OTLP traces on port ${port}...`);

          // 3. Optionally spawn command
          if (opts.command) {
            child = spawn("sh", ["-c", opts.command], {
              cwd: configDir,
              env: {
                ...process.env,
                OTEL_EXPORTER_OTLP_ENDPOINT: `http://localhost:${port}`,
                OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
              },
              stdio: "inherit",
            });

            child.on("error", (e) => {
              spinner.fail(`Command failed: ${e.message}`);
            });
          }

          // 4. Wait for traces
          const spans = await traceServer.waitForSpans({ timeoutMs });

          if (spans.length === 0) {
            spinner.fail("No traces received");
            process.exit(1);
          }

          spinner.succeed(`Received ${spans.length} spans`);

          // 5. Filter and map spans
          const filtered = filterSpans(spans, traceConfig.spanFilter);
          const mappingResult = mapSpansToResult(filtered, traceConfig.spanMapping);

          // 6. Resolve judge adapter if needed
          const httpClient = createHttpClient();
          const adapters = new Map<string, ProviderAdapter>();
          const providers = config.providers as Record<string, { apiKeyEnv?: string; baseUrl?: string; organization?: string } | undefined>;

          for (const [name, providerConfig] of Object.entries(providers)) {
            if (!providerConfig) continue;
            let apiKey = "";
            if (providerConfig.apiKeyEnv) {
              const key = process.env[providerConfig.apiKeyEnv];
              if (key) apiKey = key.trim();
            }
            if (!apiKey && name !== "ollama") continue;

            try {
              const adapter = createProvider(name, httpClient);
              await adapter.initialize({
                apiKey,
                baseUrl: providerConfig.baseUrl,
                organization: providerConfig.organization,
                timeoutMs: config.defaults.timeoutMs,
                maxRetries: 2,
              });
              adapters.set(name, adapter);
            } catch {
              // Skip providers that fail to initialize
            }
          }

          const judgeModelId = config.defaults.judgeModel ?? config.models[0]?.id;
          const judgeModelConfig = config.models.find((m) => m.id === judgeModelId);
          const judgeAdapter = judgeModelConfig ? adapters.get(judgeModelConfig.provider) : undefined;

          // 7. Build context and evaluate assertions for each test
          const context = buildContextFromTrace(mappingResult, {
            configDir,
            judgeAdapter,
            judgeModel: judgeModelConfig?.model,
          });

          const testResults: { testName: string; assertions: AssertionResult[] }[] = [];

          for (const test of config.tests) {
            if (test.skip) continue;

            const assertions = createAssertionsFromExpect(test.expect);
            const allResults: AssertionResult[] = [];
            for (const assertion of assertions) {
              const results = await assertion.evaluate(context);
              allResults.push(...results);
            }
            testResults.push({ testName: test.name, assertions: allResults });
          }

          // 8. Report results
          const totalAssertions = testResults.reduce((s, t) => s + t.assertions.length, 0);
          const passedAssertions = testResults.reduce(
            (s, t) => s + t.assertions.filter((a) => a.passed).length,
            0,
          );
          const failedAssertions = totalAssertions - passedAssertions;

          console.log();
          console.log(chalk.bold("Trace Test Results"));
          console.log(chalk.dim("─".repeat(50)));

          for (const { testName, assertions } of testResults) {
            const allPassed = assertions.every((a) => a.passed);
            const icon = allPassed ? chalk.green("✓") : chalk.red("✗");
            console.log(`${icon} ${testName}`);

            for (const a of assertions) {
              const aIcon = a.passed ? chalk.green("  ✓") : chalk.red("  ✗");
              const label = a.failureMessage ? `${a.label}: ${a.failureMessage}` : a.label;
              console.log(`${aIcon} ${label}`);
            }
          }

          console.log();
          console.log(
            `${chalk.bold("Total:")} ${passedAssertions} passed, ${failedAssertions} failed out of ${totalAssertions} assertions`,
          );

          // 9. Exit code — trace uses assertion-level pass/fail, not gates
          process.exit(failedAssertions > 0 ? 1 : 0);
        } finally {
          child?.kill();
          await traceServer.stop();
        }
      } catch (e) {
        spinner.fail(`Trace command failed: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      }
    });
}
