import type { Command } from "commander";

export function registerUploadCommand(program: Command): void {
  program
    .command("upload")
    .description("Push last run results to KindLM Cloud")
    .action(() => {
      throw new Error("Not implemented");
    });
}
