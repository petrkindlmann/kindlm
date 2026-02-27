import * as vscode from "vscode";

/** All supported assertion types with descriptions. */
const ASSERTION_TYPES: ReadonlyArray<{ label: string; detail: string }> = [
  {
    label: "tool_called",
    detail: "Assert the agent called a specific tool with expected arguments",
  },
  {
    label: "tool_not_called",
    detail: "Assert the agent did NOT call a forbidden tool",
  },
  {
    label: "tool_order",
    detail: "Assert tools were called in a specific sequence",
  },
  {
    label: "schema",
    detail: "Validate structured output against a JSON Schema (AJV)",
  },
  {
    label: "judge",
    detail: "LLM-as-judge scores response against criteria (0.0-1.0)",
  },
  {
    label: "no_pii",
    detail:
      "Detect PII: SSN, credit card, email, phone, IBAN. Custom patterns supported",
  },
  {
    label: "keywords_present",
    detail: "Assert required phrases appear in the output",
  },
  {
    label: "keywords_absent",
    detail: "Assert forbidden phrases do NOT appear in the output",
  },
  {
    label: "drift",
    detail: "Semantic + field-level comparison against stored baseline",
  },
  {
    label: "latency",
    detail: "Assert response time is under threshold",
  },
  {
    label: "cost",
    detail: "Assert token cost is under budget",
  },
];

/** All supported providers with model variants. */
const PROVIDER_MODELS: ReadonlyArray<{ label: string; detail: string }> = [
  { label: "openai:gpt-4o", detail: "OpenAI GPT-4o (flagship)" },
  { label: "openai:gpt-4o-mini", detail: "OpenAI GPT-4o Mini (fast, cheap)" },
  { label: "openai:gpt-4-turbo", detail: "OpenAI GPT-4 Turbo" },
  { label: "openai:o1", detail: "OpenAI o1 (reasoning)" },
  { label: "openai:o1-mini", detail: "OpenAI o1 Mini (reasoning, fast)" },
  { label: "openai:o3-mini", detail: "OpenAI o3 Mini (reasoning)" },
  {
    label: "anthropic:claude-sonnet-4-5-20250929",
    detail: "Anthropic Claude Sonnet 4.5",
  },
  {
    label: "anthropic:claude-haiku-4-5-20251001",
    detail: "Anthropic Claude Haiku 4.5 (fast)",
  },
  {
    label: "anthropic:claude-opus-4-20250514",
    detail: "Anthropic Claude Opus 4",
  },
  {
    label: "gemini:gemini-2.0-flash",
    detail: "Google Gemini 2.0 Flash (fast)",
  },
  {
    label: "gemini:gemini-2.0-pro",
    detail: "Google Gemini 2.0 Pro",
  },
  {
    label: "gemini:gemini-1.5-pro",
    detail: "Google Gemini 1.5 Pro",
  },
  {
    label: "mistral:mistral-large-latest",
    detail: "Mistral Large (flagship)",
  },
  {
    label: "mistral:mistral-medium-latest",
    detail: "Mistral Medium",
  },
  {
    label: "mistral:mistral-small-latest",
    detail: "Mistral Small (fast)",
  },
  {
    label: "cohere:command-r-plus",
    detail: "Cohere Command R+ (flagship)",
  },
  { label: "cohere:command-r", detail: "Cohere Command R" },
  { label: "ollama:llama3.1", detail: "Meta Llama 3.1 (local)" },
  { label: "ollama:llama3.2", detail: "Meta Llama 3.2 (local)" },
  { label: "ollama:mistral", detail: "Mistral via Ollama (local)" },
  { label: "ollama:codellama", detail: "Code Llama via Ollama (local)" },
  { label: "ollama:phi3", detail: "Microsoft Phi-3 via Ollama (local)" },
];

/** Properties suggested after a specific assertion type. */
const ASSERTION_TYPE_PROPERTIES: Record<
  string,
  ReadonlyArray<{ label: string; insertText: string; detail: string }>
