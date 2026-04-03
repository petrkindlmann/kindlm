# Phase 17: GitHub Action - Research

**Researched:** 2026-04-03
**Domain:** GitHub Actions JS action (TypeScript + @vercel/ncc + GitHub Actions toolkit)
**Confidence:** HIGH

## Summary

Phase 17 creates a greenfield repo `kindlm/test-action` — a JS GitHub Action that wraps the published `@kindlm/cli` npm package. The action installs the CLI, runs tests with dual reporters (JUnit + JSON), parses JSON output for counts, uploads JUnit as an artifact, optionally posts/updates PR comments, and optionally uploads results to KindLM Cloud.

The GitHub Actions toolkit (`@actions/core`, `@actions/exec`, `@actions/artifact`, `@actions/github`) is mature and stable. The core pattern — TypeScript source bundled via `@vercel/ncc` into `dist/index.js` checked into the repo — is the established standard for JS actions. All decisions in CONTEXT.md align with current best practices.

**Primary recommendation:** Bundle with `@vercel/ncc` into `dist/index.js`, use `npm install -g @kindlm/cli@{version}` for CLI install, use `exec.getExecOutput()` to capture JSON reporter output, use `@actions/artifact` v6 `DefaultArtifactClient.uploadArtifact()` for JUnit, and use `issues.listComments` + marker to upsert PR comments.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Separate repo `kindlm/test-action`. `action.yml` at root, `dist/` checked in.
- **D-02:** `runs.using: node20` — JS action, NOT Docker.
- **D-03:** Bundle with `@vercel/ncc` into single `dist/index.js`.
- **D-04:** Structure: `action.yml`, `src/index.ts`, `dist/index.js`, `package.json`, `tsconfig.json`, `.github/workflows/test.yml`
- **D-05:** Input `config` — path to kindlm.yaml (default: `kindlm.yaml`)
- **D-06:** Input `reporter` — reporter type (default: `junit`)
- **D-07:** Input `args` — additional CLI args passed through
- **D-08:** Input `cloud-token` — optional `KINDLM_API_TOKEN`
- **D-09:** Input `comment` — post PR comment (default: `true`)
- **D-10:** Input `version` — @kindlm/cli version to install (default: `latest`)
- **D-11:** Output `pass-rate` — percentage as string (e.g., "95.5")
- **D-12:** Outputs `total`, `passed`, `failed` — integer counts as strings
- **D-13:** Output `exit-code` — "0" or "1"
- **D-14:** Action flow: install CLI → run with `--reporter junit --reporter json` → parse JSON → upload JUnit → post PR comment → upload cloud → set outputs
- **D-15:** Use `@actions/core`, `@actions/exec`, `@actions/artifact`, `@actions/github`
- **D-16:** PR comment markdown format with table + failing test list
- **D-17:** Update existing comment by marker `<!-- kindlm-test-results -->` (don't spam new ones)
- **D-18:** NEVER write raw model responses to step summary or PR comments
- **D-19:** JUnit XML contains test names and assertion messages but NOT model response text
- **D-20:** Action's own CI: matrix on ubuntu-latest, macos-latest, windows-latest
- **D-21:** No platform-specific code — pure Node.js
- **D-22:** Cloud upload is non-fatal — failure must not fail CI

### Claude's Discretion
- Exact npm install command (global vs npx)
- Whether to use `@actions/tool-cache` for caching the CLI install
- Error handling strategy for network failures during install
- Whether to support `working-directory` input for monorepo users

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACTION-01 | Works on ubuntu-latest, macos-latest, windows-latest | JS action (node20) is cross-platform; no shell scripts; path.join for file paths |
| ACTION-02 | Inputs: config, reporter, args, cloud-token | `core.getInput()` with required/default documented below |
| ACTION-03 | Outputs: pass-rate, total, passed, failed, exit-code | `core.setOutput()` after parsing JSON reporter stdout |
| ACTION-04 | Uploads JUnit XML as GitHub artifact | `DefaultArtifactClient.uploadArtifact()` from `@actions/artifact` v6 |
| ACTION-05 | Posts PR comment with test summary | `octokit.rest.issues.listComments()` → find by marker → create or update |
| ACTION-06 | Cloud upload when cloud-token is set | `exec.exec('kindlm upload')` wrapped in try/catch; non-fatal |
| ACTION-07 | Bundled as JS action via @vercel/ncc, dist/index.js | `npx ncc build src/index.ts -o dist`; dist/ checked in |
| ACTION-08 | Never writes raw model responses to summary | Only parse `summary.*` and `suites[].tests[].name/status` from JSON; skip `response_text` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @actions/core | 3.0.0 | Inputs, outputs, logging, setFailed | Official GitHub toolkit — the only correct way to interact with the runner |
| @actions/exec | 3.0.0 | Run CLI commands, capture stdout/stderr | `getExecOutput()` handles buffering; cross-platform |
| @actions/artifact | 6.2.1 | Upload JUnit XML artifact | Official v6; v3 deprecated Jan 2025 |
| @actions/github | 9.0.0 | Octokit client for PR comments | Provides pre-authed Octokit with correct GITHUB_TOKEN |
| @vercel/ncc | 0.38.4 | Bundle TS → single dist/index.js | GitHub's own recommended bundler for JS actions; no node_modules committed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @actions/tool-cache | 4.0.0 | Cache installed CLI across runs | Optional: can cache `@kindlm/cli` global install to speed repeated runs |
| typescript | 5.7+ | Type checking during dev | Build-time only; not bundled into dist |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @vercel/ncc | esbuild directly | ncc is simpler, handles dynamic requires; esbuild needs more config |
| npm install -g | npx @kindlm/cli | Both work; global install is cleaner for version pinning and repeated calls |
| @actions/artifact v6 | actions/upload-artifact step | Programmatic upload gives better error handling; step-based is simpler but less controllable |

**Installation (action repo package.json devDependencies):**
```bash
npm install --save-dev @actions/core @actions/exec @actions/artifact @actions/github @vercel/ncc typescript
```

**Version verification:** All versions confirmed against npm registry 2026-04-03.

## Architecture Patterns

### Recommended Project Structure
```
kindlm/test-action/
├── action.yml              # Action metadata — inputs, outputs, runs.using
├── src/
│   └── index.ts            # All action logic (~200-300 LOC)
├── dist/
│   └── index.js            # Bundled output — CHECKED INTO GIT
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/
        └── test.yml        # Action's own CI (ubuntu/macos/windows matrix)
```

### Pattern 1: action.yml Schema
**What:** Declares the action's public interface — GitHub reads this to wire inputs/outputs.
**When to use:** Every JS action requires this at repo root.
**Example:**
```yaml
name: 'KindLM Test'
description: 'Run KindLM behavioral tests in CI'
author: 'KindLM'

inputs:
  config:
    description: 'Path to kindlm.yaml config file'
    required: false
    default: 'kindlm.yaml'
  version:
    description: '@kindlm/cli version to install'
    required: false
    default: 'latest'
  reporter:
    description: 'Reporter type'
    required: false
    default: 'junit'
  args:
    description: 'Additional CLI arguments'
    required: false
    default: ''
  cloud-token:
    description: 'KindLM Cloud API token for uploading results'
    required: false
    default: ''
  comment:
    description: 'Post PR comment with test summary'
    required: false
    default: 'true'

outputs:
  pass-rate:
    description: 'Test pass rate as a percentage string'
  total:
    description: 'Total number of tests'
  passed:
    description: 'Number of passed tests'
  failed:
    description: 'Number of failed tests'
  exit-code:
    description: 'CLI exit code: 0 (pass) or 1 (fail)'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

### Pattern 2: Reading Inputs and Setting Outputs
**What:** `@actions/core` API for input/output.
**Example:**
```typescript
import * as core from '@actions/core';

const config = core.getInput('config') || 'kindlm.yaml';
const version = core.getInput('version') || 'latest';
const cloudToken = core.getInput('cloud-token');  // empty string if not set
const comment = core.getInput('comment') !== 'false';

// After parsing results:
core.setOutput('pass-rate', passRate.toFixed(1));
core.setOutput('total', String(total));
core.setOutput('passed', String(passed));
core.setOutput('failed', String(failed));
core.setOutput('exit-code', String(exitCode));
```

### Pattern 3: Running the CLI and Capturing JSON Output
**What:** `exec.getExecOutput()` runs kindlm with dual reporters; JSON goes to stdout, captured in memory. JUnit writes to file.
**Critical:** Run with `--reporter json` AND `--reporter junit` in the same invocation (D-14 confirms kindlm supports multiple reporters).
**Example:**
```typescript
import * as exec from '@actions/exec';
import * as path from 'path';
import * as os from 'os';

const junitPath = path.join(os.tmpdir(), 'kindlm-results.xml');

const result = await exec.getExecOutput(
  'kindlm',
  [
    'test',
    '--config', config,
    '--reporter', 'json',
    '--reporter', 'junit',
    '--output', junitPath,   // verify CLI flag for JUnit file output
    ...extraArgs,
  ],
  { ignoreReturnCode: true }  // CRITICAL: don't throw on non-zero exit
);

const exitCode = result.exitCode;
const jsonReport = JSON.parse(result.stdout);
```

**JSON shape (from `packages/core/src/reporters/json.ts`):**
```typescript
// jsonReport shape — only use these fields (ACTION-08: no response_text)
interface KindlmJsonReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    errored: number;
    skipped: number;
    durationMs: number;
  };
  suites: Array<{
    name: string;
    tests: Array<{
      name: string;
      status: 'passed' | 'failed' | 'errored' | 'skipped';
      assertions: Array<{
        passed: boolean;
        label: string;
        failureMessage?: string;
      }>;
    }>;
  }>;
}
```

### Pattern 4: Uploading JUnit Artifact
**What:** `@actions/artifact` v6 uses `DefaultArtifactClient`.
**Example:**
```typescript
import { DefaultArtifactClient } from '@actions/artifact';

