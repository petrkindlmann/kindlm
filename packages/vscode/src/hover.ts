import * as vscode from "vscode";

/** Documentation for each assertion type, rendered as Markdown on hover. */
const ASSERTION_DOCS: Record<string, { summary: string; example: string }> = {
  tool_called: {
    summary:
      "Assert that the agent called a specific tool with expected arguments.",
    example: `\`\`\`yaml
- type: tool_called
  value: lookup_order
  args:
    order_id: "12345"
\`\`\``,
  },
  tool_not_called: {
    summary: "Assert that the agent did NOT call a forbidden tool.",
    example: `\`\`\`yaml
- type: tool_not_called
  value: process_refund
\`\`\``,
  },
  tool_order: {
    summary: "Assert tools were called in a specific sequence.",
    example: `\`\`\`yaml
- type: tool_order
  value:
    - lookup_order
    - check_eligibility
    - process_refund
\`\`\``,
  },
  schema: {
    summary: "Validate structured output against a JSON Schema (AJV).",
    example: `\`\`\`yaml
- type: schema
  value:
    type: object
    required: [action, reason]
    properties:
      action:
        type: string
        enum: [approve, deny]
      reason:
        type: string
\`\`\``,
  },
  judge: {
    summary:
      "LLM-as-judge scores response against criteria (0.0--1.0). Uses a separate LLM call to evaluate the agent's response quality.",
    example: `\`\`\`yaml
- type: judge
  criteria: "Response is empathetic and professional"
  threshold: 0.8
\`\`\``,
  },
  no_pii: {
    summary:
      "Detect PII: SSN, credit card, email, phone, IBAN. Custom patterns supported via the `patterns` property.",
    example: `\`\`\`yaml
- type: no_pii
  patterns:
    - name: "US Phone"
      pattern: "\\\\b\\\\d{3}-\\\\d{3}-\\\\d{4}\\\\b"
\`\`\``,
  },
  keywords_present: {
    summary: "Assert required phrases appear in the output.",
    example: `\`\`\`yaml
- type: keywords_present
  keywords:
    - "refund policy"
    - "business days"
\`\`\``,
  },
  keywords_absent: {
    summary: "Assert forbidden phrases do NOT appear in the output.",
    example: `\`\`\`yaml
- type: keywords_absent
  keywords:
    - "I'm just an AI"
    - "I cannot help"
\`\`\``,
  },
  drift: {
    summary:
      "Semantic + field-level comparison against stored baseline. Detects regression in agent behavior across code changes.",
    example: `\`\`\`yaml
- type: drift
  max_score: 0.15
  method: judge
\`\`\``,
  },
  latency: {
    summary: "Assert response time is under threshold.",
    example: `\`\`\`yaml
- type: latency
  max_ms: 5000
\`\`\``,
  },
  cost: {
    summary: "Assert token cost is under budget.",
    example: `\`\`\`yaml
- type: cost
  max_usd: 0.05
\`\`\``,
  },
};

/** Documentation for provider prefixes. */
const PROVIDER_DOCS: Record<string, { summary: string; models: string }> = {
  openai: {
    summary:
      "**OpenAI** -- GPT-4o, GPT-4o-mini, o1, o3-mini, and other OpenAI models.",
    models:
      "Common models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1`, `o1-mini`, `o3-mini`",
  },
  anthropic: {
    summary:
      "**Anthropic** -- Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4, and other Claude models.",
    models:
      "Common models: `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`, `claude-opus-4-20250514`",
  },
  gemini: {
    summary:
      "**Google Gemini** -- Gemini 2.0 Flash, Gemini 2.0 Pro, and other Gemini models.",
    models:
      "Common models: `gemini-2.0-flash`, `gemini-2.0-pro`, `gemini-1.5-pro`",
  },
  mistral: {
    summary:
      "**Mistral AI** -- Mistral Large, Medium, Small, and other Mistral models.",
    models:
      "Common models: `mistral-large-latest`, `mistral-medium-latest`, `mistral-small-latest`",
  },
  cohere: {
    summary: "**Cohere** -- Command R+, Command R, and other Cohere models.",
    models: "Common models: `command-r-plus`, `command-r`",
  },
  ollama: {
    summary:
      "**Ollama** -- Run local models. Requires Ollama running at localhost:11434 (default).",
    models:
      "Common models: `llama3.1`, `llama3.2`, `mistral`, `codellama`, `phi3`",
  },
};

