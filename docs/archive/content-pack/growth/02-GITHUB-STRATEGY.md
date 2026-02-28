# GitHub Growth Strategy — Beyond the README

## Overview

Most open-source projects stop at "star the repo." This playbook covers every GitHub-native growth lever: awesome-list submissions, Discussion templates, GitHub Actions marketplace, issue templates, social previews, and release strategy.

---

## 1. Awesome-List Submissions

Awesome lists are curated repositories with thousands of stars. Getting listed = sustained organic traffic.

### Target Lists (Priority Order)

| List | Stars | Category to Target | PR Template |
|------|-------|-------------------|-------------|
| [awesome-llm](https://github.com/Hannibal046/Awesome-LLM) | 20k+ | Evaluation & Testing | Under "LLM Evaluation" section |
| [awesome-ai-agents](https://github.com/e2b-dev/awesome-ai-agents) | 10k+ | Developer Tools | Under "Testing & Evaluation" |
| [awesome-generative-ai](https://github.com/steven2358/awesome-generative-ai) | 5k+ | Developer Tools | Under "Tools" section |
| [awesome-langchain](https://github.com/kyrolabs/awesome-langchain) | 7k+ | Testing | Under "Tools / Evaluation" |
| [awesome-prompt-engineering](https://github.com/promptslab/Awesome-Prompt-Engineering) | 3k+ | Evaluation | Under "Testing" section |
| [awesome-openai](https://github.com/chaunceyau/awesome-openai) | 1k+ | Testing | "Developer Tools" |
| [awesome-machine-learning](https://github.com/josephmisiti/awesome-machine-learning) | 65k+ | Testing & QA | Hard to get in but massive payoff |

### PR Template for Awesome-List Submissions

```markdown
## Add KindLM - Behavioral testing framework for AI agents

### What is KindLM?

KindLM is an open-source CLI tool for testing AI agent behavior through 
tool call assertions. Unlike existing eval tools that test text output 
quality, KindLM verifies that agents call the right tools, with the right 
arguments, in the right order.

### Why it belongs here

- First open-source tool focused specifically on agent tool-calling behavior
- MIT licensed, CLI-first, YAML configuration
- Supports OpenAI, Anthropic, Ollama providers
- Generates EU AI Act compliance documentation
- Active development, published npm package

### Link

- **[KindLM](https://github.com/kindlmann/kindlm)** - Behavioral testing 
  framework for AI agents. Test tool calls, argument validation, and 
  call sequences with YAML config. MIT license.
```

### Submission Strategy

1. **Week 1 (post-launch):** Submit to top 3 lists (awesome-llm, awesome-ai-agents, awesome-generative-ai)
2. **Week 2:** Submit to awesome-langchain, awesome-prompt-engineering
3. **Week 3:** Submit to broader lists (awesome-openai, awesome-machine-learning)
4. **Follow list contribution guidelines exactly** — read CONTRIBUTING.md
5. **Alphabetical placement** — don't put yourself first
6. **One-line description** — follow the format of existing entries
7. **If rejected:** ask why, improve, resubmit in 2 weeks

---

## 2. GitHub Discussions Setup

Discussions turn a repo from "download and leave" into a community.

### Enable Discussions

Repository → Settings → Features → ✅ Discussions

### Category Configuration

Create these categories:

| Category | Icon | Format | Purpose |
|----------|------|--------|---------|
| 📣 Announcements | Megaphone | Announcement | Releases, breaking changes (maintainer only) |
| 🎧 Show Your Config | Speech | Open | Users share their YAML configs |
| 💡 Feature Requests | Lightbulb | Open | Community-driven roadmap input |
| ❓ Q&A | Question | Question/Answer | Support (mark answers) |
| 🧪 Test Results | Beaker | Open | Users share interesting test findings |
| 📚 Guides & Tips | Book | Open | Community tutorials |

### Seed Discussions (Create Before Launch)

#### Discussion 1: "Show Your Config"

```markdown
# 🎧 Show Your KindLM Config

Share your `kindlm.yaml` configuration! Whether you're testing a simple 
chatbot or a complex multi-agent system, we want to see how you're using 
KindLM.

**Template:**

**Agent type:** (e.g., customer support, code review, RAG)
**Provider:** (e.g., openai:gpt-4o, anthropic:claude-sonnet-4-20250514)
**Number of tests:** 
**Most useful assertion type:**

```yaml
# Paste your config here
```

**What surprised you?** (optional)

---

I'll start! Here's a config for testing an order support agent:
[paste example config]
```

#### Discussion 2: "What Agent Are You Testing?"

```markdown
# 🧪 What Agent Are You Testing?

We're curious — what kind of AI agents are you building and testing? 
This helps us prioritize features and examples.

Drop a comment with:
- What your agent does
- What provider you're using
- What assertion types matter most to you
- Any testing challenges you've hit
```

#### Discussion 3: "Feature Requests — What's Missing?"

```markdown
# 💡 What Assertion Type Do You Need?

KindLM currently supports 11 assertion types. What's missing for your use case?

Current assertions:
- tool_called, tool_not_called, tool_order
- contains, not_contains, json_schema
- no_pii, keywords_absent
- judge, latency, cost

**What would you add?** Describe the assertion and your use case.
```

---

## 3. GitHub Actions Marketplace

Publishing a GitHub Action means users find KindLM when searching the Actions Marketplace for "AI testing," "agent testing," "LLM evaluation."

### Action: `kindlm/test-action`

Create a separate repo: `kindlm/test-action`

#### `action.yml`

```yaml
name: 'KindLM Agent Test'
description: 'Run behavioral tests for AI agents in CI/CD. Test tool calls, arguments, and sequences.'
author: 'kindlmann'

branding:
  icon: 'check-circle'
  color: 'blue'

inputs:
  config:
    description: 'Path to kindlm.yaml config file'
    required: false
    default: 'kindlm.yaml'
  provider-key:
    description: 'API key for the LLM provider (use secrets)'
    required: true
  runs:
    description: 'Number of test runs for consistency checking'
    required: false
    default: '3'
  fail-on-error:
    description: 'Fail the workflow if any test fails'
    required: false
    default: 'true'
  output-format:
    description: 'Output format: terminal, json, or junit'
    required: false
    default: 'terminal'
  compliance-report:
    description: 'Generate EU AI Act compliance report'
    required: false
    default: 'false'

outputs:
  passed:
    description: 'Number of passed tests'
  failed:
    description: 'Number of failed tests'
  total:
    description: 'Total number of tests'
  report-path:
    description: 'Path to compliance report (if generated)'

runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install KindLM
      shell: bash
      run: npm install -g @kindlm/cli
    
    - name: Run Tests
      shell: bash
      env:
        OPENAI_API_KEY: ${{ inputs.provider-key }}
        ANTHROPIC_API_KEY: ${{ inputs.provider-key }}
      run: |
        kindlm test \
          --config ${{ inputs.config }} \
          --runs ${{ inputs.runs }} \
          --format ${{ inputs.output-format }} \
          ${{ inputs.compliance-report == 'true' && '--compliance' || '' }} \
          ${{ inputs.fail-on-error == 'true' && '--fail-on-error' || '' }}
    
    - name: Upload Compliance Report
      if: inputs.compliance-report == 'true'
      uses: actions/upload-artifact@v4
      with:
        name: kindlm-compliance-report
        path: ./kindlm-report-*.json
```

#### `README.md` for the Action

```markdown
# KindLM Test Action

Run behavioral tests for AI agents in your CI/CD pipeline. 
Verify tool calls, argument validation, and call sequences.

## Quick Start

```yaml
# .github/workflows/agent-tests.yml
name: Agent Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: kindlm/test-action@v1
        with:
          config: kindlm.yaml
          provider-key: ${{ secrets.OPENAI_API_KEY }}
```

## With Compliance Report

```yaml
      - uses: kindlm/test-action@v1
        with:
          config: kindlm.yaml
          provider-key: ${{ secrets.OPENAI_API_KEY }}
          compliance-report: true
          runs: 5
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `config` | No | `kindlm.yaml` | Path to config |
| `provider-key` | Yes | — | LLM API key |
| `runs` | No | `3` | Consistency runs |
| `fail-on-error` | No | `true` | Fail CI on test failure |
| `compliance-report` | No | `false` | Generate EU AI Act report |
```

### Marketplace Keywords

When publishing, use these search terms:
- ai-testing
- llm-evaluation  
- agent-testing
- ai-agent
- tool-call
- prompt-testing
- eu-ai-act
- compliance

---

## 4. Issue Templates

Create `.github/ISSUE_TEMPLATE/` directory:

### `bug_report.yml`

```yaml
name: 🐛 Bug Report
description: Report a bug in KindLM
title: "[Bug]: "
labels: ["bug", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting! Please fill out the form below.
  
  - type: input
    id: version
    attributes:
      label: KindLM Version
      description: Run `kindlm --version`
      placeholder: "0.1.0"
    validations:
      required: true
  
  - type: dropdown
    id: provider
    attributes:
      label: Provider
      options:
        - openai:gpt-4o
        - openai:gpt-4o-mini
        - anthropic:claude-sonnet-4-20250514
        - anthropic:claude-haiku
        - ollama (specify model below)
        - other
    validations:
      required: true
  
  - type: textarea
    id: config
    attributes:
      label: Config (kindlm.yaml)
      description: Paste your config (redact API keys)
      render: yaml
    validations:
      required: true
  
  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
    validations:
      required: true
  
  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
    validations:
      required: true
  
  - type: textarea
    id: logs
    attributes:
      label: Error Output
      render: shell
```

### `feature_request.yml`

```yaml
name: 💡 Feature Request
description: Suggest a new feature
title: "[Feature]: "
labels: ["enhancement"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What problem does this solve?
    validations:
      required: true
  
  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
      description: How should this work?
    validations:
      required: true
  
  - type: dropdown
    id: category
    attributes:
      label: Category
      options:
        - New assertion type
        - New provider
        - CLI improvement
        - Config syntax
        - Compliance / reporting
        - Performance
        - Documentation
        - Other
    validations:
      required: true
  
  - type: textarea
    id: yaml
    attributes:
      label: Example Config (optional)
      description: What would the YAML look like?
      render: yaml
```

### `config_help.yml`

```yaml
name: ❓ Config Help
description: Need help writing your kindlm.yaml?
title: "[Help]: "
labels: ["question", "config"]
body:
  - type: textarea
    id: agent
    attributes:
      label: Describe Your Agent
      description: What does your agent do? What tools does it use?
    validations:
      required: true
  
  - type: textarea
    id: config
    attributes:
      label: Current Config (if any)
      render: yaml
  
  - type: textarea
    id: goal
    attributes:
      label: What are you trying to test?
    validations:
      required: true
```

---

## 5. Social Preview & Repository Settings

### Repository Description
```
Behavioral testing framework for AI agents. Test tool calls, arguments, and 
sequences — not just text output. YAML config, CLI-first, EU AI Act compliance. MIT.
```

### Repository Topics (Tags)
```
ai-testing, ai-agents, llm-evaluation, tool-calling, prompt-testing, 
testing-framework, eu-ai-act, compliance, typescript, cli, yaml, 
openai, anthropic, ollama, behavioral-testing
```

### Social Preview Image

Create a 1280×640 image with:
- KindLM logo (left)
- Terminal screenshot showing green/red test output (right)
- Tagline: "Test what your AI agents DO, not just what they SAY"
- Dark background (#080c18)

### Pin These Files

Ensure these are in the root:
- `README.md` — with badges, quick start, animated GIF
- `CONTRIBUTING.md` — how to contribute
- `LICENSE` — MIT
- `CODE_OF_CONDUCT.md` — Contributor Covenant
- `SECURITY.md` — responsible disclosure
- `CHANGELOG.md` — keep updated per release

### README Badges

```markdown
[![npm version](https://img.shields.io/npm/v/@kindlm/cli)](https://www.npmjs.com/package/@kindlm/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/kindlmann/kindlm/actions/workflows/ci.yml/badge.svg)](https://github.com/kindlmann/kindlm/actions)
[![Discord](https://img.shields.io/discord/XXXXXX?label=Discord&logo=discord)](https://discord.gg/kindlm)
[![GitHub stars](https://img.shields.io/github/stars/kindlmann/kindlm?style=social)](https://github.com/kindlmann/kindlm)
```

---

## 6. Release Strategy

### Semantic Versioning

- `v0.1.0` — Initial public release (launch day)
- `v0.1.x` — Bug fixes from early users
- `v0.2.0` — First feature release (based on community feedback)
- `v1.0.0` — Stable API (after 500+ stars, 50+ users)

### Release Notes Template

```markdown
## 🚀 KindLM v0.2.0

### What's New

**🎯 New Assertion: `response_time`**
Test that your agent responds within a time budget:
```yaml
- type: response_time
  max_ms: 3000
```

**🔌 Ollama Provider Improvements**
- Auto-detect running Ollama models
- Support for custom model endpoints

### Bug Fixes
- Fixed YAML parsing for nested tool arguments (#42)
- Improved error messages for missing API keys (#38)

### Breaking Changes
None in this release.

### Migration Guide
No changes needed. Update with: `npm update -g @kindlm/cli`

---

**Full Changelog:** v0.1.3...v0.2.0
**NPM:** `npm install -g @kindlm/cli@0.2.0`
```

### GitHub Releases

- Tag every release
- Include the YAML example showing the new feature
- Attach compliance report JSON schema if changed
- Use GitHub's auto-generated release notes + manual highlights

---

## 7. GitHub Sponsors

Set up GitHub Sponsors (even at launch — signals commitment):

### Tiers

| Tier | Amount | Reward |
|------|--------|--------|
| ☕ Supporter | $5/mo | Name in SPONSORS.md |
| 🧪 Tester | $15/mo | Early access to new assertions, Discord role |
| 🏢 Team | $49/mo | Priority issue support, config review |
| 🏛️ Enterprise | $299/mo | Dedicated support channel, compliance consulting |

The Team and Enterprise tiers naturally map to the paid product tiers.

---

## 8. Community Health Files

### `CONTRIBUTING.md` Key Sections

```markdown
## How to Contribute

### Report a Bug
Use the [bug report template](link) — include your config and KindLM version.

### Suggest a Feature  
Use the [feature request template](link) — show us the YAML you wish existed.

### Submit a PR
1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Write tests for your changes
4. Run `npm test` and `npm run lint`
5. Submit a PR with a clear description

### Add a Provider
See [Provider Interface docs](docs/PROVIDER_INTERFACE.md) for the adapter pattern.

### Add an Assertion Type
See [Assertion Engine docs](docs/ASSERTION_ENGINE.md) for the plugin architecture.

### Share Your Config
Post in [Discussions → Show Your Config](link)!
```

---

## Timeline

| When | Action |
|------|--------|
| **Pre-launch** | Set up Discussions, issue templates, social preview, badges |
| **Launch day** | First release (v0.1.0), publish GitHub Action |
| **Day 2-3** | Submit to top 3 awesome lists |
| **Week 1** | Seed Discussions with examples, respond to all issues within 24h |
| **Week 2-3** | Submit to remaining awesome lists |
| **Week 4** | First patch release based on user feedback |
| **Ongoing** | Respond to issues/discussions within 48h, release weekly |
