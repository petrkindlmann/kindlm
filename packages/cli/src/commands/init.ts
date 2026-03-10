/* eslint-disable no-console */
import type { Command } from "commander";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";

const TEMPLATE = `kindlm: 1
project: my-project

suite:
  name: my-agent-tests
  description: Behavioral tests for my AI agent

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY

models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
    params:
      temperature: 0
      maxTokens: 1024

prompts:
  greeting:
    system: You are a helpful assistant.
    user: "{{message}}"

tests:
  - name: basic-greeting
    prompt: greeting
    vars:
      message: Hello, how are you?
    expect:
      output:
        contains:
          - hello
      guardrails:
        pii:
          enabled: true

gates:
  passRateMin: 0.95

defaults:
  repeat: 1
  concurrency: 4
  timeoutMs: 60000
`;

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a kindlm.yaml template")
    .option("--force", "Overwrite existing kindlm.yaml")
    .action((options: { force?: boolean }) => {
      const filePath = resolve(process.cwd(), "kindlm.yaml");

      if (existsSync(filePath) && !options.force) {
        console.error(chalk.red("kindlm.yaml already exists. Use --force to overwrite."));
        process.exit(1);
      }

      try {
        writeFileSync(filePath, TEMPLATE, "utf-8");
      } catch (e) {
        const code = e instanceof Error && "code" in e ? (e as NodeJS.ErrnoException).code : undefined;
        if (code === "EACCES" || code === "EROFS") {
          console.error(chalk.red("Cannot create kindlm.yaml: permission denied"));
        } else {
          console.error(chalk.red(`Cannot create kindlm.yaml: ${e instanceof Error ? e.message : String(e)}`));
        }
        process.exit(1);
      }
      console.log(chalk.green("Created kindlm.yaml"));
      console.log("");
      console.log("Next steps:");
      console.log(`  1. Edit ${chalk.bold("kindlm.yaml")} with your test configuration`);
      console.log(`  2. Set your API key: ${chalk.bold("export OPENAI_API_KEY=sk-...")}`);
      console.log(`  3. Run tests: ${chalk.bold("kindlm test")}`);
    });
}
