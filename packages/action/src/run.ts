import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as github from "@actions/github";
import type { KindlmJsonReport } from "./types.js";
import { buildCommentBody, upsertPrComment } from "./comment.js";
import { generateJunitXml, uploadJunitArtifact } from "./junit.js";

/**
 * Extract and parse the KindLM JSON report from CLI stdout.
 * The CLI may emit non-JSON spinner/progress text before the JSON object.
 * Falls back to locating the first '{' if a direct parse fails.
 */
export function parseJsonReport(stdout: string): KindlmJsonReport {
  // Try direct parse first (clean output)
  try {
    return JSON.parse(stdout) as KindlmJsonReport;
  } catch {
    // Find first '{' to skip any progress output before the JSON blob
    const start = stdout.indexOf("{");
    if (start !== -1) {
      return JSON.parse(stdout.slice(start)) as KindlmJsonReport;
    }
    throw new Error("Could not locate JSON object in kindlm output");
  }
}

/**
 * Build a minimal fallback report when JSON parsing fails entirely.
 * Uses the CLI exit code to determine pass/fail so outputs are still set.
 */
function buildFallbackReport(exitCode: number): KindlmJsonReport {
  const passed = exitCode === 0 ? 1 : 0;
  const failed = exitCode === 0 ? 0 : 1;
  return {
    kindlm: { version: "unknown", timestamp: new Date().toISOString() },
    summary: { totalTests: 1, passed, failed, errored: 0, skipped: 0, durationMs: 0 },
    gates: { passed: exitCode === 0, results: [] },
    suites: [],
  };
}

/**
 * Core action logic: installs @kindlm/cli, runs tests with JSON reporter,
 * parses output for counts, sets all step outputs, optionally uploads to Cloud.
 * Calls core.setFailed() if tests fail or an unexpected error occurs.
 */
export async function run(): Promise<void> {
  try {
    // Step 1: Read inputs
    const config = core.getInput("config") || "kindlm.yaml";
    const version = core.getInput("version") || "latest";
    const args = core.getInput("args") || "";
    const cloudToken = core.getInput("cloud-token");
    const comment = core.getInput("comment") !== "false";

    // Step 2: Install CLI globally (version pinning enables repeated kindlm calls)
    core.info(`Installing @kindlm/cli@${version}...`);
    await exec.exec("npm", ["install", "-g", `@kindlm/cli@${version}`]);

    // Step 3: Run tests with JSON reporter to capture structured output.
    // IMPORTANT: The CLI supports only a single --reporter flag.
    // We run with --reporter json to get parseable counts.
    // JUnit generation is handled in plan-02 by converting parsed JSON inside the action.
    const extraArgs = args.split(" ").filter(Boolean);
    const result = await exec.getExecOutput(
      "kindlm",
      ["test", "--config", config, "--reporter", "json", ...extraArgs],
      {
        // CRITICAL: kindlm exits 1 when tests fail — that is expected, not an error.
        // Without this flag, getExecOutput throws before we can read stdout.
        ignoreReturnCode: true,
      },
    );

    // Step 4: Parse JSON output for counts.
    // ACTION-08: Only extract summary counts and test names/status — never log response_text.
    let report: KindlmJsonReport;
    try {
      report = parseJsonReport(result.stdout);
    } catch (parseErr) {
      core.warning(
        `Failed to parse kindlm JSON output (${parseErr instanceof Error ? parseErr.message : String(parseErr)}). Using exit-code-based fallback.`,
      );
      report = buildFallbackReport(result.exitCode);
    }

    const { totalTests, passed, failed } = report.summary;
    const passRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    core.info(`Results: ${passed}/${totalTests} passed (${passRate.toFixed(1)}%)`);

    // Step 4b: Generate JUnit XML and upload as artifact (non-fatal)
    const xml = generateJunitXml(report);
    await uploadJunitArtifact(xml);

    // Step 4c: Post or update PR comment when comment input is enabled
    if (comment && github.context.eventName === "pull_request") {
      const body = buildCommentBody(report, passRate);
      await upsertPrComment(body);
    }

    // Step 5: Cloud upload — non-fatal per D-22 (upload failure must not fail CI)
    if (cloudToken) {
      try {
        await exec.exec("kindlm", ["upload"], {
          ignoreReturnCode: true,
          env: { ...process.env, KINDLM_API_TOKEN: cloudToken },
        });
      } catch (err) {
        core.warning(
          `Cloud upload failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Step 6: Set all step outputs
    core.setOutput("pass-rate", passRate.toFixed(1));
    core.setOutput("total", String(totalTests));
    core.setOutput("passed", String(passed));
    core.setOutput("failed", String(failed));
    core.setOutput("exit-code", String(result.exitCode));

    // Step 7: Propagate CLI exit code — test failures are expected outcomes, not action errors.
    // Only call setFailed here so downstream steps can still read the outputs we just set.
    if (result.exitCode !== 0) {
      core.setFailed(`KindLM tests failed: ${failed}/${totalTests} tests failed`);
    }
  } catch (err) {
    // Unexpected errors (install failure, parse crash, etc.) propagate via setFailed.
    core.setFailed(
      `Action failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
