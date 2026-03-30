import * as vscode from "vscode";

/** Documentation for expect sub-sections, rendered as Markdown on hover. */
const EXPECT_DOCS: Record<string, { summary: string; example: string }> = {
  toolCalls: {
    summary: "Expected tool/function calls in the model response. Each entry asserts a specific tool was (or was not) called.",
    example: `\`\`\`yaml
expect:
  toolCalls:
    - tool: lookup_order
      argsMatch:
        order_id: "12345"
    - tool: send_refund_email
      shouldNotCall: true
\`\`\``,
  },
  judge: {
    summary: "LLM-as-judge evaluations. Each criterion uses a separate model call to score the response on a 0–1 scale.",
    example: `\`\`\`yaml
expect:
  judge:
    - criteria: "Response is empathetic and professional"
      minScore: 0.8
    - criteria: "No hallucinated order details"
      minScore: 0.9
      rubric: "Score 1.0 if all order facts match, 0.0 if any are fabricated"
\`\`\``,
  },
  guardrails: {
    summary: "Safety and policy guardrails. Fail the test if PII appears in output or forbidden keywords are present.",
    example: `\`\`\`yaml
expect:
  guardrails:
    pii:
      enabled: true
    keywords:
      deny:
        - "I'm just an AI"
        - "I cannot help"
\`\`\``,
  },
  output: {
    summary: "Output format and content assertions — format validation, required/forbidden substrings, and length limits.",
    example: `\`\`\`yaml
expect:
  output:
    format: json
    schemaFile: ./schemas/response.json
    contains:
      - "refund policy"
    notContains:
      - "error"
    maxLength: 500
\`\`\``,
  },
  baseline: {
    summary: "Detect behavioral drift against a saved baseline. Run `kindlm baseline set` to save a baseline first.",
    example: `\`\`\`yaml
expect:
  baseline:
    drift:
      maxScore: 0.15
      method: judge
\`\`\``,
  },
  latency: {
    summary: "Assert the response latency is within threshold. Fails if the provider call takes longer than maxMs.",
    example: `\`\`\`yaml
expect:
  latency:
    maxMs: 5000
\`\`\``,
  },
  cost: {
    summary: "Assert the token cost is within budget. Uses per-model pricing tables to estimate cost.",
    example: `\`\`\`yaml
expect:
  cost:
    maxUsd: 0.05
\`\`\``,
  },
};

/** Documentation for provider names. */
const PROVIDER_DOCS: Record<string, { summary: string; models: string }> = {
  openai: {
    summary: "**OpenAI** — GPT-4o, GPT-4o-mini, o1, o3-mini, and other OpenAI models.",
    models: "Common models: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1`, `o1-mini`, `o3-mini`",
  },
  anthropic: {
    summary: "**Anthropic** — Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4, and other Claude models.",
    models: "Common models: `claude-sonnet-4-5-20250929`, `claude-haiku-4-5-20251001`, `claude-opus-4-20250514`",
  },
  gemini: {
    summary: "**Google Gemini** — Gemini 2.0 Flash, Gemini 2.0 Pro, and other Gemini models.",
    models: "Common models: `gemini-2.0-flash`, `gemini-2.0-pro`, `gemini-1.5-pro`",
  },
  mistral: {
    summary: "**Mistral AI** — Mistral Large, Medium, Small, and other Mistral models.",
    models: "Common models: `mistral-large-latest`, `mistral-medium-latest`, `mistral-small-latest`",
  },
  cohere: {
    summary: "**Cohere** — Command R+, Command R, and other Cohere models.",
    models: "Common models: `command-r-plus`, `command-r`",
  },
  ollama: {
    summary: "**Ollama** — Run local models. Requires Ollama running at localhost:11434 (default).",
    models: "Common models: `llama3.1`, `llama3.2`, `mistral`, `codellama`, `phi3`",
  },
  http: {
    summary: "**HTTP** — Generic HTTP provider for any OpenAI-compatible API or custom endpoint.",
    models: "Configure via `url`, `headers`, and optional `responsePath`.",
  },
};

