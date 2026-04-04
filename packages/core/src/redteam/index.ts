// ============================================================
// @kindlm/core — redteam public surface
// ============================================================
//
// This barrel is intentionally narrow. Only the four things downstream
// packages need show up here:
//
//   1. Types (Severity, RedTeamCategory, Attack, AttackVerdict, context)
//   2. The Zod config schema + validator
//   3. The plugin interface + factory type
//   4. The registry (createRedTeamPluginRegistry + resolveSeverity)
//
// OWASP built-in plugin factories are deliberately NOT re-exported.
// Callers instantiate them through the registry so the catalog stays in
// one place and typos hit the Levenshtein path.

// Types
export type {
  RedTeamCategory,
  Severity,
  Attack,
  AttackVerdict,
  RedTeamPluginContext,
} from "./types.js";
export { SEVERITIES } from "./types.js";

// Config schema
export type {
  RedTeamConfig,
  RedTeamPluginEntry,
  RedTeamTargetConfig,
  RedTeamJudgeConfig,
  RedTeamStrategyConfig,
  RedTeamGatesConfig,
} from "./schema.js";
export { RedTeamConfigSchema, validateRedTeamConfig } from "./schema.js";

// Plugin interface
export type {
  RedTeamPlugin,
  RedTeamPluginFactory,
} from "./plugins/interface.js";

// Registry
export type {
  RedTeamPluginConfigInput,
  BuiltinPluginId,
} from "./plugins/registry.js";
export {
  createRedTeamPluginRegistry,
  resolveSeverity,
  BUILTIN_PLUGIN_IDS,
} from "./plugins/registry.js";

// Engine — attack generation aggregator (S02)
export type {
  AttackGenerationDeps,
  AttackGenerationResult,
  PerPluginGenerationResult,
} from "./engine/generate.js";
export { runAttackGeneration } from "./engine/generate.js";
