# OpenTelemetry Trace Ingestion

## Overview

The `kindlm trace` command lets you test real agent executions by ingesting their OpenTelemetry traces. Instead of sending prompts to providers, KindLM listens for OTLP/HTTP trace data, extracts model outputs and tool calls from span attributes, and runs assertions against them.

This is useful when:
- Your agent is already instrumented with OpenTelemetry
- You want to test against real production-like executions
- You need to validate traces from staging environments
- Your agent framework (LangChain, CrewAI, etc.) exports OTel traces

## Quick Start

```bash
# 1. Start trace listener and run your agent
kindlm trace --command "python my_agent.py"

# 2. Or start listener only, send traces from elsewhere
kindlm trace --port 4318 --timeout 60000
```

The trace command automatically sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:<port>` when spawning a command.

## Configuration

### kindlm.yaml

```yaml
trace:
  port: 4318
  timeoutMs: 30000
  spanMapping:
    outputTextAttr: gen_ai.completion.0.content
    modelAttr: gen_ai.response.model
    systemAttr: gen_ai.system
    inputTokensAttr: gen_ai.usage.input_tokens
    outputTokensAttr: gen_ai.usage.output_tokens
  spanFilter:
    namePattern: "^chat\\."
    attributeMatch:
      gen_ai.system: openai
    minDurationMs: 100
```

### Span Mapping

KindLM follows the [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) by default. The `spanMapping` section lets you override which span attributes map to assertion context fields:

| Field | Default Attribute | Purpose |
|-------|------------------|---------|
| `outputTextAttr` | `gen_ai.completion.0.content` | Model output text |
| `modelAttr` | `gen_ai.response.model` | Model identifier |
| `systemAttr` | `gen_ai.system` | Provider system (openai, anthropic, etc.) |
| `inputTokensAttr` | `gen_ai.usage.input_tokens` | Input token count |
| `outputTokensAttr` | `gen_ai.usage.output_tokens` | Output token count |

Tool calls are extracted from spans with `gen_ai.tool.name` and `gen_ai.tool.arguments` attributes.

### Span Filtering

Optional filters to select which spans are used for assertion evaluation:

| Field | Type | Description |
|-------|------|-------------|
| `namePattern` | regex | Only include spans whose name matches |
| `attributeMatch` | map | Only include spans with these exact attribute values |
| `minDurationMs` | number | Only include spans lasting at least this long |

## OTLP Protocol

KindLM accepts OTLP/HTTP JSON traces at `POST /v1/traces`. This is the standard OpenTelemetry collector endpoint.

### Request format

```json
{
  "resourceSpans": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "my-agent" } }
        ]
      },
      "scopeSpans": [
        {
          "scope": { "name": "openai.instrumentation" },
          "spans": [
            {
              "traceId": "abc123...",
              "spanId": "span1",
              "name": "chat.completions",
              "kind": 3,
              "startTimeUnixNano": "1700000000000000000",
              "endTimeUnixNano": "1700000001500000000",
              "attributes": [
                { "key": "gen_ai.system", "value": { "stringValue": "openai" } },
                { "key": "gen_ai.response.model", "value": { "stringValue": "gpt-4o" } },
                { "key": "gen_ai.completion.0.content", "value": { "stringValue": "Here is..." } }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Response

- `200` with `{ "partialSuccess": {} }` on success
- `400` on invalid JSON or malformed payload
- CORS headers are included for browser-based exporters

## Architecture

### Core (zero I/O)

```
packages/core/src/trace/
├── types.ts     OTLP wire types, ParsedSpan, TraceConfigSchema
├── parser.ts    parseOtlpPayload() — flattens resourceSpans → ParsedSpan[]
├── mapper.ts    filterSpans(), mapSpansToResult(), buildContextFromTrace()
└── index.ts     Barrel export
```

- **`parseOtlpPayload(raw)`** — Validates and flattens the nested OTLP structure into normalized `ParsedSpan` objects with millisecond timestamps and flat attribute maps.
- **`filterSpans(spans, filter)`** — Applies name pattern, attribute match, and duration filters.
- **`mapSpansToResult(spans, mapping)`** — Extracts output text, tool calls, tokens, latency from span attributes using the configured mapping.
- **`buildContextFromTrace(result, options)`** — Converts a `SpanMappingResult` into an `AssertionContext` that assertion handlers can evaluate.

### CLI

```
packages/cli/src/
├── utils/trace-server.ts    OTLP HTTP server (node:http)
└── commands/trace.ts        kindlm trace command registration
```

- **`createTraceServer(port)`** — Lightweight HTTP server that accepts `POST /v1/traces`, parses payloads via core, and collects spans. Provides `start()`, `stop()`, `getSpans()`, `waitForSpans({timeoutMs})`.
- **`registerTraceCommand(program)`** — Commander command that orchestrates: parse config → start server → spawn command → wait → filter/map → evaluate assertions → report.

## Integration Examples

### Python with opentelemetry-instrumentation

```bash
# Install OTel instrumentation
pip install opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-http

# Run with KindLM trace collection
kindlm trace --command "opentelemetry-instrument python my_agent.py"
```

### Node.js with @opentelemetry/auto-instrumentations-node

```bash
kindlm trace --command "node --require @opentelemetry/auto-instrumentations-node my_agent.js"
```

### Manual OTLP export

```bash
# Start listener
kindlm trace --timeout 120000 &

# Run your agent pointing at the listener
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
OTEL_EXPORTER_OTLP_PROTOCOL=http/json \
python my_agent.py

# Traces are collected and assertions evaluated when timeout expires
```

## Latency Calculation

Latency is computed from **root spans only** (spans without a `parentSpanId`). Child span durations are not added to avoid double-counting. If multiple root spans exist, their durations are summed.
