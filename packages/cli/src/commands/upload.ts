/* eslint-disable no-console */
import type { Command } from "commander";
import { basename } from "node:path";
import { execSync } from "node:child_process";
import chalk from "chalk";
import { loadToken } from "../cloud/auth.js";
import { createCloudClient, getCloudUrl } from "../cloud/client.js";
import { loadLastRun } from "../utils/last-run.js";
import { getGitInfo } from "../utils/git.js";
import { detectCI } from "../utils/env.js";
import { uploadResults } from "../cloud/upload.js";
import { createSpinner } from "../utils/spinner.js";

interface UploadCommandOptions {
  token?: string;
  project?: string;
}

export function registerUploadCommand(program: Command): void {
  program
    .command("upload")
    .description("Push last run results to KindLM Cloud")
    .option("-t, --token <token>", "API token (overrides stored token)")
    .option("-p, --project <name>", "Project name")
    .action(async (options: UploadCommandOptions) => {
      try {
        const token = options.token ?? process.env["KINDLM_API_TOKEN"] ?? loadToken();
        if (!token) {
          console.error(chalk.red("Not authenticated. Run \"kindlm login\" first or pass --token."));
          process.exit(1);
        }

        const lastRun = loadLastRun();
        if (!lastRun) {
          console.error(chalk.red("No test run found. Run \"kindlm test\" first."));
          process.exit(1);
        }

        const gitInfo = getGitInfo();
        const ciEnv = detectCI();
        const projectName = options.project ?? resolveProjectName();

        const client = createCloudClient(getCloudUrl(), token);
        const spinner = createSpinner();
        spinner.start("Uploading results to KindLM Cloud...");

        try {
          const result = await uploadResults(client, lastRun.runnerResult, {
            projectName,
            suiteName: lastRun.suiteName,
            configHash: lastRun.configHash,
            commitSha: ciEnv.commitSha ?? gitInfo.commitSha ?? undefined,
            branch: ciEnv.branch ?? gitInfo.branch ?? undefined,
            environment: ciEnv.isCI ? "ci" : "local",
            triggeredBy: ciEnv.name ?? "local",
          });

          spinner.succeed("Uploaded successfully.");
          console.log(`  Run ID:  ${result.runId}`);
          console.log(`  Project: ${projectName}`);
          console.log(`  Suite:   ${lastRun.suiteName}`);
        } catch (e) {
          spinner.fail("Upload failed.");
          throw e;
        }
      } catch (e) {
        console.error(chalk.red(`Upload failed: ${e instanceof Error ? e.message : String(e)}`));
        process.exit(1);
      }
    });
}

function extractRepoName(remoteUrl: string): string | null {
  // HTTPS: https://github.com/org/repo.git
  try {
    const parsed = new URL(remoteUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) return last.replace(/\.git$/, "");
  } catch {
    // Not a standard URL — try SSH format
  }

  // SSH: git@github.com:org/repo.git
  const sshMatch = remoteUrl.match(/^[\w.-]+@[\w.-]+:(.+?)(?:\.git)?$/);
  if (sshMatch?.[1]) {
    const segments = sshMatch[1].split("/");
    return segments[segments.length - 1] ?? null;
  }

  return null;
}

function resolveProjectName(): string {
  try {
    const remote = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    const name = extractRepoName(remote);
    if (name) return name;
  } catch {
    // Not in a git repo or no remote
  }
  return basename(process.cwd());
}
