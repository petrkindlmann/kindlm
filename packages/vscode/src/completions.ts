import * as vscode from "vscode";

/** Known model IDs per provider. */
const PROVIDER_MODELS: ReadonlyArray<{ label: string; detail: string }> = [
  { label: "gpt-4o", detail: "OpenAI GPT-4o (flagship)" },
  { label: "gpt-4o-mini", detail: "OpenAI GPT-4o Mini (fast, cheap)" },
  { label: "gpt-4-turbo", detail: "OpenAI GPT-4 Turbo" },
  { label: "o1", detail: "OpenAI o1 (reasoning)" },
  { label: "o1-mini", detail: "OpenAI o1 Mini (reasoning, fast)" },
  { label: "o3-mini", detail: "OpenAI o3 Mini (reasoning)" },
  { label: "claude-sonnet-4-5-20250929", detail: "Anthropic Claude Sonnet 4.5" },
  { label: "claude-haiku-4-5-20251001", detail: "Anthropic Claude Haiku 4.5 (fast)" },
  { label: "claude-opus-4-20250514", detail: "Anthropic Claude Opus 4" },
  { label: "gemini-2.0-flash", detail: "Google Gemini 2.0 Flash (fast)" },
  { label: "gemini-2.0-pro", detail: "Google Gemini 2.0 Pro" },
  { label: "gemini-1.5-pro", detail: "Google Gemini 1.5 Pro" },
  { label: "mistral-large-latest", detail: "Mistral Large (flagship)" },
  { label: "mistral-medium-latest", detail: "Mistral Medium" },
  { label: "mistral-small-latest", detail: "Mistral Small (fast)" },
  { label: "command-r-plus", detail: "Cohere Command R+" },
  { label: "command-r", detail: "Cohere Command R" },
  { label: "llama3.1", detail: "Meta Llama 3.1 via Ollama (local)" },
  { label: "llama3.2", detail: "Meta Llama 3.2 via Ollama (local)" },
  { label: "mistral", detail: "Mistral via Ollama (local)" },
  { label: "codellama", detail: "Code Llama via Ollama (local)" },
];

/** Provider names for the providers: section. */
const PROVIDER_NAMES: ReadonlyArray<string> = [
  "openai", "anthropic", "gemini", "mistral", "cohere", "ollama", "http",
];

type ExpectSection =
  | "root"         // inside expect: but before any sub-key
  | "output"
  | "toolCalls"
  | "judge"
  | "guardrails"
  | "pii"
  | "keywords"
  | "baseline"
  | "drift"
  | "latency"
  | "cost";

type CompletionCtx = {
  topLevel: boolean;
  inExpect: boolean;
  expectSection: ExpectSection | null;
  isModelValueLine: boolean;
  currentIndent: number;
};

function detectContext(
  document: vscode.TextDocument,
  position: vscode.Position
): CompletionCtx {
  const lineText = document.lineAt(position.line).text;
  const currentIndent = lineText.search(/\S/);

  // Is cursor typing a model name value? (model: <cursor>)
  const isModelValueLine = /^\s*model:\s*\S*$/.test(lineText);

  // Scan backwards to find enclosing context
  let inExpect = false;
  let expectSection: ExpectSection | null = null;
  let topLevel = currentIndent === 0 || currentIndent === -1;

  for (let i = position.line; i >= Math.max(0, position.line - 50); i--) {
    const line = document.lineAt(i).text;
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) continue;

    const indent = line.search(/\S/);

    // Detect drift: inside baseline:
    if (/^\s*drift:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "drift";
      break;
    }
    // Detect baseline: inside expect:
    if (/^\s*baseline:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "baseline";
      break;
    }
    // Detect pii: inside guardrails:
    if (/^\s*pii:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "pii";
      break;
    }
    // Detect keywords: inside guardrails:
    if (/^\s*keywords:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "keywords";
      break;
    }
    // Detect guardrails: inside expect:
    if (/^\s*guardrails:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "guardrails";
      break;
    }
    // Detect output: inside expect:
    if (/^\s*output:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "output";
      break;
    }
    // Detect toolCalls: inside expect:
    if (/^\s*toolCalls:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "toolCalls";
      break;
    }
    // Detect judge: inside expect:
    if (/^\s*judge:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "judge";
      break;
    }
    // Detect latency: inside expect:
    if (/^\s*latency:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "latency";
      break;
    }
    // Detect cost: inside expect:
    if (/^\s*cost:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "cost";
      break;
    }
    // Found expect: root
    if (/^\s*expect:\s*$/.test(line)) {
      inExpect = true;
      expectSection = "root";
      break;
    }
    // Hit a top-level key — stop scanning
    if (indent === 0 && /^\S/.test(line)) break;
  }

  return { topLevel, inExpect, expectSection, isModelValueLine, currentIndent };
}

