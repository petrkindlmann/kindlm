import { readFileSync } from "node:fs";
import { join } from "node:path";

// When to add a feature flag vs. just shipping:
//   ADD a flag when: the feature is experimental, opt-in-only, or may break existing runs.
//   SHIP directly when: the feature is backward-compatible and safe for all users.
//   REMOVE a flag when: the feature graduates to default-on after one minor release cycle.
//
// Config file: .kindlm/config.json (project-level, gitignore this file)
// Schema: { "features": { "flagName": boolean } }
// All flags default to false — absent file = all disabled.

export type FeatureFlags = {
  betaJudge: boolean;
  costGating: boolean;
  runArtifacts: boolean;
};

const DEFAULTS: FeatureFlags = {
  betaJudge: false,
  costGating: false,
  runArtifacts: false,
};

export function loadFeatureFlags(cwd = process.cwd()): FeatureFlags {
  const configPath = join(cwd, ".kindlm", "config.json");
  let parsed: unknown;
  try {
    const raw = readFileSync(configPath, "utf-8");
    parsed = JSON.parse(raw);
  } catch {
    // File absent, unreadable, or malformed JSON — return all-false defaults
    return { ...DEFAULTS };
  }

  const features =
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)["features"]
      : undefined;

  if (features === null || features === undefined || typeof features !== "object" || Array.isArray(features)) {
    return { ...DEFAULTS };
  }

  const flagMap = features as Record<string, unknown>;
  return {
    betaJudge: !!flagMap["betaJudge"],
    costGating: !!flagMap["costGating"],
    runArtifacts: !!flagMap["runArtifacts"],
  };
}

export function isEnabled(flags: FeatureFlags, flag: keyof FeatureFlags): boolean {
  return flags[flag] ?? false;
}
