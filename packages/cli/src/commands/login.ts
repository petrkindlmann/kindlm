import type { Command } from "commander";

export function registerLoginCommand(program: Command): void {
  program
    .command("login")
    .description("Authenticate with KindLM Cloud")
    .action(() => {
      throw new Error("Not implemented");
    });
}
