export type {
  KindLMConfig,
  TestCase,
  Expect,
  ModelConfig,
  ProviderConfig,
  GatesConfig,
  JudgeCriterion,
  ToolCallExpect,
  ToolSimulation,
  ComplianceConfig,
  ConversationTurnConfig,
} from "../config/schema.js";

// Backward compatibility alias
export type { KindLMConfig as KindlmConfig } from "../config/schema.js";

export type { TraceConfig, SpanMapping, SpanFilter } from "../trace/types.js";
