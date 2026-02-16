import type { Result } from "../types/result.js";
import { ok, err } from "../types/result.js";

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

export function interpolate(
  template: string,
  vars: Record<string, string>,
): Result<string> {
  const missing = findMissingVars(template, vars);
  if (missing.length > 0) {
    return err({
      code: "CONFIG_VALIDATION_ERROR",
      message: `Missing template variables: ${missing.join(", ")}`,
      details: { missing },
    });
  }
  const result = template.replace(
    PLACEHOLDER_RE,
    (_match, key: string) => vars[key] as string,
  );
  return ok(result);
}

export function findMissingVars(
  template: string,
  vars: Record<string, string>,
): string[] {
  const missing = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const key = match[1];
    if (key !== undefined && !(key in vars)) {
      missing.add(key);
    }
  }
  return [...missing];
}