> = {
  tool_called: [
    {
      label: "value",
      insertText: "value: ",
      detail: "Name of the tool that should have been called",
    },
    {
      label: "args",
      insertText: "args:\n    ",
      detail: "Expected tool call arguments (partial match)",
    },
    {
      label: "args_schema",
      insertText: "args_schema: ",
      detail: "Path to JSON Schema file for argument validation",
    },
    {
      label: "order",
      insertText: "order: ",
      detail: "Expected position in tool call sequence (0-indexed)",
    },
  ],
  tool_not_called: [
    {
      label: "value",
      insertText: "value: ",
      detail: "Name of the tool that should NOT have been called",
    },
  ],
  tool_order: [
    {
      label: "value",
      insertText: "value:\n    - ",
      detail: "Ordered list of tool names",
    },
  ],
  schema: [
    {
      label: "value",
      insertText: "value:\n    type: object\n    properties:\n      ",
      detail: "Inline JSON Schema to validate structured output",
    },
    {
      label: "schema_file",
      insertText: "schema_file: ",
      detail: "Path to a JSON Schema file",
    },
  ],
  judge: [
    {
      label: "criteria",
      insertText: "criteria: ",
      detail:
        "Natural language description of what to evaluate",
    },
    {
      label: "threshold",
      insertText: "threshold: 0.8",
      detail: "Minimum score (0.0-1.0) to pass",
    },
    {
      label: "rubric",
      insertText: "rubric: ",
      detail: "Detailed scoring rubric for the judge",
    },
    {
      label: "model",
      insertText: "model: ",
      detail: "Override judge model for this assertion",
    },
  ],
  no_pii: [
    {
      label: "patterns",
      insertText: "patterns:\n    - name: \n      pattern: ",
      detail:
        "Custom PII patterns (in addition to built-in SSN, CC, email, phone, IBAN)",
    },
  ],
  keywords_present: [
    {
      label: "keywords",
      insertText: "keywords:\n    - ",
      detail: "Phrases that MUST appear in agent output",
    },
  ],
  keywords_absent: [
    {
      label: "keywords",
      insertText: "keywords:\n    - ",
      detail: "Phrases that must NOT appear in agent output",
    },
  ],
  drift: [
    {
      label: "max_score",
      insertText: "max_score: 0.15",
      detail: "Maximum drift score (0-1). Higher = more drift allowed",
    },
    {
      label: "method",
      insertText: "method: ",
      detail: "Drift detection method: judge, embedding, or field-diff",
    },
    {
      label: "fields",
      insertText: "fields:\n    - ",
      detail: "JSON paths to compare (for field-diff method)",
    },
  ],
  latency: [
    {
      label: "max_ms",
      insertText: "max_ms: ",
      detail: "Maximum response latency in milliseconds",
    },
  ],
  cost: [
    {
      label: "max_usd",
      insertText: "max_usd: ",
      detail: "Maximum token cost in USD",
    },
  ],
};

/** Drift method values. */
const DRIFT_METHODS: ReadonlyArray<{ label: string; detail: string }> = [
  { label: "judge", detail: "LLM comparison for semantic drift detection" },
  {
    label: "embedding",
    detail: "Cosine similarity between response embeddings",
  },
  { label: "field-diff", detail: "Field-by-field comparison of JSON outputs" },
];

/**
 * Determine the context of the cursor position by scanning preceding lines.
 */
