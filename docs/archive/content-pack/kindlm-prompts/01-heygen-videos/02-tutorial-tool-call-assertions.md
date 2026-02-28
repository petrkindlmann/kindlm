# VIDEO 02: Tutorial — "Test Every Tool Call" (3 min)

## HeyGen Settings
- Same avatar as Video 01 (consistent face across all content)
- Background: Solid dark
- Resolution: 1080p landscape

## Script

---

Your AI agent doesn't just write text. It makes decisions. It calls tools. And if it calls the wrong tool, or passes the wrong arguments, your users pay the price.

[pause]

Let me show you how to test tool calls with KindLM.

[pause]

Here's a support agent that handles refund requests. When a customer says they were charged twice, the agent should do three things. First, call lookup_order with the correct order ID. Second, call issue_refund. Third, never call escalate_to_human for routine cases.

[pause]

As you can see on screen, this is the YAML config. Under expect, toolCalls, we list each tool assertion. The tool name, the arguments it should match, and for escalate_to_human, we set shouldNotCall to true.

[pause]

Now I run kindlm test. Watch the output.

[pause]

Every tool call is verified. The arguments are checked. And when we test against GPT-4o, it actually fails because it skipped lookup_order entirely. That's a regression that no text-based test would catch.

[pause]

You can also test tool call ordering. If your agent must look up the order before issuing a refund, KindLM catches when it does them out of sequence.

[pause]

The YAML is twelve lines. The command is one line. And you just caught a bug that would have cost your customers money.

[pause]

Full config examples are in the docs. Link below.

---

## Overlay plan
- 0:00-0:25 → Avatar speaking (problem setup)
- 0:25-0:40 → Screen: YAML config file, highlight each toolCalls entry
- 0:40-1:20 → Screen: Terminal running `kindlm test`, results appearing line by line
- 1:20-1:50 → Screen: Side-by-side Claude pass vs GPT-4o fail output
- 1:50-2:20 → Screen: YAML showing ordering assertions
- 2:20-2:45 → Avatar speaking (wrap up)
- 2:45-3:00 → End card with docs link
