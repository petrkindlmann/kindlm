import type { AssertionContext } from "../assertions/interface.js";
import type { ProviderToolCall, ProviderAdapter } from "../types/provider.js";
import type { ParsedSpan, SpanMapping, SpanFilter, SpanMappingResult } from "./types.js";
import { hasNestedQuantifiers } from "../assertions/pii.js";

export function filterSpans(spans: ParsedSpan[], filter?: SpanFilter): ParsedSpan[] {
  if (!filter) return spans;

  return spans.filter((span) => {
    if (filter.namePattern) {
      if (hasNestedQuantifiers(filter.namePattern)) {
        // Unsafe pattern — skip name filtering to prevent ReDoS
        return true;
      }
      const re = new RegExp(filter.namePattern);
      if (!re.test(span.name)) return false;
    }

    if (filter.attributeMatch) {
      for (const [key, value] of Object.entries(filter.attributeMatch)) {
        if (String(span.attributes[key]) !== value) return false;
      }
    }

    if (filter.minDurationMs !== undefined) {
      if (span.durationMs < filter.minDurationMs) return false;
    }

    return true;
  });
}

export function mapSpansToResult(
  spans: ParsedSpan[],
  mapping: SpanMapping,
): SpanMappingResult {
  let outputText = "";
  const toolCalls: { id: string; name: string; arguments: Record<string, unknown> }[] = [];
  let latencyMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let model: string | undefined;
  let system: string | undefined;

  for (const span of spans) {
    const attrs = { ...span.resourceAttributes, ...span.attributes };

    // Extract output text from the configured attribute
    const text = attrs[mapping.outputTextAttr];
    if (typeof text === "string" && text) {
      outputText = outputText ? `${outputText}\n${text}` : text;
    }

    // Extract model
    const m = attrs[mapping.modelAttr];
    if (typeof m === "string" && m) {
      model = m;
    }

    // Extract system
    const s = attrs[mapping.systemAttr];
    if (typeof s === "string" && s) {
      system = s;
    }

    // Extract tokens
    const inTok = attrs[mapping.inputTokensAttr];
    if (typeof inTok === "number") {
      inputTokens += inTok;
    }
    const outTok = attrs[mapping.outputTokensAttr];
    if (typeof outTok === "number") {
      outputTokens += outTok;
    }

    // Accumulate latency from root spans (no parent)
    if (!span.parentSpanId) {
      latencyMs += span.durationMs;
    }

    // Look for tool call attributes (GenAI convention)
    const toolName = attrs["gen_ai.tool.name"];
    const toolArgs = attrs["gen_ai.tool.arguments"];
    if (typeof toolName === "string") {
      let parsedArgs: Record<string, unknown> = {};
      if (typeof toolArgs === "string") {
        try {
          parsedArgs = JSON.parse(toolArgs) as Record<string, unknown>;
        } catch {
          // ignore parse errors
        }
      }
      toolCalls.push({
        id: span.spanId,
        name: toolName,
        arguments: parsedArgs,
      });
    }
  }

  return {
    outputText,
    toolCalls,
    latencyMs,
    inputTokens,
    outputTokens,
    model,
    system,
  };
}

export interface BuildContextOptions {
  configDir: string;
  judgeAdapter?: ProviderAdapter;
  judgeModel?: string;
  baselineText?: string;
}

export function buildContextFromTrace(
  result: SpanMappingResult,
  options: BuildContextOptions,
): AssertionContext {
  const toolCalls: ProviderToolCall[] = result.toolCalls.map((tc, i) => ({
    id: tc.id,
    name: tc.name,
    arguments: tc.arguments,
    index: i,
  }));

  return {
    outputText: result.outputText,
    toolCalls,
    configDir: options.configDir,
    latencyMs: result.latencyMs,
    judgeAdapter: options.judgeAdapter,
    judgeModel: options.judgeModel,
    baselineText: options.baselineText,
  };
}