/** Config property documentation for hover on keys. */
const PROPERTY_DOCS: Record<string, string> = {
  kindlm: "Config schema version. Must be `1`.",
  project: "Project identifier for Cloud upload and report grouping.",
  suite: "Suite metadata — `name` and optional `description` / `tags`. All tests in the file belong to this suite.",
  providers: "Provider configurations. Each key matches a provider name. API keys are referenced by environment variable name — never raw values.",
  models: "Model configurations. Each model has an `id` (referenced in tests), a `provider`, and a `model` name as the provider expects it.",
  prompts: "Named prompt templates. Tests reference these by key via `prompt: <key>`.",
  tests: "Test cases. Each sends a prompt to a model and evaluates assertions under `expect:`.",
  expect: "Assertions to evaluate against the model output. Sub-keys: `output`, `toolCalls`, `judge`, `guardrails`, `baseline`, `latency`, `cost`.",
  gates: "Pass/fail gates for the suite. If any gate fails, the suite fails. Common: `passRateMin`, `judgeAvgMin`, `piiFailuresMax`.",
  defaults: "Default settings for all tests: `repeat`, `concurrency`, `timeoutMs`, `judgeModel`.",
  // model fields
  id: "Unique model config identifier. Referenced in `test.models[]` and `defaults.judgeModel`.",
  provider: "Provider name — must match a key in the `providers` section.",
  model: "Model name as the provider expects it (e.g., `gpt-4o`, `claude-sonnet-4-5-20250929`).",
  params: "Model generation parameters: `temperature`, `maxTokens`, `topP`, `stopSequences`, `seed`.",
  // prompt fields
  system: "System prompt template. Supports `{{variable}}` interpolation.",
  user: "User message template. Supports `{{variable}}` interpolation.",
  assistant: "Prefill for assistant response (Anthropic-specific).",
  // test case fields
  prompt: "Reference to a key in the `prompts` section. Mutually exclusive with `command`.",
  command: "Shell command to execute. Stdout is captured and assertions run against it. Mutually exclusive with `prompt`.",
  vars: "Variables to interpolate into the prompt template or command (e.g., `{{message}}` → `vars.message`).",
  repeat: "Number of repeat runs for statistical confidence. Results are aggregated. Overrides `defaults.repeat`.",
  skip: "Skip this test case during execution (`true`/`false`).",
  tags: "Tags for filtering in CLI (e.g., `kindlm test --tags regression`).",
  // expect fields
  output: "Output format and content assertions — format, schema, contains, notContains, maxLength.",
  toolCalls: "Expected tool/function calls. Each entry asserts a tool was called (or not called) with specific arguments.",
  judge: "LLM-as-judge evaluations. Each criterion is scored independently by a judge model.",
  guardrails: "Safety guardrails — PII detection and keyword policies.",
  baseline: "Baseline comparison — detects behavioral drift against a saved baseline.",
  latency: "Response time assertion. Fails if the provider call exceeds `maxMs`.",
  cost: "Token cost assertion. Fails if estimated cost exceeds `maxUsd`.",
  // toolCalls item fields
  tool: "Expected tool/function name.",
  shouldNotCall: "If `true`, assert this tool was NOT called.",
  argsMatch: "Key-value pairs that must be present in tool call arguments (partial match).",
  argsSchema: "Path to JSON Schema file to validate tool call arguments.",
  order: "Expected position in tool call sequence (0-indexed).",
  // judge fields
  criteria: "Natural language description of what to evaluate (e.g., 'Response is empathetic and professional').",
  minScore: "Minimum score (0.0–1.0) for this criterion to pass. Default: 0.7.",
  rubric: "Detailed scoring rubric. If omitted, a default rubric is generated from `criteria`.",
  // output fields
  format: "Expected output format: `text` (default) or `json` (requires `schemaFile`).",
  schemaFile: "Path to JSON Schema file (relative to config). Required when `format` is `json`.",
  contains: "Output must contain all of these substrings (case-sensitive).",
  notContains: "Output must NOT contain any of these substrings (case-sensitive).",
  maxLength: "Maximum character length of the output.",
  // guardrail fields
  pii: "PII detection. Built-in patterns: SSN, credit card, email, phone. Extend with `denyPatterns` or `customPatterns`.",
  keywords: "Keyword guardrail. `deny`: forbidden phrases. `allow`: at least one required phrase.",
  enabled: "Enable this guardrail (`true`/`false`). Default: `true`.",
  denyPatterns: "Regex patterns that must NOT appear in output. Defaults include SSN, credit card, email.",
  customPatterns: "Named custom PII patterns for clearer reporting.",
  deny: "Words/phrases that must NOT appear in output (case-insensitive).",
  allow: "If set, output MUST contain at least one of these words/phrases (case-insensitive).",
  // drift fields
  drift: "Detect behavioral drift against a saved baseline. Run `kindlm baseline set` first.",
  maxScore: "Maximum drift score (0–1). Fail if exceeded. Default: 0.15.",
  method: "Drift detection method: `judge` (LLM comparison), `embedding` (cosine similarity), `field-diff` (JSON field comparison).",
  fields: "For `field-diff` method: JSON paths to compare (e.g., `response.action`).",
  // gates fields
  passRateMin: "Minimum overall pass rate (0–1). Computed after repeats. Default: 0.95.",
  judgeAvgMin: "Minimum average LLM-as-judge score across all criteria.",
  piiFailuresMax: "Maximum allowed PII detection failures. Default: 0.",
  keywordFailuresMax: "Maximum allowed keyword guardrail failures. Default: 0.",
  schemaFailuresMax: "Maximum allowed schema validation failures. Default: 0.",
  costMaxUsd: "Maximum total cost in USD for the entire run.",
  latencyMaxMs: "Maximum average latency in ms.",
  // defaults fields
  concurrency: "Number of tests to run concurrently (1–32). Default: 4.",
  timeoutMs: "Timeout per provider API call in milliseconds. Default: 60000.",
  judgeModel: "Default model ID for LLM-as-judge assertions. Must reference a configured model `id`.",
  // compliance fields
  compliance: "EU AI Act Annex IV compliance report settings. Generate with `kindlm test --compliance`.",
  // upload fields
  upload: "KindLM Cloud upload settings. Push test results with `kindlm upload`.",
  apiKeyEnv: "Environment variable name containing the API key. Never a raw key value.",
  baseUrl: "Custom base URL for API-compatible proxies (e.g., Azure OpenAI, LiteLLM).",
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
      if (!wordRange) return null;
      const word = document.getText(wordRange);

      // Hover on expect sub-key names (e.g., "toolCalls:", "judge:", "guardrails:")
      const keyMatch = line.match(/^\s*-?\s*([\w]+)\s*:/);
      if (keyMatch && keyMatch[1] === word) {
        // Check for expect sub-section docs first
        if (EXPECT_DOCS[word]) {
          const doc = EXPECT_DOCS[word];
          const md = new vscode.MarkdownString();
          md.appendMarkdown(`### \`expect.${word}\`\n\n`);
          md.appendMarkdown(`${doc.summary}\n\n`);
          md.appendMarkdown(`**Example:**\n\n`);
          md.appendMarkdown(doc.example);
          md.isTrusted = true;
          return new vscode.Hover(md, wordRange);
        }

        // General property docs
        if (PROPERTY_DOCS[word]) {
          const md = new vscode.MarkdownString();
          md.appendMarkdown(`**\`${word}\`**\n\n`);
          md.appendMarkdown(PROPERTY_DOCS[word]);
          md.isTrusted = true;
          return new vscode.Hover(md, wordRange);
        }
      }

      // Hover on provider name values (e.g., provider: openai)
      const providerValueMatch = line.match(/^\s*provider:\s*["']?([\w]+)["']?\s*/);
      if (providerValueMatch && providerValueMatch[1] === word && PROVIDER_DOCS[word]) {
        const doc = PROVIDER_DOCS[word];
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`### Provider: ${doc.summary}\n\n`);
        md.appendMarkdown(`${doc.models}\n\n`);
        md.appendMarkdown(`**API key env var:** \`${getEnvVarName(word)}\``);
        md.isTrusted = true;
        return new vscode.Hover(md, wordRange);
      }

      // Hover on word if it's a known property name (anywhere)
      if (PROPERTY_DOCS[word]) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**\`${word}\`**\n\n`);
        md.appendMarkdown(PROPERTY_DOCS[word]);
        md.isTrusted = true;
        return new vscode.Hover(md, wordRange);
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
    http: "(configure via headers)",
  };
  return envVars[provider] ?? "API_KEY";
}
