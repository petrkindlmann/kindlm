import type { Assertion } from "./interface.js";
import type { Expect } from "../types/config.js";

export type AssertionFactory = (config: Expect) => Assertion;

export function createAssertionRegistry(): Map<string, AssertionFactory> {
  throw new Error("Not implemented");
}
