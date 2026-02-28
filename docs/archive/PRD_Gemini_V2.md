# KindLM (Agentic Observability & Testing) - Comprehensive Architecture & Product Specification V2

## Document History & Purpose
This document serves as the absolute single source of truth for the KindLM product. In response to the need for deep, execution-ready architectural guidance, this PRD V2 drastically alters the previous scope. It intentionally abandons the notoriously brittle "Static YAML Multi-Turn Mocking" V1 strategy, pivoting entirely to an **OpenTelemetry-Driven Evaluation Engine**.

This specification is designed to be handed directly to a Senior Engineering team to dictate the next 6 months of development. It prevents wasted runway trying to build a complex YAML runner that breaks every time an LLM changes its argument formatting.

---

## 1. Executive Summary & Architectural Breakage Analysis

### 1.1 The Flaw in V1 Architectures (The "YAML Mocking Trap")
V1 attempted to build a CLI testing framework where engineers define multi-turn agent conversations entirely in YAML. 
- **The Non-Determinism Failure:** LLMs are non-deterministic. If your YAML expects `lookup_order(order_id="123")` but the LLM generates `lookup_order(id="123", context="urgent")`, the static mock fails, the test halts, and the pipeline breaks. 
- **The State Machine Nightmare:** Real agents maintain complex internal states, vector DB connections, and retries. Forcing a developer to manually mock a 6-turn conversational tree just to test if the final output contains PII is an impossible developer experience (DX).
- **The "Two Codebases" Problem:** Engineers end up writing the logic once in Python/TypeScript for the actual agent, and then writing a simplified, brittle mirror of that logic in KindLM YAML.

### 1.2 The V2 Fix: "OpenTelemetry Evaluation Traces"
V2 pivots KindLM from a "Static YAML Mock Runner" to an **OpenTelemetry (OTel) Evaluation Engine**.
- **Run the Real Agent:** Engineers run their *actual* agent in a staging environment against a staging database.
- **Trace Ingestion:** The agent emits standard OpenTelemetry traces (or LangChain/LlamaIndex callbacks). KindLM intercepts these traces.
- **Trace-Based Assertions:** KindLM evaluates what *actually happened* during the execution. `expect: trace.tool_calls.includes('lookup_order')` or `expect: guardrails.pii(trace.final_output) == false`. This decoupling eliminates the need for brittle YAML mocks.

---

## 2. Target User & Monetization Strategy

### 2.1 Primary ICP (Ideal Customer Profile)
- **Persona:** AI Engineers and ML Ops Leads at Mid-Market/Enterprise companies.
- **Environment:** They are trying to ship an autonomous support agent to production but Legal/Compliance is blocking the release until they can *prove* the agent won't leak PII or violate the EU AI Act.
- **Pain Point:** Existing eval tools (LangSmith, Braintrust) are heavy SaaS platforms focused on prompt iteration. The team needs a CI/CD gated pipeline tool that treats LLM evals like Jest tests.

### 2.2 Product Positioning & Monetization (The Compliance Wedge)
- **Open Source CLI:** The core evaluation engine (PII detection, JSON schema validation, OTel ingestion) is 100% free and runs locally in GitHub Actions.
- **The Enterprise Wedge ($299/mo):** The Cloud Dashboard is exclusively for non-technical stakeholders (Compliance, Legal, Product). It ingests the JSON reports from CI/CD and generates cryptographically signed PDF reports mapped directly to the **EU AI Act Annex IV** requirements, allowing companies to pass regulatory audits.

---

## 3. High-Level System Architecture

### 3.1 Stack Selection
- **Core CLI/Engine:** TypeScript (Node.js) distributed via NPM.
- **Trace Ingestion:** OpenTelemetry OTLP standard receiver built into the CLI.
- **Schema Validation:** AJV (JSON Schema) for deterministic output validation.
- **Cloud Dashboard:** Next.js (App Router), PostgreSQL (Supabase), hosted on Vercel.

### 3.2 The Core Execution Loop (In CI/CD)

```text
[ GitHub Actions Runner ]
    |-- 1. Engineer runs `kindlm test --trace-port 4318`.
    |-- 2. KindLM CLI starts an ephemeral OTLP listener.
    |-- 3. KindLM runs the engineer's test script: `python tests/run_agent.py`.
          |
[ Python Agent (Running real code against staging db) ]
    |-- 4. Agent communicates with OpenAI/Anthropic.
    |-- 5. Emits trace spans (prompts, tool calls, responses) via OTLP to `localhost:4318`.
          |
[ KindLM CLI ]
    |-- 6. Ingests all traces from the execution.
    |-- 7. Runs Eval Assertions (PII Check, Schema Check, LLM-as-Judge).
    |-- 8. Throws Exit Code 1 if any gate fails -> Blocks the PR.
    |-- 9. (Optional) Uploads full signed report to KindLM Cloud.
```

---

## 4. Deep-Dive: The Evaluation Assertions

### 4.1 Deterministic vs. Probabilistic Evals
KindLM strictly separates rules-based evals from LLM-based evals to prevent pipeline flakiness.
- **Deterministic (Gate = 100% Pass Required):**
  - Schema Compliance (Output precisely matches JSON schema).
  - PII Detection (Regex/Presidio sweeps for SSN, routing numbers).
  - Keyword Denylist (Ensures the agent never mentions competitor names).
- **Probabilistic (Gate = 90% Pass Rate Allowed):**
  - LLM-as-Judge (e.g., `criteria: "Tone is professional and empathetic"`).
  - Evaluated using a faster, cheaper model (like GPT-4o-mini) checking the outputs of the primary model.

---

## 5. Security & Build Integrity

### 5.1 The "Local Execution" Guarantee
Enterprise compliance teams will not upload their proprietary RAG context or system prompts to a startup's SaaS server.
- KindLM's core architecture guarantees that 100% of the evaluation execution (including the LLM-as-Judge calls) happens on the customer's own CI/CD runners using their own API keys.
- Only aggregated metrics, pass/fail booleans, and explicitly approved artifacts are synced to the KindLM Cloud for the PDF audit reports. 

---

## 6. Phased Execution Roadmap

### Phase 1: The OTLP Interceptor & CLI Engine (Weeks 1-4)
- Build the Node.js CLI to accept OTLP JSON traces.
- Write the assertion engine for Deterministic rules (AJV Schema, Regex PII, Tool Call presence).
- **Output:** A developer can write a Python script, point their OpenTelemetry exporter to the CLI, and get a pass/fail terminal output.

### Phase 2: Probabilistic Evals & LLM-as-Judge (Weeks 5-7)
- Implement the LLM-as-Judge execution pipeline.
- Build the JUnit XML exporter so KindLM natively integrates with GitHub Actions UI and GitLab CI.
- **Output:** The CLI is feature-complete for an Open Source release.

### Phase 3: The Compliance Cloud (Weeks 8-11)
- Build the Next.js SaaS dashboard.
- Create the specific markdown/PDF generation templates mapped to the EU AI Act (e.g., mapping PII test coverage to "Data Governance" requirements).
- **Output:** The paid Enterprise tier is ready for sales demos.

### Phase 4: Developer Relations & Integrations (Weeks 12-14)
- Build drop-in SDKs/examples for connecting LangChain, LlamaIndex, and Vercel AI SDK straight into the KindLM OTLP listener.
- **Go-Live:** Launch on HackerNews as "The easiest way to stop your agent from leaking PII."
