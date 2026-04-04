import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";

/**
 * OWASP LLM05 — Improper Output Handling.
 *
 * Stub for S01 — real probes (SSRF, XSS, SQL-ish payload smuggling) land
 * in S02/S03.
 */
export function createImproperOutputHandlingPlugin(): RedTeamPlugin {
  return {
    id: "improper-output-handling",
    category: "LLM05",
    defaultSeverity: "high",
    description:
      "OWASP LLM05: attempts to make the target emit output a downstream system would mishandle — unescaped HTML, shell metacharacters, SQL fragments, or SSRF-style URLs.",

    async generate() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "improper-output-handling.generate is not implemented in S01 — added in S02/S03.",
      });
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "improper-output-handling.grade is not implemented in S01 — added in S02/S03.",
      });
    },
  };
}