function detectContext(
  document: vscode.TextDocument,
  position: vscode.Position
): {
  inAssert: boolean;
  lastAssertionType: string | null;
  isProviderLine: boolean;
  isTypeLine: boolean;
  isMethodLine: boolean;
  currentIndent: number;
} {
  const lineText = document.lineAt(position.line).text;
  const currentIndent = lineText.search(/\S/);

  const isProviderLine = /^\s*provider:\s*/.test(lineText);
  const isTypeLine = /^\s*-?\s*type:\s*/.test(lineText);
  const isMethodLine = /^\s*method:\s*/.test(lineText);

  let inAssert = false;
  let lastAssertionType: string | null = null;

  // Scan backwards to find context
  for (let i = position.line; i >= 0; i--) {
    const line = document.lineAt(i).text;

    // Check if we are inside an assert block
    if (/^\s*assert:\s*$/.test(line)) {
      inAssert = true;
      break;
    }

    // Find most recent assertion type above cursor
    if (lastAssertionType === null) {
      const typeMatch = line.match(
        /^\s*-?\s*type:\s*["']?(tool_called|tool_not_called|tool_order|schema|judge|no_pii|keywords_present|keywords_absent|drift|latency|cost)["']?\s*/
      );
      if (typeMatch) {
        lastAssertionType = typeMatch[1];
        inAssert = true;
      }
    }

    // Stop scanning if we hit a top-level key
    if (/^\S/.test(line) && !/^\s*#/.test(line) && !/^\s*$/.test(line)) {
      break;
    }
  }

  return {
    inAssert,
    lastAssertionType,
    isProviderLine,
    isTypeLine,
    isMethodLine,
    currentIndent,
  };
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

      // Provider completions
      if (ctx.isProviderLine) {
        for (const provider of PROVIDER_MODELS) {
          const item = new vscode.CompletionItem(
            provider.label,
            vscode.CompletionItemKind.Value
          );
          item.detail = provider.detail;
          item.insertText = provider.label;
          item.sortText = `0-${provider.label}`;
          items.push(item);
        }
        return items;
      }

      // Assertion type completions
      if (ctx.isTypeLine && ctx.inAssert) {
        for (const assertion of ASSERTION_TYPES) {
          const item = new vscode.CompletionItem(
            assertion.label,
            vscode.CompletionItemKind.EnumMember
          );
          item.detail = assertion.detail;
          item.insertText = assertion.label;
          item.sortText = `0-${assertion.label}`;
          items.push(item);
        }
        return items;
      }

      // Drift method completions
      if (ctx.isMethodLine && ctx.inAssert && ctx.lastAssertionType === "drift") {
        for (const method of DRIFT_METHODS) {
          const item = new vscode.CompletionItem(
            method.label,
            vscode.CompletionItemKind.EnumMember
          );
          item.detail = method.detail;
          item.insertText = method.label;
          items.push(item);
        }
        return items;
      }

      // Model override completions for judge assertion's model field
      if (ctx.inAssert && ctx.lastAssertionType === "judge") {
        const lineText = document.lineAt(position.line).text;
        if (/^\s*model:\s*/.test(lineText)) {
          for (const provider of PROVIDER_MODELS) {
            const item = new vscode.CompletionItem(
              provider.label,
              vscode.CompletionItemKind.Value
            );
            item.detail = provider.detail;
            item.insertText = provider.label;
            items.push(item);
          }
          return items;
        }
      }

      // Context-aware property suggestions after a specific assertion type
      if (
        ctx.inAssert &&
        ctx.lastAssertionType &&
        !ctx.isTypeLine &&
        ASSERTION_TYPE_PROPERTIES[ctx.lastAssertionType]
      ) {
        const properties = ASSERTION_TYPE_PROPERTIES[ctx.lastAssertionType];
        for (const prop of properties) {
          const item = new vscode.CompletionItem(
            prop.label,
            vscode.CompletionItemKind.Property
          );
          item.detail = prop.detail;
          item.insertText = new vscode.SnippetString(prop.insertText);
          item.sortText = `0-${prop.label}`;
          items.push(item);
        }
        return items;
      }

      // Assert block: suggest assertion entries
      if (ctx.inAssert && !ctx.lastAssertionType) {
        for (const assertion of ASSERTION_TYPES) {
          const item = new vscode.CompletionItem(
            `- type: ${assertion.label}`,
            vscode.CompletionItemKind.Snippet
          );
          item.detail = assertion.detail;
          item.insertText = new vscode.SnippetString(
            `- type: ${assertion.label}\n  `
          );
          item.sortText = `0-${assertion.label}`;
          items.push(item);
        }
        return items;
      }

      // Top-level key completions (when at root level)
      if (ctx.currentIndent === 0 || ctx.currentIndent === -1) {
        const topLevelKeys = [
          {
            label: "version",
            insertText: 'version: "1"',
            detail: "Config schema version (required)",
          },
          {
            label: "defaults",
            insertText: "defaults:\n  provider: ",
            detail: "Default settings for all suites",
          },
          {
            label: "suites",
            insertText: "suites:\n  - name: ",
            detail: "Test suites (required)",
          },
          {
            label: "providers",
            insertText: "providers:\n  openai:\n    api_key_env: OPENAI_API_KEY",
            detail: "Provider configurations",
          },
          {
            label: "compliance",
            insertText: "compliance:\n  enabled: true\n  framework: eu-ai-act",
            detail: "EU AI Act compliance settings",
          },
          {
            label: "upload",
            insertText: "upload:\n  enabled: true",
            detail: "KindLM Cloud upload settings",
          },
        ];

        for (const key of topLevelKeys) {
          const item = new vscode.CompletionItem(
            key.label,
            vscode.CompletionItemKind.Property
          );
          item.detail = key.detail;
          item.insertText = new vscode.SnippetString(key.insertText);
          item.sortText = `0-${key.label}`;
          items.push(item);
        }
      }

      return items;
    },
  };
}
