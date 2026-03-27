import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_BIN = resolve(__dirname, "../../dist/kindlm.js");
const CONFIG = resolve(__dirname, "smoke-kindlm.yaml");

describe.skipIf(!process.env.OPENAI_API_KEY)("E2E smoke test", () => {
  it("runs a real test against OpenAI and passes", () => {
    const result = execSync(`node ${CLI_BIN} test -c ${CONFIG}`, {
      encoding: "utf-8",
      timeout: 60_000,
      env: { ...process.env },
    });
    expect(result).toContain("passed");
  }, 60_000);
});
