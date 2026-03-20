import type { Result } from "../types/result.js";
import { ok, err } from "../types/result.js";
import type {
  OtlpTracesPayload,
  OtlpAttribute,
  OtlpAttributeValue,
  ParsedSpan,
} from "./types.js";

export function parseOtlpPayload(raw: unknown): Result<ParsedSpan[]> {
  if (!raw || typeof raw !== "object") {
    return err({
      code: "CONFIG_PARSE_ERROR",
      message: "OTLP payload must be a non-null object",
    });
  }

  const payload = raw as OtlpTracesPayload;
  if (!Array.isArray(payload.resourceSpans)) {
    return err({
      code: "CONFIG_PARSE_ERROR",
      message: "OTLP payload missing resourceSpans array",
    });
  }

  const spans: ParsedSpan[] = [];

  for (const resourceSpan of payload.resourceSpans) {
    const resourceAttrs = flattenAttributes(resourceSpan.resource?.attributes ?? []);

    if (!Array.isArray(resourceSpan.scopeSpans)) continue;

    for (const scopeSpan of resourceSpan.scopeSpans) {
      if (!Array.isArray(scopeSpan.spans)) continue;

      for (const span of scopeSpan.spans) {
        const startTimeMs = nanosToMs(span.startTimeUnixNano);
        const endTimeMs = nanosToMs(span.endTimeUnixNano);

        spans.push({
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId || undefined,
          name: span.name,
          kind: span.kind,
          startTimeMs,
          endTimeMs,
          durationMs: endTimeMs - startTimeMs,
          attributes: flattenAttributes(span.attributes ?? []),
          resourceAttributes: resourceAttrs,
          statusCode: span.status?.code,
          statusMessage: span.status?.message,
        });
      }
    }
  }

  return ok(spans);
}

function nanosToMs(nanos: string): number {
  try {
    const n = BigInt(nanos);
    return Number(n / 1_000_000n);
  } catch {
    return 0;
  }
}

function flattenAttributes(
  attrs: OtlpAttribute[],
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  for (const attr of attrs) {
    const val = extractValue(attr.value);
    if (val !== undefined) {
      result[attr.key] = val;
    }
  }

  return result;
}

function extractValue(
  value: OtlpAttributeValue,
): string | number | boolean | undefined {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.intValue !== undefined) return parseInt(value.intValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.boolValue !== undefined) return value.boolValue;
  return undefined;
}
