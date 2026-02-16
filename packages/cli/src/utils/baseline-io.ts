import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { BaselineIO } from "@kindlm/core";
import type { Result } from "@kindlm/core";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function createFileBaselineIO(kindlmDir: string): BaselineIO {
  const baselinesDir = join(kindlmDir, "baselines");

  return {
    read(suiteName: string): Result<string> {
      const filePath = join(baselinesDir, `${sanitizeFilename(suiteName)}.json`);
      try {
        const content = readFileSync(filePath, "utf-8");
        return { success: true, data: content };
      } catch {
        return {
          success: false,
          error: {
            code: "BASELINE_NOT_FOUND",
            message: `No baseline found for suite "${suiteName}" at ${filePath}`,
          },
        };
      }
    },

    write(suiteName: string, content: string): Result<void> {
      try {
        mkdirSync(baselinesDir, { recursive: true });
        const filePath = join(baselinesDir, `${sanitizeFilename(suiteName)}.json`);
        writeFileSync(filePath, content, "utf-8");
        return { success: true, data: undefined };
      } catch (e) {
        return {
          success: false,
          error: {
            code: "UNKNOWN_ERROR",
            message: `Failed to write baseline: ${e instanceof Error ? e.message : String(e)}`,
          },
        };
      }
    },

    list(): Result<string[]> {
      try {
        mkdirSync(baselinesDir, { recursive: true });
        const files = readdirSync(baselinesDir);
        const names = files
          .filter((f) => f.endsWith(".json"))
          .map((f) => f.replace(/\.json$/, ""));
        return { success: true, data: names };
      } catch (e) {
        return {
          success: false,
          error: {
            code: "UNKNOWN_ERROR",
            message: `Failed to list baselines: ${e instanceof Error ? e.message : String(e)}`,
          },
        };
      }
    },
  };
}
