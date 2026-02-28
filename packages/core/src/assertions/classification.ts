export type AssertionCategory = "deterministic" | "probabilistic";

const PROBABILISTIC_TYPES = new Set(["judge", "drift"]);

export function classifyAssertion(assertionType: string): AssertionCategory {
  return PROBABILISTIC_TYPES.has(assertionType) ? "probabilistic" : "deterministic";
}

export function isDeterministic(assertionType: string): boolean {
  return classifyAssertion(assertionType) === "deterministic";
}

export function isProbabilistic(assertionType: string): boolean {
  return classifyAssertion(assertionType) === "probabilistic";
}
