/* eslint-disable no-console */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { Command } from "commander";
import chalk from "chalk";
import {
  evaluateGates,
  createComplianceReporter,
  ProviderError,
  parseConfig,
  buildTestPlan,
} from "@kindlm/core";
import type { KindlmError, ComplianceRunMetadata } from "@kindlm/core";
import { runTests } from "../utils/run-tests.js";
import { saveLastRun, computeConfigHash } from "../utils/last-run.js";
import { renderCompliancePdf } from "../utils/pdf-renderer.js";
import { selectReporter } from "../utils/select-reporter.js";
import { getGitInfo } from "../utils/git.js";
import { formatTestPlan } from "../utils/dry-run.js";
import { watchFile } from "../utils/watcher.js";
import { createNodeFileReader } from "../utils/file-reader.js";
import { createWorktree, WorktreeError } from "../utils/worktree.js";

declare const KINDLM_VERSION: string;

interface TestOptions {
  suite?: string;
  compliance?: boolean;
  reporter: string;
  runs?: string;
  gate?: string;
  config: string;
  pdf?: string;
  dryRun?: boolean;
  watch?: boolean;
  noCache?: boolean;
  isolate?: boolean;
  concurrency?: string;
  timeout?: string;
}

export function registerTestCommand(program: Command): void {
  program
    .command("test")
    .description("Run test suites")
    .option("-s, --suite <name>", "Run a specific suite")
    .option("--compliance", "Generate compliance report")
    .option("--reporter <type>", "Output format: pretty, json, junit", "pretty")
    .option("--runs <count>", "Override run count")
    .option("--gate <percent>", "Fail if pass rate below threshold")
    .option("--pdf <path>", "Export compliance report as PDF (requires --compliance)")
    .option("-c, --config <path>", "Path to config file", "kindlm.yaml")
    .option("--dry-run", "Validate config and print test plan without executing")
    .option("--watch", "Re-run tests when kindlm.yaml changes")
    .option("--no-cache", "Disable response caching")
    .option("--isolate", "Run tests in an isolated git worktree (requires git)")
    .option("--concurrency <count>", "Override default test concurrency (must be >= 1)")
    .option("--timeout <ms>", "Override test execution timeout in ms (>= 0; does not affect provider HTTP timeout)")
    .action(async (options: TestOptions) => {
      if (options.pdf && !options.compliance) {
        console.error(chalk.red("--pdf requires --compliance"));
        process.exit(1);
      }

      // --dry-run: parse config, print plan, exit 0
      if (options.dryRun) {
        try {
          const configPath = resolve(process.cwd(), options.config);
          const configDir = dirname(configPath);
          const yamlContent = readFileSync(configPath, "utf-8");
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
          const plan = buildTestPlan(parseResult.data);
          console.log(formatTestPlan(plan));
          process.exit(0);
        } catch (e) {
          console.error(chalk.red(`Error: ${e instanceof Error ? e.message : String(e)}`));
          process.exit(1);
        }
      }

      // --watch: run once, then re-run on config file change
      if (options.watch) {
        const executeRun = async () => {
          await executeTestRun(options);
        };

        // Initial run
        await executeRun();

        const configPath = resolve(process.cwd(), options.config);
        console.log(chalk.dim(`\nWatching ${configPath} for changes...`));
        console.log(chalk.dim("Press Ctrl+C to stop.\n"));

        watchFile(configPath, () => {
          console.log(chalk.cyan("\nConfig changed. Re-running tests...\n"));
          executeRun().catch((e) => {
            console.error(chalk.red(`Error: ${e instanceof Error ? e.message : String(e)}`));
          });
        });

        // Keep process alive — watch mode runs until interrupted
        return;
      }

      // Normal (non-watch) execution
      await executeTestRun(options);
    });

  async function executeTestRun(options: TestOptions): Promise<void> {
    // P-02: Validate reporter before running tests to fail fast
    const reporter = selectReporter(options.reporter);

    // Set up optional worktree isolation before running tests
    let worktreeCleanup: (() => Promise<void>) | undefined;
    let originalCwd: string | undefined;

    if (options.isolate) {
      const suiteName = options.suite ?? "default";
      const runId = randomUUID().slice(0, 8);
      const slug = toWorktreeSlug(suiteName, runId);

      try {
        const wt = await createWorktree(slug);
        worktreeCleanup = wt.cleanup;
        originalCwd = process.cwd();
        process.chdir(wt.path);
        console.log(chalk.dim(`Worktree: ${wt.path}`));
      } catch (e) {
        // Degrade gracefully — run without isolation if worktree creation fails
        const msg = e instanceof WorktreeError ? e.message : String(e);
        console.warn(chalk.yellow(`Warning: could not create worktree (${msg}). Running without isolation.`));
      }
    }

    try {
      const { runnerResult, config, yamlContent, artifactPaths } = await runTests({
        configPath: options.config,
        runs: options.runs !== undefined ? parseInt(options.runs, 10) : undefined,
        gate: options.gate !== undefined ? parseFloat(options.gate) : undefined,
        suite: options.suite,
        noCache: options.noCache,
        concurrency: options.concurrency !== undefined ? parseInt(options.concurrency, 10) : undefined,
        timeout: options.timeout !== undefined ? parseInt(options.timeout, 10) : undefined,
      });

      const { runResult: result, aggregated } = runnerResult;

      // Evaluate gates
      const gateEvaluation = evaluateGates(config.gates, aggregated);

      // Generate report
      const report = await reporter.generate(result, gateEvaluation);
      console.log(report.content);

      // Compliance report
      let complianceContent: string | undefined;
      let complianceHash: string | undefined;
      if (options.compliance) {
        const gitInfo = getGitInfo();
        const metadata: ComplianceRunMetadata = {
          runId: crypto.randomUUID(),
          kindlmVersion: KINDLM_VERSION,
          gitCommitSha: gitInfo.commitSha ?? undefined,
          modelIds: config.models.map((m) => m.id),
          ...(config.compliance?.metadata ?? {}),
        };
        const complianceReporter = createComplianceReporter(metadata);
        const complianceReport = await complianceReporter.generate(result, gateEvaluation);
        complianceContent = complianceReport.content;
        // Extract the tamper evidence hash embedded in the report
        const hashMatch = complianceContent.match(/Tamper Evidence Hash \(SHA-256\):\*\* `([a-f0-9]{64})`/);
        complianceHash = hashMatch?.[1];

        // P-01: Write compliance to stderr for machine-readable reporters
        if (options.reporter === "pretty" || !options.reporter) {
          console.log("");
          console.log(complianceContent);
        } else {
          console.error("");
          console.error(complianceContent);
        }

        // PDF export
        if (options.pdf) {
          const pdfPath = await renderCompliancePdf(complianceContent, options.pdf);
          console.log("");
          console.log(chalk.green(`PDF report saved to ${pdfPath}`));
        }
      }

      // Cache last run for upload
      try {
        saveLastRun({
          runnerResult,
          suiteName: config.suite.name,
          configHash: computeConfigHash(yamlContent),
          timestamp: new Date().toISOString(),
          complianceReport: complianceContent,
          complianceHash,
          runId: artifactPaths?.runId,
          artifactDir: artifactPaths?.artifactDir,
        });
      } catch {
        // Non-fatal — don't block exit on cache failure
      }

      // Exit code — in watch mode, don't exit the process
      const allPassed = result.failed === 0 && result.errored === 0 && gateEvaluation.passed;
      if (!options.watch) {
        process.exit(allPassed ? 0 : 1);
      }
    } catch (e) {
      if (e instanceof ProviderError) {
        const prefix = e.code === "TIMEOUT"
          ? "Provider timeout"
          : e.code === "NETWORK_ERROR"
            ? "Network error"
            : e.code === "AUTH_FAILED"
              ? "Authentication failed"
              : e.code === "RATE_LIMITED"
                ? "Rate limited"
                : `Provider error (${e.code})`;
        console.error(chalk.red(`${prefix}: ${e.message}`));
        if (e.retryable) {
          console.error(chalk.yellow("This error may be transient. Try again or increase timeoutMs in your kindlm.yaml defaults."));
        }
      } else if (isKindlmError(e)) {
        const isConfig = e.code.startsWith("CONFIG_");
        const label = isConfig ? "Config error" : "Error";
        console.error(chalk.red(`${label}: ${e.message}`));
      } else if (e instanceof Error && e.name === "AbortError") {
        console.error(chalk.red("Request timed out. Check network connectivity or increase timeout."));
      } else {
        console.error(chalk.red(`Error: ${e instanceof Error ? e.message : String(e)}`));
      }
      if (!options.watch) {
        process.exit(1);
      }
    } finally {
      if (originalCwd) {
        process.chdir(originalCwd);
      }
      if (worktreeCleanup) {
        await worktreeCleanup();
      }
    }
  }
}

/**
 * Converts a suite name + run ID into a valid worktree slug.
 * Sanitizes non-allowed characters and caps total length at 64.
 */
function toWorktreeSlug(suite: string, runId: string): string {
  // Replace non-[a-zA-Z0-9._-] chars with "-", collapse runs of "-", strip leading/trailing "-"
  const sanitized = suite
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 55);
  return `${sanitized || "run"}-${runId}`;
}

function isKindlmError(e: unknown): e is KindlmError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    "message" in e &&
    typeof (e as KindlmError).code === "string" &&
    typeof (e as KindlmError).message === "string"
  );
}
