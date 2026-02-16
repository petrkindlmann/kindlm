import type { Command } from "commander";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Create a kindlm.yaml template")
    .action(() => {
      throw new Error("Not implemented");
    });
}
