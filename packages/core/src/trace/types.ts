import { z } from "zod";

// ============================================================
// OTLP JSON Wire Types (subset we care about)
// ============================================================

export interface OtlpAttribute {
  key: string;
  value: OtlpAttributeValue;
}

export interface OtlpAttributeValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OtlpAttributeValue[] };
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: OtlpAttribute[];
  status?: { code?: number; message?: string };
}

export interface OtlpScopeSpans {
  scope?: { name?: string; version?: string };
  spans: OtlpSpan[];
}

export interface OtlpResourceSpans {
  resource?: {
    attributes?: OtlpAttribute[];
  };
  scopeSpans: OtlpScopeSpans[];
}

export interface OtlpTracesPayload {
  resourceSpans: OtlpResourceSpans[];
}

// ============================================================
// Normalized Parsed Span
// ============================================================

export interface ParsedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  attributes: Record<string, string | number | boolean>;
  resourceAttributes: Record<string, string | number | boolean>;
  statusCode?: number;
  statusMessage?: string;
}

// ============================================================
// Span Mapping Result
// ============================================================

export interface SpanMappingResult {
  outputText: string;
  toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[];
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  model?: string;
  system?: string;
}

// ============================================================
// Trace Config Schema (for kindlm.yaml)
// ============================================================

export const SpanMappingSchema = z.object({
  outputTextAttr: z.string().default("gen_ai.completion.0.content"),
  modelAttr: z.string().default("gen_ai.response.model"),
  systemAttr: z.string().default("gen_ai.system"),
  inputTokensAttr: z.string().default("gen_ai.usage.input_tokens"),
  outputTokensAttr: z.string().default("gen_ai.usage.output_tokens"),
});

export const SpanFilterSchema = z.object({
  namePattern: z.string().optional().describe("Regex to filter span names"),
  attributeMatch: z.record(z.string()).optional().describe("Attributes that must match"),
  minDurationMs: z.number().min(0).optional(),
});

export const TraceConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(4318),
  timeoutMs: z.number().int().min(1000).default(30000),
  spanMapping: SpanMappingSchema.default({}),
  spanFilter: SpanFilterSchema.optional(),
});

export type TraceConfig = z.infer<typeof TraceConfigSchema>;
export type SpanMapping = z.infer<typeof SpanMappingSchema>;
export type SpanFilter = z.infer<typeof SpanFilterSchema>;
