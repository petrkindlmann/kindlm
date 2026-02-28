export { parseOtlpPayload } from "./parser.js";

export { filterSpans, mapSpansToResult, buildContextFromTrace } from "./mapper.js";
export type { BuildContextOptions } from "./mapper.js";

export { TraceConfigSchema, SpanMappingSchema, SpanFilterSchema } from "./types.js";
export type {
  OtlpTracesPayload,
  OtlpResourceSpans,
  OtlpScopeSpans,
  OtlpSpan,
  OtlpAttribute,
  OtlpAttributeValue,
  ParsedSpan,
  SpanMappingResult,
  TraceConfig,
  SpanMapping,
  SpanFilter,
} from "./types.js";
