import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { RunResult, GateEvaluation } from "@kindlm/core";
import { selectReporter } from "./select-reporter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// utils/ -> src/ -> package root
const PKG_VERSION: string = (
  JSON.parse(
    readFileSync(resolve(__dirname, "../../package.json"), "utf-8"),
  ) as { version: string }
).version;

const EMPTY_RUN: RunResult = {
  suites: [],
  totalTests: 0,
  passed: 0,
  failed: 0,
  errored: 0,
  skipped: 0,
  durationMs: 0,
};

const PASS_GATES: GateEvaluation = { passed: true, gates: [] };

describe("selectReporter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(process, "exit").mockImplementation(
      (_code?: string | number | null) => {
        throw new Error("process.exit");
      },
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns a reporter with name 'pretty' for 'pretty'", () => {
    const r = selectReporter("pretty");
    expect(r.name).toBe("pretty");
  });

  it("returns a reporter with name 'json' for 'json'", () => {
    const r = selectReporter("json");
    expect(r.name).toBe("json");
  });

  it("returns a reporter with name 'junit' for 'junit'", () => {
    const r = selectReporter("junit");
    expect(r.name).toBe("junit");
  });

  it("calls console.error and process.exit(1) on unknown reporter type", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(
      (_code?: string | number | null) => {
        throw new Error("process.exit");
      },
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => selectReporter("nope")).toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errorArg = String(errorSpy.mock.calls[0]![0]);
    expect(errorArg).toContain("nope");
    expect(errorArg).toContain("pretty");
    expect(errorArg).toContain("json");
    expect(errorArg).toContain("junit");
  });
});

describe("selectReporter version stamping (#4 false-green)", () => {
  it("GATING: JSON reporter stamps the real package.json version threaded from the caller", async () => {
    const reporter = selectReporter("json", PKG_VERSION);
    const out = await reporter.generate(EMPTY_RUN, PASS_GATES);
    const parsed = JSON.parse(out.content) as { kindlm: { version: string } };
    // Proves the value flows caller -> selectReporter -> createJsonReporter
    // and equals packages/cli/package.json — never a silent "0.0.0".
    expect(parsed.kindlm.version).toBe(PKG_VERSION);
    expect(parsed.kindlm.version).not.toBe("0.0.0");
  });
});
