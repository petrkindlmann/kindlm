import { spawn } from "node:child_process";
import { ok, err } from "@kindlm/core";
import type { CommandExecutor, CommandExecuteOptions, RawCommandOutput, Result } from "@kindlm/core";

export function createNodeCommandExecutor(): CommandExecutor {
  return {
    async execute(command: string, options: CommandExecuteOptions): Promise<Result<RawCommandOutput>> {
      return new Promise((resolve) => {
        const child = spawn("sh", ["-c", command], {
          cwd: options.cwd,
          env: { ...process.env, ...options.env },
          stdio: ["ignore", "pipe", "pipe"],
        });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

        const timer = setTimeout(() => {
          child.kill("SIGTERM");
          setTimeout(() => {
            if (!child.killed) child.kill("SIGKILL");
          }, 1000);
        }, options.timeoutMs);

        child.on("close", (code, signal) => {
          clearTimeout(timer);

          if (signal === "SIGTERM" || signal === "SIGKILL") {
            resolve(err({
              code: "PROVIDER_TIMEOUT",
              message: `Command timed out after ${options.timeoutMs}ms`,
            }));
            return;
          }

          resolve(ok({
            stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
            stderr: Buffer.concat(stderrChunks).toString("utf-8"),
            exitCode: code ?? 1,
          }));
        });

        child.on("error", (e) => {
          clearTimeout(timer);
          resolve(err({
            code: "UNKNOWN_ERROR",
            message: `Failed to spawn command: ${e.message}`,
          }));
        });
      });
    },
  };
}
