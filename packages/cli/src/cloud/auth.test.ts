import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Use process.env for temp dir (works cross-platform, not affected by vi.mock hoisting)
const sysTmp = process.env["TMPDIR"] ?? process.env["TMP"] ?? process.env["TEMP"] ?? "/tmp";
const testDir = mkdtempSync(join(sysTmp, "kindlm-auth-test-"));

vi.mock("node:os", () => ({
  homedir: () => testDir,
}));

import { saveToken, loadToken, clearToken, getCredentialsPath } from "./auth.js";

describe("auth", () => {
  beforeEach(() => {
    clearToken();
  });

  afterEach(() => {
    clearToken();
  });

  it("saveToken + loadToken roundtrip", () => {
    saveToken("klm_abc123");
    const loaded = loadToken();
    expect(loaded).toBe("klm_abc123");
  });

  it("loadToken returns null when no file exists", () => {
    const loaded = loadToken();
    expect(loaded).toBeNull();
  });

  it("clearToken removes the file", () => {
    saveToken("klm_test");
    expect(loadToken()).toBe("klm_test");

    clearToken();
    expect(loadToken()).toBeNull();
  });

  it("saveToken creates the .kindlm directory", () => {
    saveToken("klm_dirtest");
    const credPath = getCredentialsPath();
    expect(existsSync(credPath)).toBe(true);

    const content = JSON.parse(readFileSync(credPath, "utf-8")) as { token: string; savedAt: string };
    expect(content.token).toBe("klm_dirtest");
    expect(content.savedAt).toBeTruthy();
  });

  it("loadToken returns null when credentials file contains malformed JSON", () => {
    const credPath = getCredentialsPath();
    const dir = credPath.replace("/credentials", "");
    mkdirSync(dir, { recursive: true });
    writeFileSync(credPath, "not-valid-json");
    expect(loadToken()).toBeNull();
  });

  it("loadToken returns null when token field is an empty string", () => {
    const credPath = getCredentialsPath();
    const dir = credPath.replace("/credentials", "");
    mkdirSync(dir, { recursive: true });
    writeFileSync(credPath, JSON.stringify({ token: "", savedAt: new Date().toISOString() }));
    expect(loadToken()).toBeNull();
  });

  it("clearToken is idempotent — calling twice does not throw", () => {
    saveToken("klm_idempotent");
    clearToken();
    expect(() => clearToken()).not.toThrow();
  });

  it("saveToken overwrites an existing token", () => {
    saveToken("klm_first");
    saveToken("klm_second");
    expect(loadToken()).toBe("klm_second");
  });

  it("savedAt field is a valid ISO date string", () => {
    saveToken("klm_datetest");
    const credPath = getCredentialsPath();
    const content = JSON.parse(readFileSync(credPath, "utf-8")) as { token: string; savedAt: string };
    expect(() => new Date(content.savedAt)).not.toThrow();
    expect(new Date(content.savedAt).toISOString()).toBe(content.savedAt);
  });
});
