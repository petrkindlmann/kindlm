import type { Command } from "commander";

export function registerTestCommand(program: Command): void {
  program
    .command("test")
    .description("Run test suites")
    .option("-s, --suite <name>", "Run a specific suite")
    .option("--compliance", "Generate compliance report")
    .option("--reporter <type>", "Output format: pretty, json, junit", "pretty")
    .option("--runs <count>", "Override run count")
    .option("--gate <percent>", "Fail if pass rate below threshold")
    .action(() => {
      throw new Error("Not implemented");
    });
}
