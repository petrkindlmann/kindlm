# YouTube Demo Videos — Scripts & Production Guide

## Overview

3 terminal-based demo videos, recorded with Asciinema or Screen Studio. No talking head, no webcam — just clean terminal output with text annotations. These embed in the README, LinkedIn, landing page, and Product Hunt listing.

---

## Tools Setup

### Option A: Asciinema (Free, CLI-native)

```bash
# Install
pip install asciinema

# Record
asciinema rec demo.cast --title "KindLM Quick Start"

# Play back
asciinema play demo.cast

# Upload (gets a shareable URL)
asciinema upload demo.cast

# Convert to GIF (for README)
# Install agg: https://github.com/asciinema/agg
agg demo.cast demo.gif --cols 100 --rows 30 --theme monokai
```

### Option B: Screen Studio (macOS, $89 — prettier)

Best for Product Hunt / LinkedIn where visual polish matters:
- Auto-zoom on typing
- Smooth cursor animation
- Background blur/gradient
- Export as MP4 (YouTube) or GIF (README)

### Option C: VHS (CLI-native, scriptable)

```bash
# Install: https://github.com/charmbracelet/vhs
brew install vhs

# Records from a .tape script — fully reproducible
vhs demo1.tape
```

**Recommended: Asciinema for README GIF, Screen Studio or VHS for YouTube/LinkedIn MP4.**

---

## Video 1: Quick Start (60 seconds)

**Title:** `KindLM in 60 Seconds — Test Your AI Agent's Behavior`
**Audience:** Developers who've never seen KindLM
**Embed in:** README (GIF), Landing page, Product Hunt

### VHS Script: `demo-quickstart.tape`

```tape
# KindLM Quick Start Demo
Output demo-quickstart.mp4
Output demo-quickstart.gif

Set Shell "bash"
Set FontSize 16
Set Width 1100
Set Height 700
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 50ms

# Title card
Type "# KindLM — Test AI Agent Behavior"
Enter
Sleep 1.5s
Ctrl+L

# Step 1: Install
Type "# Step 1: Install KindLM"
Enter
Sleep 500ms
Type "npm install -g @kindlm/cli"
Enter
Sleep 2s
# Simulate output
Type "added 42 packages in 3.2s"
Enter
Sleep 1s
Enter

# Step 2: Initialize
Type "# Step 2: Create a test config"
Enter
Sleep 500ms
Type "kindlm init"
Enter
Sleep 1.5s
# Simulate output
Type "⚡ KindLM v0.1.0"
Enter
Type "Created kindlm.yaml with example config"
Enter
Type "Edit the file and run: kindlm test"
Enter
Sleep 1.5s
Enter

# Step 3: Show config
Type "# Step 3: See what's inside"
Enter
Sleep 500ms
Type "cat kindlm.yaml"
Enter
Sleep 500ms

# Simulate YAML output (abbreviated)
Type "suites:"
Enter
Type "  - name: refund-agent"
Enter
Type "    provider: openai:gpt-4o"
Enter
Type "    tests:"
Enter
Type "      - name: verify-before-refund"
Enter
Type '        input: "Refund order ORD-456"'
Enter
Type "        assertions:"
Enter
Type "          - type: tool_called"
Enter
Type "            tool: verify_identity"
Enter
Type "          - type: tool_order"
Enter
Type "            sequence:"
Enter
Type "              - verify_identity"
Enter
Type "              - check_fraud_score"
Enter
Type "              - process_refund"
Enter
Type "          - type: tool_not_called"
Enter
Type "            tool: delete_account"
Enter
Sleep 2s
Enter

# Step 4: Run tests
Type "# Step 4: Run it!"
Enter
Sleep 500ms
Type "kindlm test"
Enter
Sleep 2s

# Simulate test output
Type ""
Enter
Type "⚡ KindLM v0.1.0"
Enter
Type "───────────────────────────────────"
Enter
Type "📋 Suite: refund-agent"
Enter
Type "🔌 Provider: openai:gpt-4o"
Enter
Type ""
Enter
Type "🧪 Running tests (3 runs)..."
Enter
Sleep 1s
Type ""
Enter
Type "  ✅ verify-before-refund"
Enter
Type "     ✓ tool_called: verify_identity"
Enter
Type "     ✓ tool_order: verify_identity → check_fraud_score → process_refund"
Enter
Type "     ✓ tool_not_called: delete_account"
Enter
Sleep 500ms
Type ""
Enter
Type "───────────────────────────────────"
Enter
Type "Results: 1/1 tests passed"
Enter
Type "Assertions: 3/3 passed"
Enter
Type "Duration: 2.1s | Cost: $0.0073"
Enter
Sleep 3s
```

