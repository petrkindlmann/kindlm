# EU AI Act Annex IV: What Technical Documentation You Need

*A developer-focused breakdown of every documentation requirement in Annex IV, with practical guidance on what to build.*

---

Annex IV of the EU AI Act specifies the technical documentation required for high-risk AI systems. It's the section that translates regulatory intent into concrete engineering requirements. If you're building AI agents that fall into the high-risk category — insurance processing, hiring, healthcare, financial services, critical infrastructure — this is your compliance checklist.

This article translates Annex IV from regulatory language into developer terms. For each requirement, we explain what it means in practice, what evidence you need to produce, and how automated behavioral testing can generate most of it.

## Who Needs Annex IV Documentation

Annex IV applies to providers and deployers of high-risk AI systems. The classification is based on use case, not technology:

- AI that influences employment decisions (hiring, performance evaluation, termination)
- AI used in educational institutions (admissions, grading, proctoring)
- AI in essential services (insurance, banking, credit scoring)
- AI in law enforcement, migration management, or judicial processes
- AI used in critical infrastructure (energy, transport, water)
- AI in healthcare (diagnosis support, treatment recommendations, triage)

If your AI agent operates in any of these domains — even if it only assists human decision-makers — you likely need Annex IV documentation.

## The Six Pillars of Annex IV

### Pillar 1: General Description of the AI System

**What the regulation says:** A general description of the AI system including its intended purpose, the persons or groups of persons on which it is intended to be used, and the overall interaction of the AI system with hardware or software that is not part of the AI system itself.

**What this means for developers:**

Document the following:

- **Purpose and scope:** What the AI agent does, what decisions it supports or makes, what actions it can take. Be specific. "Assists customer service representatives" is insufficient. "Processes refund requests by looking up order details, verifying eligibility, and initiating refund transactions when criteria are met" is better.

- **Users and affected persons:** Who interacts with the system (operators, end users) and who is affected by its outputs (customers, applicants, patients). These are different groups with different risk profiles.

- **System architecture:** The LLM provider and model version, the tools/functions available to the agent, the data sources it accesses, and the systems it writes to. Include a clear description of the agent's capabilities and boundaries.

- **Integration context:** How the AI system connects to other software and hardware. API endpoints, database connections, third-party services, deployment infrastructure.

