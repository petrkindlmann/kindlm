import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Create a temp dir manually without importing os.tmpdir (since we mock node:os)
const testDir = mkdtempSync(join("/tmp", "kindlm-auth-test-"));

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
});