/** Config property documentation for hover on keys. */
const PROPERTY_DOCS: Record<string, string> = {
  version: "Config schema version. Must be `\"1\"`.",
  defaults:
    "Default settings applied to all suites and tests unless overridden at the suite or test level.",
  suites:
    "Array of test suites. Each suite groups related tests against a specific agent or system prompt.",
  temperature:
    "Sampling temperature for model responses. `0` = deterministic, `2` = maximum randomness.",
  runs: "Number of times to run each test for statistical confidence. Results are aggregated across runs.",
  max_tokens: "Maximum number of tokens in the model response (1--128000).",
  timeout_ms: "Timeout per provider API call in milliseconds.",
  concurrency: "Number of tests to run concurrently (1--32).",
  judge_model:
    "Default model for LLM-as-judge assertions. Format: `provider:model`.",
  system_prompt:
    "Inline system prompt for all tests in this suite. Supports `{{variable}}` interpolation.",
  system_prompt_file:
    "Path to a file containing the system prompt (relative to config file).",
  gates:
    "Pass/fail gates for the suite. If any gate condition is violated, the suite fails.",
  pass_rate:
    "Minimum overall pass rate (0--1). Computed after repeats and aggregation.",
  max_cost: "Maximum total cost in USD for the entire suite run.",
  max_latency: "Maximum average latency in ms. Fails gate if exceeded.",
  assert:
    "Array of assertions to evaluate against the agent response. Each assertion has a `type` and type-specific properties.",
  tools:
    "Tool definitions available to the agent. Used for simulating function-calling scenarios.",
  input:
    "User message sent to the agent. Supports `{{variable}}` interpolation.",
  skip: "Skip this test case during execution (`true`/`false`).",
  tags: "Tags for filtering in CLI (e.g., `kindlm test --tags regression`).",
  compliance:
    "EU AI Act Annex IV compliance report settings. Generate with `kindlm test --compliance`.",
  upload:
    "KindLM Cloud upload settings. Push test results with `kindlm upload`.",
};

export function createHoverProvider(): vscode.HoverProvider {
  return {
    provideHover(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken
    ): vscode.Hover | null {
      const line = document.lineAt(position.line).text;
      const wordRange = document.getWordRangeAtPosition(position, /[\w._-]+/);
      if (!wordRange) {
        return null;
      }
      const word = document.getText(wordRange);

      // Check for assertion type hover
      const typeMatch = line.match(
        /^\s*-?\s*type:\s*["']?([\w_]+)["']?\s*/
      );
      if (typeMatch && ASSERTION_DOCS[typeMatch[1]] && word === typeMatch[1]) {
        const doc = ASSERTION_DOCS[typeMatch[1]];
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### Assertion: \`${typeMatch[1]}\`\n\n`);
        md.appendMarkdown(`${doc.summary}\n\n`);
        md.appendMarkdown(`**Example:**\n\n`);
        md.appendMarkdown(doc.example);
        md.isTrusted = true;
        return new vscode.Hover(md, wordRange);
      }

      // Check for provider string hover (e.g., "openai:gpt-4o")
      const providerMatch = line.match(
        /^\s*(?:provider|model|judge_model):\s*["']?((?:openai|anthropic|gemini|mistral|cohere|ollama):[^\s"'#]+)["']?\s*/
      );
      if (providerMatch) {
        const fullProvider = providerMatch[1];
        const prefix = fullProvider.split(":")[0];
        if (
          PROVIDER_DOCS[prefix] &&
          wordRange.contains(
            new vscode.Position(
              position.line,
              line.indexOf(fullProvider)
            )
          )
        ) {
          const doc = PROVIDER_DOCS[prefix];
          const md = new vscode.MarkdownString();
          md.appendMarkdown(`### Provider: ${doc.summary}\n\n`);
          md.appendMarkdown(`${doc.models}\n\n`);
          md.appendMarkdown(
            `**Format:** \`${prefix}:<model-name>\`\n\n`
          );
          md.appendMarkdown(
            `API key env var: \`${getEnvVarName(prefix)}\``
          );
          md.isTrusted = true;
          return new vscode.Hover(md, wordRange);
        }
      }

      // Check for config property hover
      const keyMatch = line.match(/^\s*-?\s*([\w_]+)\s*:/);
      if (keyMatch && PROPERTY_DOCS[keyMatch[1]] && word === keyMatch[1]) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**\`${keyMatch[1]}\`**\n\n`);
        md.appendMarkdown(PROPERTY_DOCS[keyMatch[1]]);
        md.isTrusted = true;
        return new vscode.Hover(md, wordRange);
      }

      // Check for assertion type as a standalone word in a - type: line
      if (ASSERTION_DOCS[word]) {
        // Verify we are inside an assert context by scanning up
        for (let i = position.line; i >= Math.max(0, position.line - 20); i--) {
          const scanLine = document.lineAt(i).text;
          if (/^\s*assert:\s*$/.test(scanLine)) {
            const doc = ASSERTION_DOCS[word];
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`### Assertion: \`${word}\`\n\n`);
            md.appendMarkdown(`${doc.summary}\n\n`);
            md.appendMarkdown(`**Example:**\n\n`);
            md.appendMarkdown(doc.example);
            md.isTrusted = true;
            return new vscode.Hover(md, wordRange);
          }
          // Stop scanning at a non-indented line
          if (/^\S/.test(scanLine) && !/^\s*#/.test(scanLine)) {
            break;
          }
        }
      }

      return null;
    },
  };
}

function getEnvVarName(provider: string): string {
  const envVars: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY",
    mistral: "MISTRAL_API_KEY",
    cohere: "COHERE_API_KEY",
    ollama: "(none required for local)",
  };
  return envVars[provider] ?? "API_KEY";
}
