---
phase: quick
plan: 260330-jxl
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/30-VSCODE_EXTENSION.md
  - docs/00-README.md
autonomous: true
must_haves:
  truths:
    - "docs/ has a VS Code Extension page covering installation, features, snippets, and JSON schema"
    - "README docs section links to the VS Code Extension page"
  artifacts:
    - path: "docs/30-VSCODE_EXTENSION.md"
      provides: "VS Code Extension documentation page"
      min_lines: 120
    - path: "docs/00-README.md"
      provides: "Updated README with VS Code Extension docs link"
---

<objective>
Create the VS Code Extension docs page (docs/30-VSCODE_EXTENSION.md) and add it to the README docs links.

Purpose: The docs/ directory has 29 numbered docs (00-29) covering every aspect of KindLM except the VS Code extension. The extension has a solid README inside packages/vscode/README.md, but there is no user-facing docs page in the numbered docs system. The main README (docs/00-README.md) does not link to VS Code extension docs either.

Output: docs/30-VSCODE_EXTENSION.md + updated docs/00-README.md with the new link.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/00-README.md
@packages/vscode/README.md
@packages/vscode/package.json
@packages/vscode/src/extension.ts
@packages/vscode/src/completions.ts
@packages/vscode/src/hover.ts
@packages/vscode/snippets/kindlm.code-snippets
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write docs/30-VSCODE_EXTENSION.md</name>
  <files>docs/30-VSCODE_EXTENSION.md</files>
  <action>
Create a comprehensive VS Code Extension documentation page following the style and depth of existing docs (e.g., 08-CLI_REFERENCE.md). The page should be written for end users, not contributors.

Structure the document with these sections:

1. **Title and overview** — "VS Code Extension" header, one-paragraph intro explaining what the extension provides (YAML validation, autocomplete, hover docs, JSON schema, snippets).

2. **Installation** — Two methods: (a) VS Code Marketplace search for "KindLM", (b) CLI install via `code --install-extension kindlm.kindlm`. Mention minimum VS Code version 1.85.0. Mention that the extension activates automatically when a `kindlm.yaml` or `kindlm.yml` file is present in the workspace (`workspaceContains` activation).

3. **Features** section with subsections:

   a. **Real-Time Diagnostics** — The extension runs inline diagnostics on save/change. Document what it checks:
      - Missing required top-level field `version` (must be `1`)
      - Missing required `suites` field
      - Invalid provider format (must be `provider:model` pattern like `openai:gpt-4o`)
      - Unknown assertion types (valid: tool_called, tool_not_called, tool_order, schema, judge, no_pii, keywords_present, keywords_absent, drift, latency, cost)
      - Temperature out of range (must be 0-2)
      - Threshold out of range (must be 0.0-1.0)

   b. **Autocomplete** — Context-aware completions. Document each context:
      - Top-level keys: kindlm, project, suite, providers, models, prompts, tests, gates, defaults, compliance, upload
      - Inside `expect:` root: output, toolCalls, judge, guardrails, baseline, latency, cost
      - Inside `expect.toolCalls[]`: tool, argsMatch, shouldNotCall, argsSchema, order
      - Inside `expect.judge[]`: criteria, minScore, rubric, model
      - Inside `expect.guardrails`: pii, keywords
      - Inside `expect.guardrails.pii`: enabled, denyPatterns, customPatterns
      - Inside `expect.guardrails.keywords`: deny, allow
      - Inside `expect.output`: format, contains, notContains, maxLength, schemaFile
      - Inside `expect.baseline`: drift
      - Inside `expect.baseline.drift`: maxScore, method, fields
      - Inside `expect.latency`: maxMs
      - Inside `expect.cost`: maxUsd
      - Model name values (gpt-4o, claude-sonnet-4-5-20250929, gemini-2.0-flash, etc.)
      - Provider name values (openai, anthropic, gemini, mistral, cohere, ollama, http)
      - Drift method values (judge, embedding, field-diff)
      - Output format values (text, json)
      Note: Completions trigger on `:`, ` `, and `-` characters.

   c. **Hover Documentation** — Hovering over any KindLM config key shows inline docs with description. Hovering over `expect` sub-sections (toolCalls, judge, guardrails, output, baseline, latency, cost) shows rich Markdown with summary and example YAML. Hovering over provider name values shows provider info with common models and API key env var.

   d. **JSON Schema** — A bundled `kindlm.schema.json` provides schema-based validation. Works automatically with files named `kindlm.yaml` or `kindlm.yml`. For enhanced completions, recommend installing the Red Hat YAML extension (redhat.vscode-yaml) alongside KindLM. The schema is contributed via the `yamlValidation` contribution point.

   e. **Snippets** — List all 10 snippets with their prefix, description, and a short example of what they expand to. Use a table format:
      | Prefix | Description |
      |--------|-------------|
      | `kindlm-init` | Full config file skeleton |
      | `kindlm-test` | Single test case |
      | `kindlm-model` | Model configuration entry |
      | `kindlm-prompt` | Named prompt template |
      | `kindlm-expect-tool` | `toolCalls` assertion |
      | `kindlm-expect-judge` | `judge` assertion with minScore |
      | `kindlm-expect-pii` | PII guardrail |
      | `kindlm-expect-keywords` | Keyword guardrail |
      | `kindlm-expect-output` | Output content assertion |
      | `kindlm-expect-drift` | Baseline drift assertion |
      Then show one expanded snippet example (kindlm-init) so users understand what snippets produce.

