import { Command } from "commander";
import { registerInitCommand } from "./commands/init.js";
import { registerValidateCommand } from "./commands/validate.js";
import { registerTestCommand } from "./commands/test.js";
import { registerBaselineCommand } from "./commands/baseline.js";
import { registerLoginCommand } from "./commands/login.js";
import { registerUploadCommand } from "./commands/upload.js";
import { registerTraceCommand } from "./commands/trace.js";

declare const KINDLM_VERSION: string;

export function createProgram(): Command {
  const program = new Command();

  program
    .name("kindlm")
    .description("AI agent behavioral regression testing")
    .version(KINDLM_VERSION);

  registerInitCommand(program);
  registerValidateCommand(program);
  registerTestCommand(program);
  registerBaselineCommand(program);
  registerLoginCommand(program);
  registerUploadCommand(program);
  registerTraceCommand(program);

  return program;
}
