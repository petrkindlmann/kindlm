# Integration Guide: KindLM + Vercel AI SDK

> Test behavioral correctness of TypeScript agents built with Vercel's AI SDK.

## Overview

The Vercel AI SDK is the most popular TypeScript framework for building AI-powered applications, especially in Next.js. It supports tool calling natively via `generateText()` and `streamText()` with providers like OpenAI, Anthropic, and Google.

**KindLM is also TypeScript-native**, making this the most natural integration. No Python bridge needed — everything stays in the same ecosystem.

---

## Integration Pattern: Direct TypeScript Adapter

Since both KindLM and Vercel AI SDK are TypeScript, you can write a native provider adapter.

### `providers/vercel-ai-adapter.ts`

```typescript
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type { ProviderAdapter, ProviderResponse, ToolCall } from '@kindlm/core';

// ── Define your tools ──────────────────────────────

const lookupOrder = tool({
  description: 'Look up an order by ID',
  parameters: z.object({
    order_id: z.string().describe('The order ID'),
  }),
  execute: async ({ order_id }) => ({
    order_id,
    status: 'shipped',
    tracking: 'FX123456789',
  }),
});

const verifyIdentity = tool({
  description: 'Verify customer identity',
  parameters: z.object({
    customer_id: z.string().describe('Customer ID'),
  }),
  execute: async ({ customer_id }) => ({
    verified: true,
    customer_id,
  }),
});

const processRefund = tool({
  description: 'Process a refund',
  parameters: z.object({
    order_id: z.string().describe('Order to refund'),
    amount: z.number().describe('Refund amount'),
  }),
  execute: async ({ order_id, amount }) => ({
    refunded: true,
    order_id,
    amount,
  }),
});

// ── KindLM Adapter ────────────────────────────────

export class VercelAIAdapter implements ProviderAdapter {
  async invoke(
    systemPrompt: string,
    userMessage: string,
    toolDefs: any[],
    toolMocks: Map<string, (args: any) => any>
  ): Promise<ProviderResponse> {
    
    // Build tool map — use mocks if provided, otherwise real tools
    const tools: Record<string, any> = {};
    
    for (const [name, mockFn] of toolMocks.entries()) {
      tools[name] = tool({
        description: `Mocked: ${name}`,
        parameters: z.object({}).passthrough(),
        execute: async (args) => mockFn(args),
      });
    }

    // Add real tools for any not mocked
    if (!toolMocks.has('lookup_order')) tools.lookup_order = lookupOrder;
    if (!toolMocks.has('verify_identity')) tools.verify_identity = verifyIdentity;
    if (!toolMocks.has('process_refund')) tools.process_refund = processRefund;

    // Run the agent
    const result = await generateText({
      model: openai('gpt-4o'),
      system: systemPrompt,
      prompt: userMessage,
      tools,
      maxSteps: 10, // Allow multi-step tool usage
    });

    // Extract tool calls from steps
    const toolCalls: ToolCall[] = [];
    
    for (const step of result.steps) {
      for (const tc of step.toolCalls) {
        toolCalls.push({
          name: tc.toolName,
          arguments: tc.args,
        });
      }
      for (const tr of step.toolResults) {
        // Match result to the corresponding tool call
        const matching = toolCalls.find(
          c => c.name === tr.toolName && !c.result
        );
        if (matching) {
          matching.result = tr.result;
        }
      }
    }

    return {
      text: result.text,
      toolCalls,
      metadata: {
        steps: result.steps.length,
        finishReason: result.finishReason,
        usage: result.usage,
      },
    };
  }
}
```

### KindLM Config

```yaml
providers:
  vercel-ai-agent:
    type: custom
    adapter: ./providers/vercel-ai-adapter.ts

suites:
  - name: vercel-ai-support-agent
    provider: vercel-ai-agent
    system_prompt: |
      You are a customer support agent. Always verify identity 
      before processing refunds. Be helpful and professional.

    tests:
      - name: order-lookup
        input: "Where is order ORD-789?"
        assertions:
          - type: tool_called
            tool: lookup_order
            args: { order_id: "ORD-789" }
          - type: tool_not_called
            tool: process_refund
          - type: no_pii

      - name: refund-sequence
        input: "Refund order ORD-456 please"
        assertions:
          - type: tool_order
            sequence:
              - verify_identity
              - process_refund
          - type: tool_called
            tool: verify_identity

      - name: multi-step-resolution
        input: "I have a problem with order ORD-123, can you look it up and refund if it's late?"
        assertions:
          - type: tool_called
            tool: lookup_order
            args: { order_id: "ORD-123" }
          - type: tool_called
            tool: verify_identity
```

---

## Testing Next.js Route Handlers

If your agent runs as a Next.js API route, test against the endpoint:

### `app/api/agent/route.ts` (your production code)

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a helpful support agent.',
    messages,
    tools: { /* your tools */ },
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
```

### KindLM Config for API Testing

```yaml
providers:
  nextjs-agent:
    type: custom
    adapter: ./providers/nextjs-api-adapter.ts
    config:
      url: http://localhost:3000/api/agent

suites:
  - name: nextjs-agent-tests
    provider: nextjs-agent
    tests:
      - name: api-returns-correct-tools
        input: "Check order ORD-100"
        assertions:
          - type: tool_called
            tool: lookup_order
```

---

## Testing with `maxSteps`

Vercel AI SDK's `maxSteps` controls how many tool-use iterations the model can perform. Test that your agent converges within the expected number of steps:

```yaml
tests:
  - name: resolves-within-step-budget
    input: "Look up order ORD-100 and refund if eligible"
    assertions:
      - type: tool_called
        tool: lookup_order
      - type: tool_called
        tool: verify_identity
      - type: tool_called
        tool: process_refund
      # Total tools called should be ≤ 5 (within maxSteps budget)
      - type: latency
        max_ms: 15000  # 5 steps × ~3s each
```

---

## Testing `streamText` vs `generateText`

Both functions support tool calling. For testing, prefer `generateText` (returns complete result) over `streamText` (requires stream consumption):

```typescript
// In your adapter, force generateText for testing
const result = await generateText({
  model: openai('gpt-4o'),
  system: systemPrompt,
  prompt: userMessage,
  tools,
  maxSteps: 10,
  // generateText returns all steps at once — easier to extract tool calls
});

// result.steps contains all tool calls in order
// result.toolCalls contains the final step's calls
// result.toolResults contains the final step's results
```

---

## Zod Schema Validation

Vercel AI SDK uses Zod for tool parameter schemas. KindLM can validate that tool arguments match expected shapes:

```yaml
tests:
  - name: tool-args-match-schema
    input: "Refund order ORD-456 for $49.99"
    assertions:
      - type: tool_called
        tool: process_refund
        args:
          order_id: "ORD-456"
          amount: 49.99
      - type: json_schema
        schema:
          type: object
          required: [order_id, amount]
          properties:
            order_id:
              type: string
              pattern: "^ORD-\\d+$"
            amount:
              type: number
              minimum: 0
```

---

## Tips

1. **Same ecosystem**: Both KindLM and Vercel AI SDK are TypeScript — no language bridge needed.
2. **`result.steps`** is the key property. Each step contains `toolCalls` and `toolResults` arrays.
3. **Multi-provider testing**: Vercel AI SDK supports multiple providers. Test the same agent with different models to catch provider-specific behavioral differences.
4. **Edge functions**: For Vercel Edge deployments, run KindLM tests against a local dev server (`next dev`) in CI before deploying.
