/* eslint-disable no-console */
import type { Command } from "commander";
import chalk from "chalk";
import {
  evaluateGates,
  createComplianceReporter,
  ProviderError,
} from "@kindlm/core";
import type { KindlmError, ComplianceRunMetadata } from "@kindlm/core";
import { runTests } from "../utils/run-tests.js";
import { saveLastRun, computeConfigHash } from "../utils/last-run.js";
import { renderCompliancePdf } from "../utils/pdf-renderer.js";
import { selectReporter } from "../utils/select-reporter.js";
import { getGitInfo } from "../utils/git.js";

declare const KINDLM_VERSION: string;

interface TestOptions {
  suite?: string;
  compliance?: boolean;
  reporter: string;
  runs?: string;
  gate?: string;
  config: string;
  pdf?: string;
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
    .action(async (options: TestOptions) => {
      if (options.pdf && !options.compliance) {
        console.error(chalk.red("--pdf requires --compliance"));
        process.exit(1);
      }

      // P-02: Validate reporter before running tests to fail fast
      const reporter = selectReporter(options.reporter);

      try {
        const { runnerResult, config, yamlContent } = await runTests({
          configPath: options.config,
          runs: options.runs !== undefined ? parseInt(options.runs, 10) : undefined,
          gate: options.gate !== undefined ? parseFloat(options.gate) : undefined,
          suite: options.suite,
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
          });
        } catch {
          // Non-fatal — don't block exit on cache failure
        }

        // Exit code
        const allPassed = result.failed === 0 && result.errored === 0 && gateEvaluation.passed;
        process.exit(allPassed ? 0 : 1);
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
        process.exit(1);
      }
    });
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
