# EU AI Act Compliance for AI Developers: A Practical Guide

*What Annex IV requires, when enforcement starts, and what you can do today to prepare — without hiring a compliance team.*

---

The EU AI Act is the first comprehensive AI regulation in any major jurisdiction. If you're building AI-powered products that serve European users — or if your company operates in the EU — this affects you. Not eventually. Soon.

This guide is written for developers and technical leads, not lawyers. We'll cover what the regulation actually requires in practical terms, which provisions apply to different types of AI systems, what timeline you're working with, and what concrete steps you can take now to prepare. We'll also show how automated testing with KindLM can generate most of the documentation you need.

This is not legal advice. Consult qualified legal counsel for your specific situation. But understanding the technical requirements is your job, and that's what this guide is for.

## What the EU AI Act Actually Says

The AI Act creates a risk-based classification system for AI systems. The rules you need to follow depend on which risk category your system falls into.

### Risk Categories

**Unacceptable Risk (Banned):** Social scoring by governments, real-time biometric surveillance in public spaces (with narrow exceptions), manipulation of vulnerable groups. If your AI agent does any of these things, stop reading and stop building.

**High Risk:** AI systems used in critical infrastructure, education, employment, essential services, law enforcement, migration, and justice. This is the category with the heaviest compliance requirements, including mandatory conformity assessments, risk management systems, and detailed technical documentation.

**Limited Risk:** AI systems that interact with people (chatbots, deepfake generators). These have transparency obligations — users must know they're interacting with AI — but lighter documentation requirements.

**Minimal Risk:** Everything else. Spam filters, recommendation engines, most business automation. Voluntary codes of conduct encouraged but not mandated.

### Where Do AI Agents Fall?

Most AI agents in production today fall into the **limited risk** or **high risk** categories depending on their domain:

- **Customer service agent for an e-commerce site:** Limited risk. Transparency obligations apply. Documentation is recommended.
- **Agent that processes insurance claims:** High risk (essential services). Full compliance required.
- **HR screening agent:** High risk (employment). Full compliance required.
- **Medical intake agent:** High risk (healthcare). Full compliance required.
- **Financial advisory agent:** High risk (essential services). Full compliance required.
- **Internal productivity agent:** Likely minimal risk, unless it influences decisions about people.

The classification depends on the *use case*, not the technology. The same GPT-4o-powered agent could be minimal risk as an internal FAQ bot and high risk as a loan approval assistant.

## What Annex IV Requires

Annex IV is the section that keeps technical teams up at night. It specifies the technical documentation required for high-risk AI systems. Here's what it covers, translated from regulatory language into developer terms.

### 1. General Description of the AI System

What it does, who it's for, what hardware/software it runs on, and what versions have been deployed. For AI agents, this means documenting:

- The agent's purpose and scope of operation
- Which LLM providers and model versions it uses
- What tools/functions the agent can call
- What data the agent processes
- Deployment environment (cloud provider, runtime, etc.)

### 2. Detailed Description of Development Process

How the system was designed, built, and validated. This includes:

- Design choices and trade-offs
- System architecture
- Training data (if applicable — for most agent builders using commercial LLMs, this applies to the fine-tuning data or few-shot examples you provide)
- Development methodology

### 3. Monitoring, Functioning, and Control

How the system is monitored in production and what controls exist:

- Logging and observability
- Human oversight mechanisms
- Override and shutdown procedures
- Performance monitoring

### 4. Risk Management

Documented analysis of risks and mitigations:

- Known risks and failure modes
- Mitigation measures for each risk
- Residual risk assessment
- Safety guardrails and their testing

### 5. Testing and Validation

This is the section most relevant to developers. Annex IV requires:

- **Testing methodologies used** — What types of tests you run and why
- **Testing metrics and results** — Quantitative evidence of system performance
- **Robustness testing** — How the system performs under adversarial or edge-case inputs
- **Bias and fairness testing** — Evidence that the system doesn't discriminate
- **Performance benchmarks** — Baseline measurements with statistical significance

### 6. Post-Market Monitoring

Ongoing monitoring plan after deployment:

- How you detect performance degradation
- Incident response procedures
- Update and retraining policies

## Timeline: What's Happening When

Here's the enforcement timeline that matters:

- **August 2024:** AI Act entered into force
- **February 2025:** Prohibitions on unacceptable-risk AI took effect
- **August 2025:** Rules for general-purpose AI models took effect
- **August 2026:** Full enforcement for high-risk systems, including Annex IV documentation requirements
- **August 2027:** Rules for high-risk AI systems that are also regulated products (medical devices, etc.)

**August 2026 is the critical date for most AI agent developers.** That's when regulators can request your Annex IV documentation and penalize non-compliance.

Penalties scale with company size: up to 35 million EUR or 7% of global annual turnover for the most serious violations. For high-risk documentation failures, the ceiling is 15 million EUR or 3% of turnover.

## What You Should Do Now

You have until August 2026. That sounds like a lot of time until you realize that building compliance documentation retroactively — reconstructing what you tested, when, and why — is vastly harder than generating it as you go.

Here's a practical action plan organized by effort level.

### Immediate (This Week)

**Classify your AI systems.** Go through every AI-powered product or feature your organization ships. Determine which risk category each falls into. Document this classification and the reasoning behind it. This takes an afternoon and gives you a clear picture of your compliance surface area.

**Start testing behavioral properties.** If you're not already testing what your agents *do* (tool calls, decisions, safety guardrails), start now. Every test you write today is compliance documentation you won't have to create later.

