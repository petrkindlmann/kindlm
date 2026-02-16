import type { Command } from "commander";

export function registerBaselineCommand(program: Command): void {
  const baseline = program
    .command("baseline")
    .description("Manage test baselines");

  baseline
    .command("set")
    .description("Save current results as baseline")
    .action(() => {
      throw new Error("Not implemented");
    });

  baseline
    .command("compare")
    .description("Compare latest against baseline")
    .action(() => {
      throw new Error("Not implemented");
    });

  baseline
    .command("list")
    .description("List saved baselines")
    .action(() => {
      throw new Error("Not implemented");
    });
}
