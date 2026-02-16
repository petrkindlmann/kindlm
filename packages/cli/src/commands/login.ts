/* eslint-disable no-console */
import type { Command } from "commander";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import chalk from "chalk";
import { loadToken, saveToken, clearToken } from "../cloud/auth.js";
import { createCloudClient, getCloudUrl, CloudApiError } from "../cloud/client.js";

interface LoginOptions {
  token?: string;
  status?: boolean;
  logout?: boolean;
}

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Authenticate with KindLM Cloud")
    .option("-t, --token <token>", "API token (skips interactive prompt)")
    .option("--status", "Show current authentication status")
    .option("--logout", "Remove stored credentials")
    .action(async (options: LoginOptions) => {
      try {
        if (options.logout) {
          clearToken();
          console.log(chalk.green("Logged out. Credentials removed."));
          return;
        }

        if (options.status) {
          await showStatus();
          return;
        }

        const token = options.token ?? process.env["KINDLM_API_TOKEN"] ?? (await promptForToken());

        if (!token.startsWith("klm_")) {
          console.error(chalk.red("Invalid token format. KindLM tokens start with \"klm_\"."));
          process.exit(1);
        }

        // Validate token against Cloud API
        const client = createCloudClient(getCloudUrl(), token);
        try {
          await client.get("/v1/auth/tokens");
        } catch (e) {
          if (e instanceof CloudApiError && e.status === 401) {
            console.error(chalk.red("Invalid or expired token."));
            process.exit(1);
          }
          throw e;
        }

        saveToken(token);
        console.log(chalk.green("Authenticated successfully. Token saved."));
      } catch (e) {
        console.error(chalk.red(`Login failed: ${e instanceof Error ? e.message : String(e)}`));
        process.exit(1);
      }
    });
}

async function showStatus(): Promise<void> {
  const token = loadToken();
  if (!token) {
    console.log(chalk.yellow("Not authenticated. Run \"kindlm login\" to authenticate."));
    return;
  }

  const client = createCloudClient(getCloudUrl(), token);
  try {
    await client.get("/v1/auth/tokens");
    console.log(chalk.green("Authenticated."));
    console.log(`  Cloud URL: ${getCloudUrl()}`);
  } catch (e) {
    if (e instanceof CloudApiError && e.status === 401) {
      console.log(chalk.yellow("Stored token is invalid or expired. Run \"kindlm login\" to re-authenticate."));
    } else {
      console.log(chalk.yellow(`Cannot reach Cloud API: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
}

function promptForToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Muted output stream suppresses echo of typed characters
    const muted = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
    });

    process.stderr.write("Paste your KindLM API token: ");
    const rl = createInterface({ input: process.stdin, output: muted, terminal: true });

    rl.question("", (answer) => {
      rl.close();
      process.stderr.write("\n");
      const trimmed = answer.trim();
      if (!trimmed) {
        reject(new Error("No token provided"));
        return;
      }
      resolve(trimmed);
    });
  });
}