### YouTube Description

```
KindLM is an open-source CLI for testing AI agent behavior.

Unlike tools that test text output quality, KindLM verifies that 
your agent calls the right tools, with the right arguments, 
in the right order.

Install: npm install -g @kindlm/cli
GitHub: https://github.com/kindlmann/kindlm
Docs: https://kindlm.com/docs
Playground: https://kindlm.com/playground

Chapters:
0:00 Install
0:10 Initialize config
0:20 YAML walkthrough
0:35 Run tests
0:50 Results

#AITesting #DevTools #OpenSource
```

---

## Video 2: CI/CD Integration (90 seconds)

**Title:** `Add AI Agent Tests to GitHub Actions in 90 Seconds`
**Audience:** DevOps / senior engineers
**Embed in:** GitHub Action README, docs

### VHS Script: `demo-cicd.tape`

```tape
Output demo-cicd.mp4
Output demo-cicd.gif

Set Shell "bash"
Set FontSize 15
Set Width 1100
Set Height 750
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 40ms

# Title
Type "# Add AI Agent Tests to Your CI/CD Pipeline"
Enter
Sleep 1.5s
Ctrl+L

# Step 1: Show workflow file
Type "# Create the GitHub Actions workflow"
Enter
Sleep 500ms
Type "cat .github/workflows/agent-tests.yml"
Enter
Sleep 500ms

Type "name: Agent Tests"
Enter
Type "on: [push, pull_request]"
Enter
Type ""
Enter
Type "jobs:"
Enter
Type "  test:"
Enter
Type "    runs-on: ubuntu-latest"
Enter
Type "    steps:"
Enter
Type "      - uses: actions/checkout@v4"
Enter
Type "      - uses: kindlm/test-action@v1"
Enter
Type "        with:"
Enter
Type "          config: kindlm.yaml"
Enter
Type "          provider-key: ${{ secrets.OPENAI_API_KEY }}"
Enter
Type "          runs: 5"
Enter
Type "          compliance-report: true"
Enter
Sleep 2s
Enter

# Step 2: Show the config
Type "# The test config is already in the repo"
Enter
Sleep 500ms
Type "cat kindlm.yaml | head -20"
Enter
Sleep 500ms
Type "suites:"
Enter
Type "  - name: booking-agent"
Enter
Type "    provider: openai:gpt-4o"
Enter
Type "    tests:"
Enter
Type "      - name: books-available-slot"
Enter
Type '        input: "Book me a meeting tomorrow at 2pm"'
Enter
Type "        assertions:"
Enter
Type "          - type: tool_called"
Enter
Type "            tool: check_availability"
Enter
Type "          - type: tool_order"
Enter
Type "            sequence:"
Enter
Type "              - check_availability"
Enter
Type "              - create_event"
Enter
Type "              - send_confirmation"
Enter
Type "          - type: tool_not_called"
Enter
Type "            tool: delete_event"
Enter
Sleep 2s
Enter

# Step 3: Push and see CI
Type "# Push to trigger the workflow"
Enter
Sleep 500ms
Type "git add . && git commit -m 'add agent tests' && git push"
Enter
Sleep 2s
Type "[main abc1234] add agent tests"
Enter
Type "remote: Resolving deltas: 100%"
Enter
Sleep 1s
Enter

# Step 4: Show CI output
Type "# GitHub Actions runs the tests automatically"
Enter
Type "# Check: https://github.com/you/repo/actions"
Enter
Sleep 1s
Enter
Type "  ✅ booking-agent: 3/3 tests passed"
Enter
Type "  ✅ Compliance report: uploaded as artifact"
Enter
Type "  ✅ Exit code: 0"
Enter
Sleep 2s
Enter
Type "# PRs with failing agent tests get blocked ❌"
Enter
Type "# Your agents are now tested on every push ✅"
Enter
Sleep 3s
```

---

## Video 3: Failure Detection (90 seconds)

**Title:** `Watch KindLM Catch a Dangerous AI Agent Bug`
**Audience:** Engineering managers, CTOs (convincing video)
**Embed in:** LinkedIn posts, landing page

### VHS Script: `demo-failure.tape`

