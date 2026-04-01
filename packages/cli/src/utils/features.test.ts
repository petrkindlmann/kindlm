import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadFeatureFlags, isEnabled } from "./features.js";

describe("loadFeatureFlags", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `kindlm-flags-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns all-false defaults when config file is absent", () => {
    const flags = loadFeatureFlags(tmpDir);
    expect(flags.betaJudge).toBe(false);
    expect(flags.costGating).toBe(false);
    expect(flags.runArtifacts).toBe(false);
  });

  it("returns all-false defaults when JSON is malformed (no throw)", () => {
    const configDir = join(tmpDir, ".kindlm");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "config.json"), "{ this is: not valid json }");

    expect(() => loadFeatureFlags(tmpDir)).not.toThrow();
    const flags = loadFeatureFlags(tmpDir);
    expect(flags.betaJudge).toBe(false);
    expect(flags.costGating).toBe(false);
    expect(flags.runArtifacts).toBe(false);
  });

  it("returns betaJudge=true when config sets { features: { betaJudge: true } }", () => {
    const configDir = join(tmpDir, ".kindlm");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ features: { betaJudge: true } }),
    );

    const flags = loadFeatureFlags(tmpDir);
    expect(flags.betaJudge).toBe(true);
    expect(flags.costGating).toBe(false);
    expect(flags.runArtifacts).toBe(false);
  });

  it("ignores unknown keys in features without crashing", () => {
    const configDir = join(tmpDir, ".kindlm");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({ features: { betaJudge: true, unknownFlag: true, anotherUnknown: 42 } }),
    );

    expect(() => loadFeatureFlags(tmpDir)).not.toThrow();
    const flags = loadFeatureFlags(tmpDir);
    expect(flags.betaJudge).toBe(true);
    expect(flags.costGating).toBe(false);
    expect(flags.runArtifacts).toBe(false);
    // unknown keys should not appear on the typed result
    expect((flags as Record<string, unknown>)["unknownFlag"]).toBeUndefined();
  });
});

describe("isEnabled", () => {
  it("returns the flag value when key exists", () => {
    const flags = { betaJudge: true, costGating: false, runArtifacts: true };
    expect(isEnabled(flags, "betaJudge")).toBe(true);
    expect(isEnabled(flags, "costGating")).toBe(false);
    expect(isEnabled(flags, "runArtifacts")).toBe(true);
  });
});