function makeItem(
  label: string,
  kind: vscode.CompletionItemKind,
  detail: string,
  insertText?: string
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(label, kind);
  item.detail = detail;
  item.insertText = insertText
    ? new vscode.SnippetString(insertText)
    : label;
  item.sortText = `0-${label}`;
  return item;
}

export function createCompletionProvider(): vscode.CompletionItemProvider {
  return {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position,
      _token: vscode.CancellationToken,
      _context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
      const ctx = detectContext(document, position);
      const items: vscode.CompletionItem[] = [];

      // Model name completions (inside models[].model: or tools model overrides)
      if (ctx.isModelValueLine) {
        for (const m of PROVIDER_MODELS) {
          items.push(makeItem(m.label, vscode.CompletionItemKind.Value, m.detail));
        }
        return items;
      }

      // Provider name completions (inside providers:)
      const lineText = document.lineAt(position.line).text;
      if (/^\s*provider:\s*\S*$/.test(lineText)) {
        for (const p of PROVIDER_NAMES) {
          items.push(makeItem(p, vscode.CompletionItemKind.Value, `Use ${p} provider`));
        }
        return items;
      }

      // Drift method completions
      if (ctx.expectSection === "drift" && /^\s*method:\s*/.test(lineText)) {
        for (const [label, detail] of [
          ["judge", "LLM comparison for semantic drift detection"],
          ["embedding", "Cosine similarity between response embeddings"],
          ["field-diff", "Field-by-field comparison of JSON outputs"],
        ] as const) {
          items.push(makeItem(label, vscode.CompletionItemKind.EnumMember, detail));
        }
        return items;
      }

      // Output format completions
      if (ctx.expectSection === "output" && /^\s*format:\s*/.test(lineText)) {
        items.push(makeItem("text", vscode.CompletionItemKind.EnumMember, "Plain text output (default)"));
        items.push(makeItem("json", vscode.CompletionItemKind.EnumMember, "JSON output — requires schemaFile"));
        return items;
      }

      // expect: root — suggest sub-keys
      if (ctx.inExpect && ctx.expectSection === "root") {
        const expectSubKeys: Array<{ label: string; insert: string; detail: string }> = [
          { label: "output", insert: "output:\n    format: text", detail: "Output format and content assertions" },
          { label: "toolCalls", insert: "toolCalls:\n    - tool: ", detail: "Expected tool/function calls" },
          { label: "judge", insert: "judge:\n    - criteria: \"${1:Response is helpful}\"\n      minScore: ${2:0.8}", detail: "LLM-as-judge evaluation criteria" },
          { label: "guardrails", insert: "guardrails:\n    pii:\n      enabled: true", detail: "PII and keyword safety guardrails" },
          { label: "baseline", insert: "baseline:\n    drift:\n      maxScore: 0.15\n      method: judge", detail: "Behavioral drift detection against saved baseline" },
          { label: "latency", insert: "latency:\n    maxMs: ${1:5000}", detail: "Response time assertion" },
          { label: "cost", insert: "cost:\n    maxUsd: ${1:0.05}", detail: "Token cost budget assertion" },
        ];
        for (const k of expectSubKeys) {
          items.push(makeItem(k.label, vscode.CompletionItemKind.Property, k.detail, k.insert));
        }
        return items;
      }

      // expect.toolCalls[] — suggest item fields
      if (ctx.inExpect && ctx.expectSection === "toolCalls") {
        const fields = [
          { label: "tool", insert: "tool: ", detail: "Expected tool/function name (required)" },
          { label: "argsMatch", insert: "argsMatch:\n    ${1:param}: \"${2:value}\"", detail: "Expected arguments (partial match)" },
          { label: "shouldNotCall", insert: "shouldNotCall: true", detail: "Assert this tool was NOT called" },
          { label: "argsSchema", insert: "argsSchema: ", detail: "Path to JSON Schema to validate arguments" },
          { label: "order", insert: "order: ${1:0}", detail: "Expected position in tool call sequence (0-indexed)" },
        ];
        for (const f of fields) {
          items.push(makeItem(f.label, vscode.CompletionItemKind.Property, f.detail, f.insert));
        }
        return items;
      }

      // expect.judge[] — suggest criterion fields
      if (ctx.inExpect && ctx.expectSection === "judge") {
        const fields = [
          { label: "criteria", insert: "criteria: \"${1:Response is helpful and accurate}\"", detail: "Natural language evaluation criteria (required)" },
          { label: "minScore", insert: "minScore: ${1:0.8}", detail: "Minimum score (0.0-1.0) to pass (default: 0.7)" },
          { label: "rubric", insert: "rubric: ", detail: "Detailed scoring rubric for the judge" },
          { label: "model", insert: "model: ", detail: "Override judge model ID for this criterion" },
        ];
        for (const f of fields) {
          items.push(makeItem(f.label, vscode.CompletionItemKind.Property, f.detail, f.insert));
        }
        return items;
      }

      // expect.guardrails — suggest pii/keywords
      if (ctx.inExpect && ctx.expectSection === "guardrails") {
        items.push(makeItem("pii", vscode.CompletionItemKind.Property, "PII detection (SSN, credit card, email, phone)", "pii:\n    enabled: true"));
        items.push(makeItem("keywords", vscode.CompletionItemKind.Property, "Keyword allow/deny guardrail", "keywords:\n    deny:\n      - \"${1:forbidden phrase}\""));
        return items;
      }

      // expect.guardrails.pii — suggest pii fields
      if (ctx.inExpect && ctx.expectSection === "pii") {
        const fields = [
          { label: "enabled", insert: "enabled: true", detail: "Enable PII detection (default: true)" },
          { label: "denyPatterns", insert: "denyPatterns:\n    - \"${1:\\\\b\\\\d{3}-\\\\d{2}-\\\\d{4}\\\\b}\"", detail: "Regex patterns that must NOT appear in output" },
          { label: "customPatterns", insert: "customPatterns:\n    - name: \"${1:Pattern Name}\"\n      pattern: \"${2:regex}\"", detail: "Named custom PII patterns" },
        ];
        for (const f of fields) {
          items.push(makeItem(f.label, vscode.CompletionItemKind.Property, f.detail, f.insert));
        }
        return items;
      }

      // expect.guardrails.keywords — suggest keyword fields
      if (ctx.inExpect && ctx.expectSection === "keywords") {
        items.push(makeItem("deny", vscode.CompletionItemKind.Property, "Phrases that must NOT appear in output", "deny:\n    - \"${1:forbidden phrase}\""));
        items.push(makeItem("allow", vscode.CompletionItemKind.Property, "Output MUST contain at least one of these phrases", "allow:\n    - \"${1:required phrase}\""));
        return items;
      }

      // expect.output — suggest output fields
      if (ctx.inExpect && ctx.expectSection === "output") {
        const fields = [
          { label: "format", insert: "format: ${1|text,json|}", detail: "Expected output format (text or json)" },
          { label: "contains", insert: "contains:\n    - \"${1:expected substring}\"", detail: "Output must contain all of these substrings" },
          { label: "notContains", insert: "notContains:\n    - \"${1:forbidden substring}\"", detail: "Output must NOT contain any of these substrings" },
          { label: "maxLength", insert: "maxLength: ${1:500}", detail: "Maximum character length of the output" },
          { label: "schemaFile", insert: "schemaFile: ${1:./schemas/output.json}", detail: "Path to JSON Schema file (required when format is 'json')" },
        ];
        for (const f of fields) {
          items.push(makeItem(f.label, vscode.CompletionItemKind.Property, f.detail, f.insert));
        }
        return items;
      }

      // expect.baseline — suggest drift
      if (ctx.inExpect && ctx.expectSection === "baseline") {
        items.push(makeItem("drift", vscode.CompletionItemKind.Property, "Detect behavioral drift against saved baseline", "drift:\n    maxScore: 0.15\n    method: judge"));
        return items;
      }

      // expect.baseline.drift — suggest drift fields
      if (ctx.inExpect && ctx.expectSection === "drift") {
        const fields = [
          { label: "maxScore", insert: "maxScore: ${1:0.15}", detail: "Maximum drift score (0-1). Fail if exceeded." },
          { label: "method", insert: "method: ${1|judge,embedding,field-diff|}", detail: "Drift detection method" },
          { label: "fields", insert: "fields:\n    - \"${1:response.action}\"", detail: "JSON paths to compare (for field-diff method)" },
        ];
        for (const f of fields) {
          items.push(makeItem(f.label, vscode.CompletionItemKind.Property, f.detail, f.insert));
        }
        return items;
      }

      // expect.latency — suggest maxMs
      if (ctx.inExpect && ctx.expectSection === "latency") {
        items.push(makeItem("maxMs", vscode.CompletionItemKind.Property, "Maximum response latency in milliseconds", "maxMs: ${1:5000}"));
        return items;
      }

      // expect.cost — suggest maxUsd
      if (ctx.inExpect && ctx.expectSection === "cost") {
        items.push(makeItem("maxUsd", vscode.CompletionItemKind.Property, "Maximum token cost in USD", "maxUsd: ${1:0.05}"));
        return items;
      }

      // Top-level key completions
      if (ctx.topLevel) {
        const topLevelKeys: Array<{ label: string; insert: string; detail: string }> = [
          { label: "kindlm", insert: "kindlm: 1", detail: "Config schema version (required, must be 1)" },
          { label: "project", insert: "project: ${1:my-project}", detail: "Project identifier for Cloud upload and reports (required)" },
          { label: "suite", insert: "suite:\n  name: ${1:my-suite}", detail: "Suite metadata — name and description (required)" },
          { label: "providers", insert: "providers:\n  ${1:openai}:\n    apiKeyEnv: ${2:OPENAI_API_KEY}", detail: "Provider configurations (required)" },
          { label: "models", insert: "models:\n  - id: ${1:gpt-4o}\n    provider: ${2:openai}\n    model: ${3:gpt-4o}", detail: "Model configurations (required)" },
          { label: "prompts", insert: "prompts:\n  ${1:my-prompt}:\n    system: ${2:You are a helpful assistant.}\n    user: \"${3:{{message}}}\"", detail: "Named prompt templates (required)" },
          { label: "tests", insert: "tests:\n  - name: \"${1:test-name}\"\n    prompt: ${2:my-prompt}\n    expect:\n      ", detail: "Test cases (required)" },
          { label: "gates", insert: "gates:\n  passRateMin: ${1:0.95}", detail: "Suite pass/fail gates" },
          { label: "defaults", insert: "defaults:\n  repeat: ${1:1}\n  concurrency: ${2:4}", detail: "Default settings for all tests" },
          { label: "compliance", insert: "compliance:\n  enabled: true\n  framework: eu-ai-act", detail: "EU AI Act Annex IV compliance report settings" },
          { label: "upload", insert: "upload:\n  enabled: true", detail: "KindLM Cloud upload settings" },
        ];
        for (const k of topLevelKeys) {
          items.push(makeItem(k.label, vscode.CompletionItemKind.Property, k.detail, k.insert));
        }
      }

      return items;
    },
  };
}
