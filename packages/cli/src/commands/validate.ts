import type { Command } from "commander";

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("Validate kindlm.yaml configuration")
    .action(() => {
      throw new Error("Not implemented");
    });
}
