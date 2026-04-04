import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";

/**
 * OWASP LLM10 — Unbounded Consumption.
 *
 * Stub for S01 — token-blowup and loop-induction probes land in S02/S03.
 */
export function createUnboundedConsumptionPlugin(): RedTeamPlugin {
  return {
    id: "unbounded-consumption",
    category: "LLM10",
    defaultSeverity: "medium",
    description:
      "OWASP LLM10: attempts to drive the target into runaway token generation, expensive tool loops, or cost blowouts.",

    async generate() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "unbounded-consumption.generate is not implemented in S01 — added in S02/S03.",
      });
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "unbounded-consumption.grade is not implemented in S01 — added in S02/S03.",
      });
    },
  };
}
