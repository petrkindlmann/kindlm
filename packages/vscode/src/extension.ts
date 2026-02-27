import * as vscode from "vscode";
import { createCompletionProvider } from "./completions";
import { createHoverProvider } from "./hover";

const KINDLM_FILE_PATTERN = "**/kindlm.{yaml,yml}";

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("kindlm");
  context.subscriptions.push(diagnosticCollection);

  // Register completion provider for YAML files
  const completionProvider = createCompletionProvider();
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "yaml", pattern: KINDLM_FILE_PATTERN },
      completionProvider,
      ":",
      " ",
      "-"
    )
  );

  // Register hover provider for YAML files
  const hoverProvider = createHoverProvider();
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "yaml", pattern: KINDLM_FILE_PATTERN },
      hoverProvider
    )
  );

  // Run diagnostics on open and change
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (isKindlmFile(doc)) {
        runDiagnostics(doc);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (isKindlmFile(event.document)) {
        runDiagnostics(event.document);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
    })
  );

  // Run diagnostics on all already-open kindlm files
  for (const doc of vscode.workspace.textDocuments) {
    if (isKindlmFile(doc)) {
      runDiagnostics(doc);
    }
  }
}

export function deactivate(): void {
  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
}

function isKindlmFile(document: vscode.TextDocument): boolean {
  if (document.languageId !== "yaml") {
    return false;
  }
  const fileName = document.fileName;
  return fileName.endsWith("kindlm.yaml") || fileName.endsWith("kindlm.yml");
}

function runDiagnostics(document: vscode.TextDocument): void {
  const diagnostics: vscode.Diagnostic[] = [];
  const text = document.getText();
  const lines = text.split("\n");

  // Check for required 'version' field
  const hasVersion = lines.some((line) => /^version:\s/.test(line));
  if (!hasVersion) {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        'Missing required field: "version". Must be set to "1".',
        vscode.DiagnosticSeverity.Error
      )
    );
  }

  // Check version value
  for (let i = 0; i < lines.length; i++) {
    const versionMatch = lines[i].match(/^version:\s*"?(\d+)"?\s*$/);
    if (versionMatch && versionMatch[1] !== "1") {
      diagnostics.push(
        new vscode.Diagnostic(
          new vscode.Range(i, 0, i, lines[i].length),
          `Invalid version "${versionMatch[1]}". Only version "1" is supported.`,
          vscode.DiagnosticSeverity.Error
        )
      );
    }
  }

  // Check for required 'suites' field
  const hasSuites = lines.some((line) => /^suites:\s*$/.test(line));
  if (!hasSuites) {
    diagnostics.push(
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        'Missing required field: "suites".',
        vscode.DiagnosticSeverity.Error
      )
    );
  }

  // Validate provider format where found
  const providerPattern =
    /^(\s*)provider:\s*["']?([^"'\s#]+)["']?\s*(#.*)?$/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(providerPattern);
    if (match) {
      const providerValue = match[2];
      const validProviderFormat =
        /^(openai|anthropic|gemini|mistral|cohere|ollama):.+$/;
      if (!validProviderFormat.test(providerValue)) {
        const valueStart = lines[i].indexOf(providerValue);
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(i, valueStart, i, valueStart + providerValue.length),
            `Invalid provider format "${providerValue}". Expected "provider:model" (e.g., "openai:gpt-4o").`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }
  }

  // Validate assertion types
  const assertionTypePattern =
    /^(\s*)(?:-\s+)?type:\s*["']?([^"'\s#]+)["']?\s*(#.*)?$/;
  const validTypes = new Set([
    "tool_called",
    "tool_not_called",
    "tool_order",
    "schema",
    "judge",
    "no_pii",
    "keywords_present",
    "keywords_absent",
    "drift",
    "latency",
    "cost",
  ]);

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(assertionTypePattern);
    if (match) {
      const indent = match[1].length;
      // Only flag assertion types that are indented (inside assert blocks), not top-level 'type' keys
      if (indent >= 6) {
        const typeValue = match[2];
        if (!validTypes.has(typeValue)) {
          const valueStart = lines[i].indexOf(typeValue);
          diagnostics.push(
            new vscode.Diagnostic(
              new vscode.Range(i, valueStart, i, valueStart + typeValue.length),
              `Unknown assertion type "${typeValue}". Valid types: ${Array.from(validTypes).join(", ")}.`,
              vscode.DiagnosticSeverity.Warning
            )
          );
        }
      }
    }
  }

  // Validate temperature range
  const temperaturePattern =
    /^(\s*)temperature:\s*([0-9]*\.?[0-9]+)\s*(#.*)?$/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(temperaturePattern);
    if (match) {
      const temp = parseFloat(match[2]);
      if (temp < 0 || temp > 2) {
        const valueStart = lines[i].indexOf(match[2]);
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(i, valueStart, i, valueStart + match[2].length),
            `Temperature ${temp} is out of range. Must be between 0 and 2.`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }
  }

  // Validate threshold range (0-1)
  const thresholdPattern = /^(\s*)threshold:\s*([0-9]*\.?[0-9]+)\s*(#.*)?$/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(thresholdPattern);
    if (match) {
      const threshold = parseFloat(match[2]);
      if (threshold < 0 || threshold > 1) {
        const valueStart = lines[i].indexOf(match[2]);
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(i, valueStart, i, valueStart + match[2].length),
            `Threshold ${threshold} is out of range. Must be between 0.0 and 1.0.`,
            vscode.DiagnosticSeverity.Error
          )
        );
      }
    }
  }

  diagnosticCollection.set(document.uri, diagnostics);
}
