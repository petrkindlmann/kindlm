import { createServer } from "node:http";
import type { Server, IncomingMessage, ServerResponse } from "node:http";
import { parseOtlpPayload } from "@kindlm/core";
import type { ParsedSpan } from "@kindlm/core";

export interface TraceServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  getSpans(): ParsedSpan[];
  waitForSpans(options: { timeoutMs: number }): Promise<ParsedSpan[]>;
}

export function createTraceServer(port: number): TraceServer {
  const collectedSpans: ParsedSpan[] = [];
  let server: Server | null = null;
  let spanListeners: (() => void)[] = [];

  function notifyListeners() {
    for (const listener of spanListeners) {
      listener();
    }
  }

  function handleRequest(req: IncomingMessage, res: ServerResponse) {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST" || req.url !== "/v1/traces") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const MAX_BODY_BYTES = 10 * 1024 * 1024;
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let aborted = false;
    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        aborted = true;
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload too large" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (aborted) return;
      try {
        const body = Buffer.concat(chunks).toString("utf-8");
        const parsed = JSON.parse(body) as unknown;
        const result = parseOtlpPayload(parsed);

        if (result.success) {
          collectedSpans.push(...result.data);
          notifyListeners();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ partialSuccess: {} }));
        } else {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: result.error.message }));
        }
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
  }

  return {
    start() {
      return new Promise<void>((resolve, reject) => {
        server = createServer(handleRequest);
        server.on("error", reject);
        server.listen(port, () => resolve());
      });
    },

    stop() {
      return new Promise<void>((resolve) => {
        if (server) {
          server.close(() => resolve());
        } else {
          resolve();
        }
      });
    },

    getSpans() {
      return [...collectedSpans];
    },

    waitForSpans({ timeoutMs }) {
      return new Promise<ParsedSpan[]>((resolve) => {
        if (collectedSpans.length > 0) {
          resolve([...collectedSpans]);
          return;
        }

        const timer = setTimeout(() => {
          spanListeners = spanListeners.filter((l) => l !== onSpan);
          resolve([...collectedSpans]);
        }, timeoutMs);

        const onSpan = () => {
          clearTimeout(timer);
          spanListeners = spanListeners.filter((l) => l !== onSpan);
          // Wait a short period for any remaining spans to arrive
          setTimeout(() => resolve([...collectedSpans]), 500);
        };
        spanListeners.push(onSpan);
      });
    },
  };
}
