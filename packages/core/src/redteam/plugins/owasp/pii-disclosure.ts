import type { RedTeamPlugin } from "../interface.js";
import { err } from "../../../types/result.js";

/**
 * OWASP LLM02 — Sensitive Information Disclosure (PII).
 *
 * Stub for S01 — `generate`/`grade` return an `INTERNAL_ERROR` Result
 * until the PII probe bank and detector land in S02/S03.
 */
export function createPiiDisclosurePlugin(): RedTeamPlugin {
  return {
    id: "pii-disclosure",
    category: "LLM02",
    defaultSeverity: "high",
    description:
      "OWASP LLM02: probes that try to coax the target into leaking emails, phone numbers, credit cards, API keys, or other PII.",

    async generate() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "pii-disclosure.generate is not implemented in S01 — added in S02/S03.",
      });
    },

    async grade() {
      return err({
        code: "INTERNAL_ERROR",
        message:
          "pii-disclosure.grade is not implemented in S01 — added in S02/S03.",
      });
    },
  };
}
