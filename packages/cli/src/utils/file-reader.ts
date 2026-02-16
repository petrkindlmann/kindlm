import { readFileSync } from "node:fs";
import type { FileReader, Result } from "@kindlm/core";

export function createNodeFileReader(): FileReader {
  return {
    readFile(path: string): Result<string> {
      try {
        return { success: true, data: readFileSync(path, "utf-8") };
      } catch (e) {
        return {
          success: false,
          error: {
            code: "CONFIG_FILE_REF_ERROR",
            message: `Cannot read file: ${path}: ${e instanceof Error ? e.message : String(e)}`,
          },
        };
      }
    },
  };
}
