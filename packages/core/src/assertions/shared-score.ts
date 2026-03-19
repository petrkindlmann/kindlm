export type NormalizedScore =
  | { ok: true; score: number }
  | { ok: false; reason: string };

export function validateUnitIntervalScore(
  value: unknown,
  fieldName: string,
): NormalizedScore {
  if (typeof value !== "number") {
    return { ok: false, reason: `${fieldName} must be a number` };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, reason: `${fieldName} must be a finite number` };
  }
  if (value < 0 || value > 1) {
    return { ok: false, reason: `${fieldName} must be between 0 and 1 inclusive` };
  }
  return { ok: true, score: value };
}
