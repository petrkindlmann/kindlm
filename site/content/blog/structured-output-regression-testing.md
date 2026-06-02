---
title: "Your agent's JSON is a contract, so test it like one"
description: "A field that goes missing, changes type, or drifts its enum values breaks the consumer silently while the text still looks right. Schema-validate structured output in CI like any other API response."
date: "2026-06-02"
author: "Petr Kindlmann"
---

Your agent emits JSON for a downstream service, the text reads fine in your eval, and three weeks later a queue is full of records with a `priority` field that is now the string `"high"` instead of the integer `2`.

## The output is a contract, so test it like one

When an agent returns prose, a human reads it and forgives small variation. When an agent returns JSON that another program parses, there is no forgiveness. The consumer expects a fixed shape: these keys, these types, these enum values. The moment the model deviates, the consumer either throws or, worse, silently coerces the bad value and carries on.

We already know how to handle this elsewhere. An HTTP API has a response schema, and we validate against it in integration tests. We do not merge a change that drops a required field from a payload. Yet agent output, which is strictly less stable than handwritten server code because a model produces it probabilistically, often ships with no schema check at all. The reasoning seems to be that because a language model wrote it, it must be approximately right. Approximately right is exactly the failure mode that breaks a parser.

The case I want to make is narrow: if your agent produces JSON that code consumes, that JSON deserves the same schema validation in CI that you would give any other API response. Not a vibe check. A validator with a verdict.

## The failure modes are boringly predictable

After watching enough of these break, the failures fall into a short list.

The model wraps the JSON in prose or a Markdown fence. You asked for an object and got a fenced code block with a cheerful sentence above it. `JSON.parse` dies on the first backtick.

A required field goes missing. The model decided the optional-looking field was optional today. Your consumer reads `record.assignee` and gets `undefined`.

A number arrives as a string. `"amount": "42.00"` instead of `"amount": 42.00`. This one is insidious because `JSON.parse` succeeds. The break happens later, in arithmetic, in a different service, far from the agent.

The model invents an enum value. You allow `status` to be `open`, `pending`, or `closed`, and one day it returns `in_progress` because that felt natural. Every value in isolation is a plausible string. Only the schema knows it is illegal.

And the quiet one: a model upgrade changes the shape. You bump from one snapshot to the next, the text quality is equal or better, and the JSON is now valid but wrong. A field nests one level deeper. An array becomes a single object when there is one element. Nothing errors in your eyeball test. Production errors instead.

None of these are exotic. They are the default behavior of a non-deterministic text generator pointed at a structured target, and they are precisely what a schema validator catches in milliseconds.

## What KindLM checks

KindLM treats structured output as a first-class assertion. You set `expect.output.format: json` and point `schemaFile` at an external JSON Schema document. Validation runs through Ajv. Two facts worth stating plainly, because they trip people up: `format: json` *requires* a `schemaFile`, and there is no inline schema. The schema lives in its own file, on a path relative to the config. That is deliberate. The schema is the contract, it is shared with the consumer, and a contract you copy-paste into a YAML string is a contract that drifts.

Here is a suite that tests an agent which classifies a support ticket and returns a structured record.

```yaml
kindlm: 1
project: support-router

suite:
  name: ticket-classifier
  description: Structured-output regression tests for the triage agent

providers:
  openai:
    apiKeyEnv: OPENAI_API_KEY

models:
  - id: gpt-4o
    provider: openai
    model: gpt-4o
    params:
      temperature: 0
      maxTokens: 512

prompts:
  classify:
    system: |
      You are a ticket triage agent. Return ONLY a JSON object.
      No prose, no Markdown fences.
    user: "Classify this ticket: {{ticket}}"

tests:
  - name: refund-request-is-well-formed
    prompt: classify
    vars:
      ticket: "I was charged twice and want my money back."
    expect:
      output:
        format: json
        schemaFile: ./schemas/ticket.schema.json

gates:
  schemaFailuresMax: 0
```

The companion schema is an ordinary JSON Schema file. This is where the real contract lives.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["category", "priority", "needs_human"],
  "properties": {
    "category": {
      "type": "string",
      "enum": ["billing", "technical", "account", "other"]
    },
    "priority": {
      "type": "integer",
      "minimum": 1,
      "maximum": 4
    },
    "needs_human": { "type": "boolean" }
  }
}
```

This catches every failure mode above. `additionalProperties: false` flags invented keys. `required` catches the missing field. `"type": "integer"` rejects `"2"` as a string. The `enum` rejects a hallucinated category. And if a model upgrade restructures the object, the validator notices before your queue does.

The gate is the part that matters for CI. `gates.schemaFailuresMax: 0` says any schema failure across the suite fails the build, exit code 1, red check on the PR. Without that line you get a report; with it you get a wall. Set it to zero and a malformed payload cannot merge.

## When the JSON comes from a tool result

Often the structured payload is not the model's free-text answer, it is the argument the agent passes to a tool. A `create_ticket` call, a `schedule_event` call. There the question is two-part: did the agent call the right tool, and was the JSON it constructed valid?

KindLM lets you assert both, and it lets you mock the tool so the decision is deterministic. The mock response lives on the test, and `argsMatch` checks the arguments the model produced.

```yaml
tests:
  - name: creates-ticket-with-valid-args
    prompt: classify
    vars:
      ticket: "App crashes on launch after the update."
    tools:
      - name: create_ticket
        description: Persist a triaged ticket
        defaultResponse: { id: "TKT-1001", status: "created" }
    expect:
      toolCalls:
        - tool: create_ticket
          argsMatch:
            category: technical
      output:
        format: json
        schemaFile: ./schemas/ticket.schema.json
```

`argsMatch` is a partial match, so you assert the fields you care about without pinning the whole object. One note on ordering, because it is easy to assume otherwise: a plain `toolCalls` list checks presence only, not sequence. If order matters, set a numeric `order:` on the entries or `toolCallsOrdered: true`. Order is opt-in by design.

## The takeaway

A schema validator does not make your agent smarter. It makes the day your agent gets quietly worse a loud day instead of a silent one. The whole value is moving the failure left, from a confused downstream service at 2 a.m. to a red check on a pull request, where it costs you a code review comment instead of an incident.

If your agent's output is read by a machine, write the schema down, point a validator at it, and set the gate to zero. The model will eventually return a number as a string. The only question is whether your CI catches it or your customer does.

## References

- JSON Schema specification, json-schema.org (IETF drafts, 2020-12).
- Ajv (Another JSON Schema Validator), Evgeny Poberezkin, ajv.js.org.
