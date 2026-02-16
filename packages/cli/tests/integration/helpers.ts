import { createServer } from "node:http";
import type { Server, IncomingMessage, ServerResponse } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface MockServerOptions {
  handler?: (req: IncomingMessage, res: ServerResponse) => void;
}

const OPENAI_RESPONSE = {
  choices: [
    {
      message: { content: "Hello! I'm doing well, thank you.", tool_calls: null },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
  model: "gpt-4o-2024-08-06",
};

export function defaultOpenAIHandler(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(OPENAI_RESPONSE));
}

export async function createMockServer(
  options: MockServerOptions = {},
): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  const handler = options.handler ?? defaultOpenAIHandler;

  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      (req as IncomingMessage & { body: string }).body = body;
      handler(req, res);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        server,
        port,
        close: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

export function createTempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "kindlm-test-"));
  return {
    dir,
    cleanup: () => {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function writeConfig(dir: string, content: string): string {
  const path = join(dir, "kindlm.yaml");
  writeFileSync(path, content, "utf-8");
  return path;
}

export interface CLIResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI as a child process. Uses spawn (async) so the event loop
 * stays free — required when a mock HTTP server runs in the same process.
 */
export function runCLI(
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): Promise<CLIResult> {
  const cliPath = join(__dirname, "../../dist/kindlm.js");

  return new Promise((resolve) => {
    const child = spawn("node", [cliPath, ...args], {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env, FORCE_COLOR: "0" },
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    child.on("error", () => {
      resolve({ stdout, stderr, exitCode: 1 });
    });
  });
}
