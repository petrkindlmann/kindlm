import type { Result } from "../types/result.js";
import { ok, err } from "../types/result.js";

const PLACEHOLDER_RE = /\{\{([\w.]+)\}\}/g;

export function interpolate(
  template: string,
  vars: Record<string, string>,
  env?: Record<string, string | undefined>,
): Result<string> {
  const missing = findMissingVars(template, vars, env);
  if (missing.length > 0) {
    return err({
      code: "CONFIG_VALIDATION_ERROR",
      message: `Missing template variables: ${missing.join(", ")}`,
      details: { missing },
    });
  }
  const result = template.replace(
    PLACEHOLDER_RE,
    (raw, key: string) => {
      if (key.startsWith("env.")) {
        const envName = key.slice(4);
        const value = env?.[envName];
        // If env var not found, leave raw placeholder
        if (value === undefined) return raw;
        return value;
      }
      return vars[key] as string;
    },
  );
  return ok(result);
}

export function findMissingVars(
  template: string,
  vars: Record<string, string>,
  _env?: Record<string, string | undefined>,
): string[] {
  const missing = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const key = match[1];
    if (key === undefined) continue;
    // env.* vars are resolved from env — missing env vars are left as-is, not errors
    if (key.startsWith("env.")) continue;
    if (!(key in vars)) {
      missing.add(key);
    }
  }
  return [...missing];
}