**How automated testing helps:** Your KindLM YAML config is a machine-readable description of your system. It specifies the provider, model, system prompt file (which documents the agent's instructions), and the tools available. The compliance report extracts this into structured documentation.

### Pillar 2: Detailed Description of Elements and Development Process

**What the regulation says:** A detailed description of the elements of the AI system and of the process for its development, including the methods and steps performed for the development, the design specifications, the data requirements, and the computing infrastructure.

**What this means for developers:**

- **Development methodology:** How was the agent designed? What prompt engineering approaches were used? What iterations were performed? Document your development process, including major design decisions and their rationale.

- **Data requirements:** What data does the agent process? What format is it in? If you fine-tuned or used few-shot examples, document the training data characteristics, source, and any preprocessing.

- **Model selection rationale:** Why did you choose this specific LLM provider and model? What alternatives were considered? What criteria drove the decision? If you used KindLM to compare providers, those test results are direct evidence of your selection methodology.

- **Design specifications:** The system prompt, tool definitions, parameter choices (temperature, max tokens), and any post-processing or validation logic.

**How automated testing helps:** Multi-provider comparison tests (`kindlm test --provider openai:gpt-4o` vs `kindlm test --provider anthropic:claude-sonnet-4-5-20250929`) produce quantitative evidence for model selection decisions. Test results over development iterations document the evolution of the system.

### Pillar 3: Monitoring, Functioning, and Control of the AI System

**What the regulation says:** Detailed information about the monitoring, functioning, and control of the AI system, in particular with regard to its capabilities and limitations in performance, the degrees of accuracy and the relevant metrics used to measure accuracy, the foreseeable unintended outcomes and sources of risks.

**What this means for developers:**

- **Performance capabilities:** What the agent can reliably do, with quantitative evidence. Pass rates on behavioral tests, accuracy of tool call selection, structured output validity rates.

- **Performance limitations:** What the agent cannot do or does unreliably. Be honest. If your agent fails 10% of edge-case tests, document that. Regulators prefer transparency about limitations over claims of perfection.

- **Accuracy metrics:** Specific, measurable metrics. For agents, this includes tool call accuracy, argument correctness, guardrail compliance rate, PII detection accuracy, and response quality scores.

- **Unintended outcomes:** Known failure modes and their frequency. What happens when the agent encounters inputs outside its training distribution? What errors has it made in testing?

- **Human oversight mechanisms:** How humans monitor and can override the agent. What escalation paths exist? Can a human intervene at any point?

**How automated testing helps:** This is where behavioral testing provides the most direct value. Every assertion result is a performance metric. `tool_called` pass rates measure action accuracy. `tool_not_called` pass rates measure guardrail effectiveness. `no_pii` results measure data protection. `judge` scores measure output quality. `drift` comparisons measure behavioral stability.

### Pillar 4: Risk Management

**What the regulation says:** A detailed description of the risk management system, including the identification and analysis of the known and foreseeable risks, the estimation and evaluation of risks, and the risk management measures adopted.

**What this means for developers:**

- **Risk identification:** Enumerate the risks your agent poses. For a refund agent: unauthorized refunds, PII exposure, discrimination, incorrect escalation, cost overruns. For a medical agent: incorrect triage, delayed escalation, privacy violations, inappropriate reassurance.

- **Risk analysis:** For each risk, assess likelihood and impact. Use test data where available. "The agent failed to escalate in 5% of angry-customer tests" is a measured risk. "The agent might sometimes fail to escalate" is an unmeasured guess.

- **Mitigation measures:** For each risk, document what you've done to mitigate it. Safety guardrails (tested with `tool_not_called`), PII scanning (tested with `no_pii`), protocol enforcement (tested with `tool_order`), human escalation (tested with `tool_called: escalate_to_human`).

- **Residual risk:** After mitigations, what risk remains? If your guardrail tests pass 95% of the time, you have a 5% residual risk of guardrail bypass. Document this honestly.

**How automated testing helps:** Each guardrail test (`tool_not_called`, `no_pii`, edge case tests) directly maps to a risk mitigation measure. The pass rate across multiple runs quantifies the effectiveness of the mitigation. The compliance report organizes this into a risk-to-mitigation mapping.

### Pillar 5: Testing and Validation

**What the regulation says:** A description of the testing procedures used, including information on the test methodology, the test data, the metrics, and the test results. This includes testing for bias, robustness, cybersecurity, and performance under different conditions.

**What this means for developers:**

- **Test methodology:** What types of tests you run and why. Behavioral assertions (tool calls), safety tests (guardrails, PII), quality tests (LLM-as-judge), robustness tests (edge cases, adversarial inputs), performance tests (latency, cost).

- **Test data:** The inputs used for testing. Your YAML test cases are your test data — document the rationale for each test case. Why these inputs? What failure modes do they target?

- **Test metrics:** The specific metrics you measure. Pass rate per assertion type, aggregate pass rate, judge scores, latency measurements, cost measurements. Include statistical methodology (multiple runs, aggregation method).

- **Test results:** The actual results with enough detail for a reviewer to understand what was tested and how it performed. Per-test pass rates, per-assertion results, statistical confidence.

- **Robustness and adversarial testing:** How the system handles unexpected or malicious inputs. Edge case tests and prompt injection tests are direct evidence of robustness testing.

**How automated testing helps:** This is the pillar where automated testing provides the most complete coverage. The KindLM compliance report generates the entire testing and validation section from your test results — methodology, metrics, and results in a structured format with statistical analysis.

### Pillar 6: Post-Market Monitoring

**What the regulation says:** A description of the post-market monitoring system, including the post-market monitoring plan.

**What this means for developers:**

- **Continuous testing:** How do you detect behavioral degradation after deployment? Running behavioral tests as part of your CI/CD pipeline on every code change is one form of continuous monitoring. Scheduled test runs against production configurations provide ongoing evidence.

- **Baseline tracking:** How do you know if behavior has drifted? KindLM's baseline feature (`kindlm baseline set` and `kindlm baseline compare`) provides version-to-version behavioral comparison.

- **Incident response:** What happens when tests fail? Document your process for investigating failures, determining root cause, and deploying fixes. Include evidence of past incidents and their resolution.

- **Update policy:** How and when do you update the system? What testing is required before updates are deployed? Your CI gate (`--gate 95`) is a documented quality threshold that prevents degraded agents from deploying.

**How automated testing helps:** CI-integrated testing with the compliance flag produces a continuous record of test evidence. Baseline comparisons track behavioral stability over time. Pass-rate gates provide documented quality thresholds.

## Putting It Together

Annex IV documentation is not a one-time deliverable. It's a living document that evolves with your system. The most efficient approach is to generate documentation continuously as a natural output of your development process:

1. **At development time:** Write behavioral tests that cover correctness, safety, and edge cases. Each test is a documented testing methodology.

2. **At build time:** Run tests in CI with `--compliance`. Each run generates a timestamped, hashed compliance report.

3. **At release time:** Compare against baselines, verify pass rates meet your gate threshold, archive the compliance report with the release.

4. **Post-deployment:** Run scheduled test suites against production configuration. Track drift over time.

```bash
# Development
kindlm init
kindlm test --compliance

# CI pipeline
kindlm test --compliance --reporter junit --gate 95

# Baseline management
kindlm baseline set
kindlm baseline compare
```

The technical documentation requirement in Annex IV is substantial, but it aligns with good engineering practice. If you're testing your AI agents thoroughly, compliance is largely a matter of organizing and presenting the evidence you're already generating.

---

*KindLM is open source at [github.com/kindlm/kindlm](https://github.com/kindlm/kindlm). Compliance report generation is free and included in the CLI.*

*Disclaimer: This article is for educational purposes. Consult qualified legal counsel for your specific compliance obligations under the EU AI Act.*