4. **Recommended Companion Extensions** — Suggest the Red Hat YAML extension for schema-based validation and completions.

5. **Troubleshooting** — Common issues:
   - Extension not activating: must have `kindlm.yaml` or `kindlm.yml` in workspace root
   - Completions not showing: check file is named correctly, try Ctrl+Space to trigger
   - Schema validation not working: install Red Hat YAML extension

Do NOT include internal implementation details, architecture, or contributing instructions. This is user-facing documentation.
  </action>
  <verify>
    <automated>test -f docs/30-VSCODE_EXTENSION.md && wc -l docs/30-VSCODE_EXTENSION.md | awk '{if ($1 >= 120) print "PASS: " $1 " lines"; else print "FAIL: only " $1 " lines"}'</automated>
  </verify>
  <done>docs/30-VSCODE_EXTENSION.md exists with 120+ lines covering installation, all 5 feature areas (diagnostics, autocomplete, hover, schema, snippets), and troubleshooting.</done>
</task>

<task type="auto">
  <name>Task 2: Add VS Code Extension link to README docs section</name>
  <files>docs/00-README.md</files>
  <action>
In docs/00-README.md, find the "## Documentation" section (around line 189). Add a new link for the VS Code extension between the Troubleshooting link and the License section. The new line should be:

```
- [VS Code Extension](/docs/vscode-extension) — autocomplete, validation, hover docs, snippets
```

Place it after the Troubleshooting line and before the empty line that precedes `## License`. This keeps it as the last docs link, which makes sense since the extension is a companion tool rather than core functionality.
  </action>
  <verify>
    <automated>grep -c "VS Code Extension" docs/00-README.md | awk '{if ($1 >= 1) print "PASS"; else print "FAIL: link not found"}'</automated>
  </verify>
  <done>docs/00-README.md contains a link to the VS Code Extension docs page in the Documentation section.</done>
</task>

</tasks>

<verification>
- `docs/30-VSCODE_EXTENSION.md` exists and covers all extension features
- `docs/00-README.md` links to VS Code Extension docs
- No broken internal references
</verification>

<success_criteria>
- VS Code Extension docs page is complete with installation, features, snippets table, and troubleshooting
- README documentation section includes the VS Code Extension link
- Content is accurate to the actual extension source code (completions.ts, hover.ts, extension.ts, snippets)
</success_criteria>

<output>
After completion, create `.planning/quick/260330-jxl-write-the-vs-code-extension-docs-page-an/260330-jxl-SUMMARY.md`
</output>
