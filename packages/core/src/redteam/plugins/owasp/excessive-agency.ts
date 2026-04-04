import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";

/**
 * OWASP LLM06 — Excessive Agency.
 *
 * Stub for S01 — attack templates and tool-call grading arrive in S02/S03.
 */
export function createExcessiveAgencyPlugin(): RedTeamPlugin {
  return {
    id: "excessive-agency",
    category: "LLM06",
    defaultSeverity: "high",
    description:
      "OWASP LLM06: tries to provoke the target into taking actions beyond its authority — unsafe tool calls, destructive writes, or out-of-scope API usage.",

    async generate() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "excessive-agency.generate is not implemented in S01 — added in S02/S03.",
      });
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "excessive-agency.grade is not implemented in S01 — added in S02/S03.",
      });
    },
  };
}
