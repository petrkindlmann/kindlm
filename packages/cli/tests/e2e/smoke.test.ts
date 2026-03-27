import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_BIN = resolve(__dirname, "../../dist/kindlm.js");
const CONFIG = resolve(__dirname, "smoke-kindlm.yaml");

describe.skipIf(!process.env.OPENAI_API_KEY)("E2E smoke test (CLI-02)", () => {
  it("runs a real test against OpenAI and exits 0", () => {
    const result = execSync(`node ${CLI_BIN} test -c ${CONFIG}`, {
      encoding: "utf-8",
      timeout: 60_000,
      env: { ...process.env },
    });
    expect(result).toContain("passed");
    // CLI-05: verify output went to stdout (not empty)
    expect(result.length).toBeGreaterThan(10);
  }, 60_000);

  it("exit code is 0 on pass", () => {
    // execSync throws on non-zero exit, so reaching here means exit 0
    execSync(`node ${CLI_BIN} test -c ${CONFIG}`, {
      encoding: "utf-8",
      timeout: 60_000,
      env: { ...process.env },
    });
  }, 60_000);

  it("validate works without API key on the smoke config", () => {
    // CLI-04: validate should work with no OPENAI_API_KEY set
    const env = { ...process.env };
    delete env.OPENAI_API_KEY;
    const result = execSync(`node ${CLI_BIN} validate -c ${CONFIG}`, {
      encoding: "utf-8",
      timeout: 10_000,
      env,
    });
    expect(result).toContain("Config is valid");
  }, 10_000);
});
