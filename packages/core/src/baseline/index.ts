export {
  readBaseline,
  writeBaseline,
  listBaselines,
  serializeBaseline,
  deserializeBaseline,
  migrateBaseline,
  BASELINE_VERSION,
} from "./store.js";
export type { BaselineIO, BaselineTestEntry, BaselineData, MigrationResult } from "./store.js";

export { buildBaselineData } from "./builder.js";

export { compareBaseline } from "./compare.js";
export type {
  BaselineComparison,
  BaselineRegression,
  BaselineImprovement,
  BaselineUnchanged,
} from "./compare.js";
