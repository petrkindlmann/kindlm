import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { RunnerResult } from "@kindlm/core";

export interface LastRunData {
  runnerResult: RunnerResult;
  suiteName: string;
  configHash: string;
  timestamp: string;
  complianceReport?: string;
  complianceHash?: string;
}

function getLastRunPath(): string {
  return join(process.cwd(), ".kindlm", "last-run.json");
}

export function saveLastRun(data: LastRunData): void {
  const filePath = getLastRunPath();
  const dir = join(process.cwd(), ".kindlm");
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  // Strip individual run data (outputText, full assertions) to reduce file size.
  // Pre-extract failure messages since upload needs them.
  const slimmed: LastRunData = {
    ...data,
    runnerResult: {
      ...data.runnerResult,
      aggregated: data.runnerResult.aggregated.map((agg) => {
        const failureMessages = agg.runs
          .flatMap((r) => r.assertions.filter((a) => !a.passed).map((a) => a.failureMessage))
          .filter((m): m is string => m !== undefined);

        return {
          ...agg,
          failureMessages,
          runs: [],
        };
      }),
    },
  };

  writeFileSync(filePath, JSON.stringify(slimmed), { mode: 0o600 });
}

export function loadLastRun(): LastRunData | null {
  try {
    const raw = readFileSync(getLastRunPath(), "utf-8");
    const parsed = JSON.parse(raw) as LastRunData;
    if (
      parsed.runnerResult?.runResult &&
      Array.isArray(parsed.runnerResult.aggregated) &&
      typeof parsed.suiteName === "string" &&
      typeof parsed.configHash === "string" &&
      typeof parsed.timestamp === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function computeConfigHash(yamlContent: string): string {
  return createHash("sha256").update(yamlContent).digest("hex");
}