const artifactClient = new DefaultArtifactClient();
await artifactClient.uploadArtifact(
  'kindlm-test-results',
  [junitPath],
  os.tmpdir(),
  { retentionDays: 30 }
);
```

### Pattern 5: PR Comment Upsert via Marker
**What:** Find existing comment by hidden HTML marker; update if found, create if not. Only runs when `github.context.eventName === 'pull_request'`.
**Example:**
```typescript
import * as github from '@actions/github';

const MARKER = '<!-- kindlm-test-results -->';

async function upsertPrComment(body: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN!;
  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const prNumber = github.context.payload.pull_request?.number;

  if (!prNumber) return;  // Not a PR event

  // Find existing comment
  const comments = await octokit.rest.issues.listComments({
    owner, repo, issue_number: prNumber, per_page: 100,
  });
  const existing = comments.data.find(c => c.body?.includes(MARKER));

  const fullBody = `${MARKER}\n${body}`;

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner, repo, comment_id: existing.id, body: fullBody,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner, repo, issue_number: prNumber, body: fullBody,
    });
  }
}
```

### Pattern 6: Installing the CLI
**What:** `npm install -g @kindlm/cli@{version}` installs globally; then `kindlm` is on PATH. This is recommended over `npx` because (a) version is pinned, (b) `kindlm upload` is called in a separate exec call.
**Example:**
```typescript
await exec.exec('npm', ['install', '-g', `@kindlm/cli@${version}`]);
```

**Caching (Claude's Discretion):** Use `@actions/tool-cache` to cache the global npm install dir. Saves ~5-10s on repeated runs. Key: `kindlm-cli-${version}-${process.platform}`.

### Pattern 7: Building the Action
**What:** ncc bundles TypeScript into dist/index.js. dist/ must be committed.
**package.json scripts:**
```json
{
  "scripts": {
    "build": "ncc build src/index.ts -o dist --source-map --license licenses.txt",
    "typecheck": "tsc --noEmit",
    "test": "vitest"
  }
}
```

### Anti-Patterns to Avoid
- **Using Docker runtime:** Fails on macOS and Windows runners. Decision D-02 locks node20.
- **Not using `ignoreReturnCode: true`:** `exec.getExecOutput()` throws on non-zero exit by default. KindLM exits 1 on test failures — the action must handle this without crashing.
- **Calling `core.setFailed()` for test failures:** Test failures are expected outcomes, not action errors. Only call `setFailed()` for unexpected errors (parse failures, network errors).
- **Committing node_modules:** Bundle with ncc instead. dist/ is the only compiled artifact needed.
- **Posting new PR comment on every push:** Always upsert by marker (D-17).
- **Skipping `ignoreReturnCode` on cloud upload:** Cloud upload is non-fatal (D-22); wrap in try/catch AND use `ignoreReturnCode: true`.
- **Writing `response_text` to PR comments or step summary:** Violates ACTION-08 security requirement.
- **Hardcoding JUnit file path without os.tmpdir():** Use `path.join(os.tmpdir(), 'kindlm-results.xml')` for cross-platform compatibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input reading | Custom env var parsing | `core.getInput()` | Handles default values, trimming, required validation |
| Command execution | `child_process.exec` | `exec.getExecOutput()` | Cross-platform, streams to runner logs, handles buffering |
| Artifact upload | GitHub API calls directly | `DefaultArtifactClient.uploadArtifact()` | Handles auth, retry, multipart upload internals |
| PR comments | REST calls with fetch | `github.getOctokit(token)` | Pre-authed, typed, handles pagination |
| Failure signaling | `process.exit(1)` | `core.setFailed(msg)` | Sets correct runner exit code AND logs message |

**Key insight:** The GitHub Actions toolkit handles all runner protocol commands (stdout-based wire protocol). Rolling custom implementations breaks on runner updates.

## Common Pitfalls

### Pitfall 1: PR Comment Permissions on Fork PRs
**What goes wrong:** `pull_request` events from forks have read-only GITHUB_TOKEN. `issues.createComment` returns 403.
**Why it happens:** GitHub restricts write permissions for security when PRs come from forked repos.
**How to avoid:** Wrap comment creation in try/catch. Log a warning but don't fail. Alternatively, document that users must add `permissions: pull-requests: write` to their workflow.
**Warning signs:** 403 error in comment creation step; PR is from a fork.

### Pitfall 2: `exec.getExecOutput()` Throws on Non-Zero Exit
**What goes wrong:** `kindlm test` exits 1 when tests fail. Without `ignoreReturnCode: true`, the action throws before you can read stdout.
**Why it happens:** Default behavior treats non-zero exit as error.
**How to avoid:** Always pass `{ ignoreReturnCode: true }` when running `kindlm test`. Capture `result.exitCode` manually.

### Pitfall 3: JSON Reporter Output Mixed with CLI Logging
**What goes wrong:** If kindlm writes any non-JSON to stdout before the JSON output, `JSON.parse(result.stdout)` throws.
**Why it happens:** CLIs often write progress indicators to stdout before structured output.
**How to avoid:** Verify the `--reporter json` flag outputs clean JSON only. From `packages/core/src/reporters/json.ts`, the reporter returns `{ content: JSON.stringify(report, null, 2), format: 'json' }` — confirm the CLI writes ONLY this to stdout when `--reporter json` is active. If needed, parse by finding the first `{` and slicing.

### Pitfall 4: dist/ Not Committed / Stale
**What goes wrong:** Action uses `dist/index.js` but it's stale or gitignored.
**Why it happens:** Developers forget to rebuild before committing, or accidentally add dist/ to .gitignore.
**How to avoid:** Add a CI check that runs `npm run build` and then `git diff --exit-code dist/` to fail if dist is stale. Add dist/ explicitly to .gitignore's negation list.

### Pitfall 5: Windows Path Separator in Artifact Upload
**What goes wrong:** `uploadArtifact()` fails on Windows when file paths use backslashes.
**Why it happens:** `path.join()` on Windows returns backslash-separated paths; artifact client expects forward slashes in some contexts.
**How to avoid:** Use `path.join(os.tmpdir(), 'kindlm-results.xml')` — Node.js handles this correctly on all platforms. Use `path.resolve()` to get absolute paths.

### Pitfall 6: @actions/artifact v6 Requires Runner 2.327.1+
**What goes wrong:** `DefaultArtifactClient.uploadArtifact()` fails on self-hosted runners below v2.327.1.
**Why it happens:** v6 uses node24 runtime internally and new artifact protocol.
**How to avoid:** Document minimum runner version. The action targets GitHub-hosted runners which are always current. For self-hosted, document the constraint.

### Pitfall 7: PR Comment Only Makes Sense on pull_request Events
**What goes wrong:** Action runs on push events (no PR); `context.payload.pull_request` is undefined; comment code crashes.
**Why it happens:** `push` events don't have a pull_request payload.
**How to avoid:** Always guard: `if (github.context.eventName !== 'pull_request') return;` before any PR comment logic.

## Code Examples

Verified patterns from official sources:

### Full Action Entry Point Skeleton
```typescript
// src/index.ts
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as os from 'os';
import { DefaultArtifactClient } from '@actions/artifact';
import * as github from '@actions/github';

async function run(): Promise<void> {
  try {
    const config = core.getInput('config') || 'kindlm.yaml';
    const version = core.getInput('version') || 'latest';
    const args = core.getInput('args') || '';
    const cloudToken = core.getInput('cloud-token');
    const comment = core.getInput('comment') !== 'false';

    // Step 1: Install CLI
    core.info(`Installing @kindlm/cli@${version}...`);
    await exec.exec('npm', ['install', '-g', `@kindlm/cli@${version}`]);

    // Step 2: Run tests with dual reporters
    const junitPath = path.join(os.tmpdir(), 'kindlm-results.xml');
    const extraArgs = args.split(' ').filter(Boolean);

    const result = await exec.getExecOutput(
      'kindlm',
      ['test', '--config', config, '--reporter', 'json', '--reporter', 'junit', ...extraArgs],
      { ignoreReturnCode: true }
    );

    // Step 3: Parse JSON for counts (ACTION-08: only use summary/test names, not response_text)
    const report = JSON.parse(result.stdout);
    const { totalTests, passed, failed } = report.summary;
    const passRate = totalTests > 0 ? (passed / totalTests) * 100 : 0;

    // Step 4: Upload JUnit artifact
    const artifactClient = new DefaultArtifactClient();
    await artifactClient.uploadArtifact('kindlm-test-results', [junitPath], os.tmpdir());

    // Step 5: PR comment
    if (comment && github.context.eventName === 'pull_request') {
      await upsertPrComment(report, passed, failed, totalTests, passRate);
    }

    // Step 6: Cloud upload (non-fatal)
    if (cloudToken) {
      try {
        process.env.KINDLM_API_TOKEN = cloudToken;
        await exec.exec('kindlm', ['upload'], { ignoreReturnCode: true });
      } catch (err) {
        core.warning(`Cloud upload failed (non-fatal): ${err}`);
      }
    }

    // Step 7: Set outputs
    core.setOutput('pass-rate', passRate.toFixed(1));
    core.setOutput('total', String(totalTests));
    core.setOutput('passed', String(passed));
    core.setOutput('failed', String(failed));
    core.setOutput('exit-code', String(result.exitCode));

    // Propagate CLI exit code
    if (result.exitCode !== 0) {
      core.setFailed(`KindLM tests failed: ${failed}/${totalTests} tests failed`);
    }
  } catch (err) {
    core.setFailed(`Action failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

run();
```

### Action's Own CI Workflow (cross-platform matrix)
```yaml
# .github/workflows/test.yml
name: Test Action

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: git diff --exit-code dist/   # Fail if dist/ is stale
      - name: Test action against sample config
        uses: ./                            # Test the action itself
        with:
          config: test/fixtures/kindlm.yaml
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `runs.using: node16` | `runs.using: node20` | 2023 | node16 deprecated; use node20 |
| `@actions/artifact` v3 | `@actions/artifact` v6 with `DefaultArtifactClient` | Jan 2025 (v3 deprecated) | Breaking API change; v3 no longer available on GitHub.com |
| Committing `node_modules` | Bundle with `@vercel/ncc` → commit `dist/` only | ~2022 | Much smaller repo; faster checkout |
| Docker action | JS action (node20) | n/a | Docker fails on macOS/Windows runners |

**Deprecated/outdated:**
- `actions/artifact` v3: Deprecated April 2024, removed January 2025. Must use v4+.
- `runs.using: node16`: Deprecated. Use `node20`.
- `core.exportVariable()` for passing data between steps: Use `setOutput()` instead for typed outputs.

## Open Questions

1. **Does `kindlm test --reporter json --reporter junit` write JUnit to a file or stdout?**
   - What we know: The CLI supports `--reporter` flag. JSON goes to stdout. JUnit's `generate()` returns content string.
   - What's unclear: Whether there's a `--output` flag to write JUnit to a file path, or whether the CLI writes it to a `.kindlm/` directory automatically.
   - Recommendation: Read `packages/cli/src/commands/test.ts` in the implementation task to determine the exact file output flag. The planner should include a task to verify this.

2. **Does the JSON reporter output ONLY JSON to stdout, or does it mix with progress indicators?**
   - What we know: `json.ts` reporter returns clean JSON string. Pretty reporter uses chalk for terminal output.
   - What's unclear: Whether `--reporter json` completely suppresses all other stdout output (spinner, progress).
   - Recommendation: Implementation task should verify with a real run. If mixed, parse by extracting the JSON object from stdout.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | Action runtime | ✓ (GitHub-hosted runners) | 20.x | — |
| npm | CLI install | ✓ (bundled with Node.js) | 11.x | — |
| @kindlm/cli | Test execution | ✓ (installed by action) | user-specified | — |
| GITHUB_TOKEN | PR comments + artifact upload | ✓ (auto-provided in Actions) | — | Skip comment on 403 |

**Missing dependencies with no fallback:** None for GitHub-hosted runners.

**Missing dependencies with fallback:**
- PR comment write permission: Fails silently on fork PRs (403). Log warning, continue.

## Validation Architecture

`workflow.nyquist_validation` is not explicitly set to false in config.json — include validation section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | vitest.config.ts (to be created in Wave 0) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACTION-01 | Cross-platform: no platform-specific code | unit | `npx vitest run src/index.test.ts` | Wave 0 |
| ACTION-02 | Inputs read correctly with defaults | unit | `npx vitest run src/index.test.ts` | Wave 0 |
| ACTION-03 | Outputs set from parsed JSON | unit | `npx vitest run src/index.test.ts` | Wave 0 |
| ACTION-04 | JUnit artifact upload called | unit (mock) | `npx vitest run src/index.test.ts` | Wave 0 |
| ACTION-05 | PR comment upsert logic | unit (mock) | `npx vitest run src/comment.test.ts` | Wave 0 |
| ACTION-06 | Cloud upload non-fatal | unit (mock) | `npx vitest run src/index.test.ts` | Wave 0 |
| ACTION-07 | dist/index.js builds cleanly | build check | `npm run build && git diff --exit-code dist/` | Wave 0 |
| ACTION-08 | No response_text in comment body | unit | `npx vitest run src/comment.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green + `npm run build` clean before verification

### Wave 0 Gaps
- [ ] `src/index.test.ts` — covers ACTION-01, 02, 03, 04, 06
- [ ] `src/comment.test.ts` — covers ACTION-05, 08
- [ ] `vitest.config.ts` — Vitest config
- [ ] Framework install: `npm install --save-dev vitest` — new repo has no deps yet

## Sources

### Primary (HIGH confidence)
- npm registry — `@actions/core@3.0.0`, `@actions/exec@3.0.0`, `@actions/artifact@6.2.1`, `@actions/github@9.0.0`, `@vercel/ncc@0.38.4` (versions verified live)
- `packages/core/src/reporters/json.ts` — JSON output schema (read directly)
- `packages/core/src/reporters/junit.ts` — JUnit output format (read directly)
- `.github/workflows/ci.yml` — Cross-platform matrix pattern (read directly)

### Secondary (MEDIUM confidence)
- [GitHub Actions Metadata Syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax) — action.yml schema
- [Get started with v4 of GitHub Actions Artifacts](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/) — v4/v6 API changes
- [@actions/core npm page](https://www.npmjs.com/package/@actions/core) — v3 API surface
- [vercel/ncc GitHub](https://github.com/vercel/ncc) — bundler usage

### Tertiary (LOW confidence)
- WebSearch results on PR comment patterns — verified against Octokit REST docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry live
- Architecture: HIGH — patterns align with official GitHub Actions documentation
- Pitfalls: HIGH — several verified against GitHub changelog (artifact v3 deprecation confirmed)

**Research date:** 2026-04-03
**Valid until:** 2026-10-03 (stable ecosystem; toolkit versions move slowly)
