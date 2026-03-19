# Why Did My Test Fail?

Common failures, what they mean, and how to fix them.

---

## Config errors

### `CONFIG_VALIDATION_ERROR: At least one provider must be configured`

You don't have a `providers` section, or it's empty.

```yaml
# Fix: add at least one provider
providers:
  openai:
    apiKeyEnv: "OPENAI_API_KEY"
```

### `CONFIG_VALIDATION_ERROR: Exactly one of 'prompt' or 'command' must be set`

Each test case needs either a `prompt` (referencing a key in `prompts`) or a `command` (a shell command). Not both, and not neither.

```yaml
# Wrong — missing prompt
tests:
  - name: "my-test"
    expect:
      judge:
        - criteria: "..."

# Fix — add prompt reference
tests:
  - name: "my-test"
    prompt: "my-prompt"
    expect:
      judge:
        - criteria: "..."
```

### `CONFIG_VALIDATION_ERROR: schemaFile is required when format is 'json'`

You set `output.format: "json"` but didn't provide a schema file.

```yaml
# Fix: add schemaFile
expect:
  output:
    format: "json"
    schemaFile: "./schemas/response.json"
```

---

## Provider errors

### `Authentication failed`

Your API key is missing or invalid. Check:

1. The env var name in `apiKeyEnv` matches what you've exported
2. The key is set in your shell: `echo $OPENAI_API_KEY`
3. In CI, the secret is configured in your repo settings

```bash
# Verify the key is set
echo $OPENAI_API_KEY | head -c 10
```

### `Rate limited`

You're sending too many requests. Reduce concurrency:

```yaml
defaults:
  concurrency: 1
```

Or increase delay between requests by lowering `concurrency` and reducing `repeat`.

### `Provider timeout`

The model took too long to respond. Increase the timeout:

```yaml
defaults:
  timeoutMs: 120000  # 2 minutes
```

For large prompts or complex tool chains, 60 seconds (the default) may not be enough.

### `Network error`

Can't reach the provider API. Check your internet connection and any proxy settings. For Ollama, make sure the server is running:

```bash
ollama serve
```

---

## Assertion failures

### `TOOL_CALL_MISSING: Expected tool 'X' to be called`

The model didn't call the tool you expected. Common causes:

1. **Tool not in tools list** — the tool must be defined in the test's `tools` section for the model to know about it
2. **Prompt doesn't instruct tool use** — make sure your system prompt tells the model about available tools
3. **Model chose not to call it** — the model decided a direct response was better. Make the prompt more explicit about when to use tools.
4. **Temperature too high** — lower `temperature` for more predictable behavior

### `TOOL_CALL_UNEXPECTED: Tool 'X' was called but shouldNotCall was set`

The model called a tool you explicitly forbid. This is usually a prompt issue — the model doesn't know it shouldn't call that tool, or the instruction isn't strong enough.

Fix: strengthen the system prompt, or add explicit instructions like "Never call process_refund without manager approval."

### `TOOL_CALL_ARGS_MISMATCH: Expected args {...} but got {...}`

The model called the right tool with wrong arguments. Check:

1. The `argsMatch` values are what the model would reasonably extract from the user message
2. You're using partial matching — `argsMatch` only checks the keys you specify, extra keys are fine
3. The argument types match — `"123"` (string) vs `123` (number)

### `TOOL_CALL_ORDER_WRONG: Expected tool 'X' at position N`

Tools were called in the wrong order. The `order` field is 0-indexed:

```yaml
toolCalls:
  - tool: "step_one"
    order: 0        # called first
  - tool: "step_two"
    order: 1        # called second
```

### `SCHEMA_INVALID: Output does not match schema`

The model's JSON output doesn't match your JSON Schema. Check:

1. The model is actually returning JSON (not markdown-wrapped JSON)
2. The schema matches what the model is producing — run `kindlm test --reporter json` to see the raw output
3. `additionalProperties: false` in your schema will reject extra fields the model adds

### `SCHEMA_PARSE_ERROR: Output is not valid JSON`

The model returned text that isn't valid JSON. Common causes:

1. Model wrapped JSON in markdown code blocks (\`\`\`json ... \`\`\`)
2. Model added explanation text before/after the JSON
3. Model returned partial JSON (truncated by `maxTokens`)

Fix: make the system prompt explicit: "Respond with JSON only. No markdown, no explanation."

### `PII_DETECTED: Found PII pattern 'X' in output`

The output contains text matching a PII regex pattern. Check:

1. The model is leaking data from tool responses — tighten the prompt: "Never include customer email, phone, or SSN in your response"
2. False positive — the pattern matched something that isn't actually PII. Add the false-positive text to context in the prompt, or adjust custom patterns.

### `KEYWORD_DENIED: Output contains denied keyword 'X'`

The output contains a forbidden word or phrase. This is case-insensitive.

If it's a false positive (the word appears in legitimate context), either remove it from the deny list or restructure the test.

### `KEYWORD_MISSING: Output does not contain any allowed keyword`

You set `guardrails.keywords.allow` and none of those keywords appear in the output. The output must contain at least one of the allowed keywords.

### `JUDGE_BELOW_THRESHOLD: Score 0.XX < minimum 0.XX`

The LLM judge scored the response below your threshold. Check:

1. `kindlm test --reporter json` to see the judge's reasoning
2. The criteria might be too strict for the model — try lowering `minScore`
3. The model's response might actually be bad — read the output and the judge's explanation
4. Judge results are non-deterministic — increase `defaults.repeat` and check if it's consistently failing

### `DRIFT_EXCEEDED: Drift score 0.XX > maximum 0.XX`

The output has changed significantly from the baseline. This isn't necessarily a bug — maybe the change is intentional.

1. Review the diff: `kindlm baseline compare`
2. If the new behavior is better, update the baseline: `kindlm baseline set`
3. If it's a regression, investigate the prompt change that caused it

---

## Gate failures

### `Gates: ✗ FAILED — pass rate 85% < minimum 95%`

Too many individual assertions failed across all tests and runs. Either:

1. Fix the failing assertions (see above)
2. Lower `gates.passRateMin` if the threshold is too strict for your use case
3. Increase `defaults.repeat` — more runs smooth out non-deterministic failures

### Deterministic vs probabilistic gates

If your deterministic assertions (schema, PII, keywords, tool calls) all pass but judge scores drag down the overall pass rate, use split gates:

```yaml
gates:
  deterministicPassRate: 1.0    # zero tolerance for deterministic checks
  probabilisticPassRate: 0.8    # allow some variance in judge scores
```

---

## CI-specific issues

### Tests pass locally but fail in CI

1. **Missing API key** — check that the secret is set in CI settings
2. **Rate limiting** — CI runs may overlap with other jobs. Lower `concurrency`
3. **Network** — some CI environments block outbound requests. Check firewall rules
4. **Timeout** — CI runners may be slower. Increase `timeoutMs`

### Job times out

LLM API calls are slow. Set `timeout-minutes: 10` (or more) on the job:

```yaml
jobs:
  kindlm:
    runs-on: ubuntu-latest
    timeout-minutes: 10
```

### How to read JUnit output

```bash
kindlm test --reporter junit > junit.xml
```

Each test case becomes a JUnit `<testcase>`. Failed assertions become `<failure>` elements with the failure code and message. Most CI systems (GitHub Actions, GitLab, Jenkins) render this natively.

---

## Still stuck?

1. Run with `--reporter json` to see full details including raw model output
2. Check [GitHub Issues](https://github.com/kindlm/kindlm/issues) for known problems
3. Open a new issue with your config (redact API keys) and the error output