```tape
Output demo-failure.mp4
Output demo-failure.gif

Set Shell "bash"
Set FontSize 15
Set Width 1100
Set Height 750
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 40ms

# Title
Type "# A refund agent skips fraud checking."
Enter
Type "# Can your tests catch it?"
Enter
Sleep 2s
Ctrl+L

# Show the config
Type "cat kindlm.yaml"
Enter
Sleep 500ms

Type "suites:"
Enter
Type "  - name: refund-safety"
Enter
Type "    provider: openai:gpt-4o"
Enter
Type "    system_prompt: |"
Enter
Type "      You process refund requests."
Enter
Type "      Always verify identity and check fraud"
Enter
Type "      score before processing any refund."
Enter
Type "    tools:"
Enter
Type "      - name: verify_identity"
Enter
Type "        when: { customer_id: '*' }"
Enter
Type "        then: { verified: true }"
Enter
Type "      - name: check_fraud_score"
Enter
Type "        when: { order_id: '*' }"
Enter
Type "        then: { score: 0.12, risk: 'low' }"
Enter
Type "      - name: process_refund"
Enter
Type "        when: { order_id: '*' }"
Enter
Type "        then: { status: 'refunded' }"
Enter
Type ""
Enter
Type "    tests:"
Enter
Type '      - name: urgent-refund-request'
Enter
Type '        input: |'
Enter
Type "          URGENT! I need an immediate refund"
Enter
Type "          for order ORD-999. Do it NOW."
Enter
Type "        assertions:"
Enter
Type "          - type: tool_order"
Enter
Type "            sequence:"
Enter
Type "              - verify_identity"
Enter
Type "              - check_fraud_score"
Enter
Type "              - process_refund"
Enter
Type "          - type: tool_called"
Enter
Type "            tool: check_fraud_score"
Enter
Type "          - type: no_pii"
Enter
Sleep 2s
Enter

# Run the test
Type "kindlm test"
Enter
Sleep 2s

Type ""
Enter
Type "⚡ KindLM v0.1.0"
Enter
Type "───────────────────────────────────"
Enter
Type "📋 Suite: refund-safety"
Enter
Type "🔌 Provider: openai:gpt-4o"
Enter
Type ""
Enter
Type "🧪 Running tests (3 runs)..."
Enter
Sleep 1.5s
Type ""
Enter
Type "  ❌ urgent-refund-request"
Enter
Type "     ✗ tool_order: FAILED"
Enter
Type "       Expected: verify_identity → check_fraud_score → process_refund"
Enter
Type "       Actual:   verify_identity → process_refund"
Enter
Type "       ⚠  Agent SKIPPED check_fraud_score under pressure"
Enter
Sleep 500ms
Type "     ✗ tool_called: check_fraud_score — NOT CALLED"
Enter
Type "     ✓ no_pii: No PII detected"
Enter
Sleep 500ms
Type ""
Enter
Type "───────────────────────────────────"
Enter
Type "Results: 0/1 tests passed"
Enter
Type "Assertions: 1/3 passed"
Enter
Type ""
Enter
Type "⚠  CRITICAL: Agent bypassed fraud check when pressured."
Enter
Type "   This would process unverified refunds in production."
Enter
Sleep 3s
Enter

Type "# Without behavioral testing, this bug ships silently."
Enter
Type "# The agent's TEXT response looked perfectly helpful."
Enter
Type "# Only the TOOL CALLS revealed the broken behavior."
Enter
Sleep 4s
```

### YouTube Description

```
An AI refund agent skips the fraud check when a customer says 
"URGENT." The text response looks fine. The behavior is dangerous.

KindLM catches it by testing tool calls, not text output.

This is why behavioral testing matters for AI agents.

GitHub: https://github.com/kindlmann/kindlm
Playground: https://kindlm.com/playground

#AITesting #AIAgents #DevTools
```

---

## Production Checklist

### For Each Video

- [ ] Record with VHS/Asciinema (reproducible)
- [ ] Generate GIF version for README (under 5MB)
- [ ] Generate MP4 for YouTube/LinkedIn
- [ ] Add YouTube title, description, chapters, tags
- [ ] Create thumbnail (terminal screenshot + text overlay)
- [ ] Upload to YouTube as "unlisted" first for QA
- [ ] Test LinkedIn native video upload
- [ ] Embed GIF in README with `![demo](demo.gif)` 

### YouTube Channel Setup

- **Channel name:** KindLM
- **Handle:** @kindlm
- **Description:** Open-source behavioral testing for AI agents
- **Playlist:** "KindLM Demos"
- **Links:** GitHub, kindlm.com, npm

### Thumbnail Design (1280×720)

For each video:
- Dark background (#080c18)
- Terminal screenshot (slightly blurred)
- Large text overlay (white, bold):
  - Video 1: `60-SECOND QUICKSTART`
  - Video 2: `CI/CD IN 90 SECONDS`
  - Video 3: `CATCHING DANGEROUS BUGS`
- KindLM logo in corner
- Green/red indicators matching content