```bash
npm i -g @kindlm/cli
kindlm init
```

### Short-Term (This Month)

**Write test suites for critical agents.** Focus on your highest-risk agents first. For each one, write tests that cover:

- Correct tool calling behavior (does the agent take the right actions?)
- Safety guardrails (does the agent refuse inappropriate requests?)
- PII handling (does the agent avoid exposing sensitive data?)
- Output correctness (does structured output match expected schemas?)

```yaml
version: "1"
defaults:
  provider: openai:gpt-4o
  temperature: 0
  runs: 5

suites:
  - name: "claims-processing-agent"
    system_prompt_file: ./prompts/claims.md
    tests:
      - name: "verify-before-approve"
        input: "Process claim #CLM-2024-001"
        assert:
          - type: tool_called
            value: verify_claim
          - type: tool_order
            value: [verify_claim, check_policy, approve_claim]
          - type: no_pii
          - type: schema
            value:
              type: object
              required: [claim_id, status, amount]

      - name: "reject-fraudulent-claim"
        input: "I had an accident yesterday [suspicious details]"
        assert:
          - type: tool_called
            value: flag_for_review
          - type: tool_not_called
            value: approve_claim
          - type: keywords_present
            value: ["review", "verification"]
```

**Integrate tests into CI.** Every test run in CI produces timestamped, versioned evidence of testing. This is exactly what Annex IV requires.

```bash
# In your CI pipeline
kindlm test --compliance --reporter junit --gate 95
```

### Medium-Term (This Quarter)

**Generate compliance reports regularly.** KindLM's `--compliance` flag generates structured documentation that maps your test results to Annex IV requirements:

```bash
kindlm test --compliance
```

The output includes:

- System description (derived from your config)
- Testing methodology (assertion types used and their purpose)
- Test results with statistical analysis (pass rates, confidence intervals across multiple runs)
- Risk mitigation evidence (safety guardrail tests, PII checks)
- SHA-256 hash for tamper evidence
- Timestamp and version information

**Document your risk management process.** Write down:

- What risks your agents pose (incorrect actions, data exposure, bias)
- What mitigations you've implemented (guardrails, human oversight, testing)
- What residual risks remain
- How you monitor for new risks

This doesn't need to be a 100-page report. A clear, honest document that maps risks to mitigations is what regulators want to see.

**Establish baseline measurements.** Use KindLM's baseline feature to capture your agent's current behavior:

```bash
kindlm baseline set
```

Then compare against baselines regularly:

```bash
kindlm baseline compare
```

This gives you documented evidence of behavioral stability over time — or early warning when behavior drifts.

### Long-Term (Before August 2026)

**Build a compliance documentation pipeline.** Compliance shouldn't be a one-time effort. It should be a continuous output of your development process:

1. Developers write behavioral tests as part of feature development
2. CI runs tests on every commit, generating compliance data
3. Compliance reports are generated and stored with each release
4. Baselines track behavioral stability across versions
5. Drift detection alerts on unexpected behavioral changes

**Consider team tooling.** For organizations with multiple agents and multiple teams, centralized test history, shared baselines, and role-based access to compliance reports become important. This is where KindLM Cloud adds value — not for the testing itself (the CLI handles that), but for the organizational layer around it.

## What Good Compliance Looks Like

Regulators aren't looking for perfection. They're looking for evidence of a systematic, good-faith effort to ensure your AI systems work correctly and safely.

Good compliance documentation shows:

1. **You know what your system does.** Clear description of purpose, capabilities, and limitations.
2. **You test systematically.** Automated tests that cover behavioral correctness, safety, and edge cases.
3. **You measure quantitatively.** Pass rates, scores, and statistical analysis — not just "it seems to work fine."
4. **You track changes.** Version-controlled tests with timestamped results that show behavior over time.
5. **You respond to failures.** Evidence that when tests fail, you investigate and fix the issue.

This is what good engineering teams already do. The AI Act formalizes it and makes documentation mandatory for high-risk systems. If you're already testing rigorously, compliance is largely a documentation exercise. If you're not testing, compliance is a wake-up call to start.

## Common Misconceptions

**"The AI Act only applies to companies based in the EU."**
No. It applies to any AI system placed on the EU market or whose output is used in the EU. If you have European users, it likely applies to you.

**"We use a third-party LLM, so the provider is responsible for compliance."**
Partially. The model provider has obligations under the general-purpose AI rules. But if you build an application on top of that model and deploy it as a high-risk system, you're the deployer and you have your own compliance obligations. The provider's compliance doesn't exempt you.

**"Our agents are low risk, so we don't need to do anything."**
Even minimal-risk systems benefit from behavioral testing and documentation. Regulatory classifications can change. Your agents' use cases can expand. Starting with good practices now is much easier than retrofitting them later.

**"We need to wait for implementing regulations to know what's required."**
The core requirements in Annex IV are clear enough to act on today. Implementing regulations will add specificity, but the fundamental requirement — documented testing evidence for high-risk systems — is not going to change.

## Getting Started Today

The simplest step you can take right now is to install KindLM and write your first behavioral test:

```bash
npm i -g @kindlm/cli
kindlm init
# Edit kindlm.yaml with your agent's tests
kindlm test --compliance
```

Every test you run generates evidence. Every compliance report you generate is documentation you won't need to create from scratch in 2026. The best time to start was when the AI Act was published. The second best time is today.

---

*KindLM is open source at [github.com/kindlm/kindlm](https://github.com/kindlm/kindlm). The CLI and all testing features are free under the MIT license. Compliance report generation is included.*
