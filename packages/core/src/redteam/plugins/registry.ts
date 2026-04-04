import type { Result, KindlmError } from "../../types/result.js";
import { ok, err } from "../../types/result.js";
import { suggestClosest } from "../../config/parser.js";
import type { Severity } from "../types.js";
import type { RedTeamPlugin } from "./interface.js";
import { createPromptInjectionPlugin } from "./owasp/prompt-injection.js";
import { createPiiDisclosurePlugin } from "./owasp/pii-disclosure.js";
import { createImproperOutputHandlingPlugin } from "./owasp/improper-output-handling.js";
import { createExcessiveAgencyPlugin } from "./owasp/excessive-agency.js";
import { createSystemPromptLeakagePlugin } from "./owasp/system-prompt-leakage.js";
import { createMisinformationPlugin } from "./owasp/misinformation.js";
import { createUnboundedConsumptionPlugin } from "./owasp/unbounded-consumption.js";
import { createHarmfulContentPlugin } from "./owasp/harmful-content.js";
import { createPolicyPlugin } from "./policy.js";

// ============================================================
// Built-in Plugin Id Catalog
// ============================================================

/**
 * Static catalog of every plugin id the registry knows how to build.
 *
 * Keep this in lock-step with the factories imported above. The list is
 * also used to power Levenshtein "did you mean" suggestions when users
 * typo a plugin id in their YAML.
 */
export const BUILTIN_PLUGIN_IDS = [
  "prompt-injection",
  "pii-disclosure",
  "improper-output-handling",
  "excessive-agency",
  "system-prompt-leakage",
  "misinformation",
  "unbounded-consumption",
  "harmful-content",
  "policy",
] as const;

export type BuiltinPluginId = (typeof BUILTIN_PLUGIN_IDS)[number];

// ============================================================
// Public input shape
// ============================================================

/**
 * Registry input — exactly the shape the Zod `RedTeamPluginEntrySchema`
 * produces after validation, minus the numTests field which the registry
 * doesn't care about. Kept narrow on purpose so callers outside the
 * config flow can build one from a partial source.
 */
export interface RedTeamPluginConfigInput {
  id: string;
  severity?: Severity;
  config?: Record<string, unknown>;
}

// ============================================================
// Severity Resolution
// ============================================================

/**
 * Return the effective severity for a plugin run.
 *
 * The user's per-entry override always wins; otherwise we fall back to
 * the plugin's `defaultSeverity`. Centralized here so every caller —
 * registry, engine, reporters — uses the same rule.
 */
export function resolveSeverity(
  plugin: RedTeamPlugin,
  override?: Severity,
): Severity {
  return override ?? plugin.defaultSeverity;
}

// ============================================================
// Plugin Instantiation
// ============================================================

function instantiatePlugin(
  id: BuiltinPluginId,
  config: Record<string, unknown> | undefined,
): Result<RedTeamPlugin, KindlmError> {
  switch (id) {
    case "prompt-injection":
      return ok(createPromptInjectionPlugin());
    case "pii-disclosure":
      return ok(createPiiDisclosurePlugin());
    case "improper-output-handling":
      return ok(createImproperOutputHandlingPlugin());
    case "excessive-agency":
      return ok(createExcessiveAgencyPlugin());
    case "system-prompt-leakage":
      return ok(createSystemPromptLeakagePlugin());
    case "misinformation":
      return ok(createMisinformationPlugin());
    case "unbounded-consumption":
      return ok(createUnboundedConsumptionPlugin());
    case "harmful-content":
      return ok(createHarmfulContentPlugin());
    case "policy": {
      // Belt-and-suspenders: the schema-level superRefine (T01) already
      // enforces this, but the registry is also a public entry point so
      // we re-check here. Keeps us honest if a caller builds a plugin
      // entry by hand instead of going through validateRedTeamConfig.
      const policy =
        config && typeof config === "object"
          ? (config as Record<string, unknown>).policy
          : undefined;
      if (typeof policy !== "string" || policy.trim().length === 0) {
        return err({
          code: "CONFIG_VALIDATION_ERROR",
          message:
            "The 'policy' plugin requires a non-empty config.policy string.",
        });
      }
      return ok(createPolicyPlugin({ policy }));
    }
  }
}

// ============================================================
// Registry Factory
// ============================================================

/**
 * Build a map of ready-to-run red team plugins from validated config
 * entries.
 *
 * The map is keyed by `${id}#${index}` — indexing by position rather
 * than id alone lets users declare multiple policy plugins in one run
 * without collision:
 *
 * ```yaml
 * plugins:
 *   - id: policy
 *     config: { policy: "Never recommend competitors." }
 *   - id: policy
 *     config: { policy: "Never discuss pricing outside the pricing page." }
 * ```
 *
 * Unknown plugin ids are collected into a single
 * `CONFIG_VALIDATION_ERROR` so the user sees every typo at once instead
 * of one per invocation. Each error includes a Levenshtein-based "did
 * you mean" hint when a close match exists.
 */
export function createRedTeamPluginRegistry(
  pluginConfigs: readonly RedTeamPluginConfigInput[],
): Result<Map<string, RedTeamPlugin>, KindlmError> {
  const map = new Map<string, RedTeamPlugin>();
  const errors: string[] = [];
  const knownIds = [...BUILTIN_PLUGIN_IDS] as string[];

  pluginConfigs.forEach((entry, index) => {
    if (!knownIds.includes(entry.id)) {
      const suggestion = suggestClosest(entry.id, knownIds);
      const hint = suggestion
        ? ` Did you mean: "${suggestion}"?`
        : ` Known plugins: ${knownIds.map((id) => `"${id}"`).join(", ")}`;
      errors.push(
        `plugins[${index}].id: Unknown red team plugin "${entry.id}".${hint}`,
      );
      return;
    }

    const built = instantiatePlugin(
      entry.id as BuiltinPluginId,
      entry.config,
    );
    if (!built.success) {
      errors.push(`plugins[${index}]: ${built.error.message}`);
      return;
    }

    map.set(`${entry.id}#${index}`, built.data);
  });

  if (errors.length > 0) {
    return err({
      code: "CONFIG_VALIDATION_ERROR",
      message: "Red team plugin registry validation failed",
      details: { errors },
    });
  }

  return ok(map);
}
