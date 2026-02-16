import { readFileSync, writeFileSync, mkdirSync, unlinkSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface CredentialsFile {
  token: string;
  savedAt: string;
}

export function getCredentialsPath(): string {
  return join(homedir(), ".kindlm", "credentials");
}

export function loadToken(): string | null {
  try {
    const raw = readFileSync(getCredentialsPath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<CredentialsFile>;
    if (typeof parsed.token === "string" && parsed.token.length > 0) {
      return parsed.token;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  const filePath = getCredentialsPath();
  const dir = join(homedir(), ".kindlm");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const data: CredentialsFile = { token, savedAt: new Date().toISOString() };
  writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  chmodSync(filePath, 0o600);
}

export function clearToken(): void {
  try {
    unlinkSync(getCredentialsPath());
  } catch {
    // File doesn't exist — nothing to clear
  }
}
