# KindLM Compliance Specification

## Overview

KindLM generates compliance-grade test documentation that maps to regulatory requirements. The primary framework supported in v1 is the EU AI Act (Regulation (EU) 2024/1689), specifically the technical documentation requirements for high-risk AI systems (Annex IV) and the testing/validation obligations.

This is NOT a full GRC (Governance, Risk, Compliance) platform. KindLM focuses narrowly on **generating test documentation and audit artifacts** from its existing test execution data.

---

## EU AI Act Mapping

### Relevant Articles

| Article | Requirement | KindLM Coverage |
|---------|------------|-----------------|
| Art. 9 | Risk management system | Partial — test coverage metrics, failure categorization |
| Art. 10 | Data governance | Not covered (training data is out of scope) |
| Art. 11 | Technical documentation (Annex IV) | Primary target — test records, metrics, system description |
| Art. 12 | Record-keeping | Test execution logs with timestamps and hashes |
| Art. 13 | Transparency | System description, intended purpose, limitations |
| Art. 14 | Human oversight | Not directly covered (organizational process) |
| Art. 15 | Accuracy, robustness, cybersecurity | Test results for accuracy/robustness; security testing via guardrails |
| Art. 61 | Post-market monitoring | Production sampling validation (v1.5) |

### Annex IV — Technical Documentation (What KindLM Generates)

Annex IV requires documentation including:

1. **General description of the AI system** → `compliance.metadata` in config
2. **Detailed description of elements and development process** → Config file as artifact
3. **Information about monitoring, functioning, and control** → Guardrail configurations
4. **Detailed description of the risk management system** → Test coverage + failure analysis
5. **Description of any change made to the system** → Git commit SHA, config hash diffs
6. **Validation and testing procedures** → Full test execution reports
7. **Data-sets used** → Test case inputs (not training data)
8. **Metrics used to measure accuracy, robustness, and compliance** → Gate definitions + results

---

## Compliance Report Structure

The compliance report is generated as a Markdown file, which can then be converted to PDF. It is structured to be presentable to auditors and compliance officers, not just developers.

### Report Template

```markdown
# AI System Testing & Validation Report

## Document Metadata

| Field | Value |
|-------|-------|
| Report ID | {{reportId}} |
| Generated | {{generatedAt}} |
| Generator | KindLM v{{kindlmVersion}} |
| Config Hash | {{configHash}} |
| Artifact Hash | {{artifactHash}} |

---

## 1. System Identification

| Field | Value |
|-------|-------|
| System Name | {{systemName}} |
| System Version | {{systemVersion}} |
| Risk Level | {{riskLevel}} |
| Operator | {{operator}} |
| Intended Purpose | {{intendedPurpose}} |
| Project | {{project}} |
| Test Suite | {{suiteName}} |

### 1.1 System Description
{{intendedPurpose}}

### 1.2 Data Governance Notes
{{dataGovernanceNotes}}

---

## 2. Test Configuration

### 2.1 Models Under Test

| Model ID | Provider | Model Name | Temperature | Max Tokens |
|----------|----------|------------|-------------|------------|
{{#each models}}
| {{id}} | {{provider}} | {{model}} | {{params.temperature}} | {{params.maxTokens}} |
{{/each}}

### 2.2 Guardrail Configuration

**PII Detection:** {{piiEnabled}} ({{piiPatternCount}} patterns)
**Keyword Deny Lists:** {{keywordDenyCount}} terms
**Schema Validation:** {{schemaFileCount}} JSON schemas
**LLM-as-Judge:** {{judgeCriteriaCount}} criteria

### 2.3 Gate Thresholds

| Gate | Threshold | Description |
|------|-----------|-------------|
| Pass Rate | ≥ {{gates.passRateMin}} | Minimum proportion of tests passing |
| Schema Failures | ≤ {{gates.schemaFailuresMax}} | Maximum schema validation failures |
| PII Failures | ≤ {{gates.piiFailuresMax}} | Maximum PII detection violations |
| Judge Average | ≥ {{gates.judgeAvgMin}} | Minimum LLM-as-judge mean score |
| Drift Score | ≤ {{gates.driftScoreMax}} | Maximum baseline drift |

---

## 3. Test Execution Summary

### 3.1 Run Overview

| Field | Value |
|-------|-------|
| Run ID | {{runId}} |
| Started | {{startedAt}} |
| Finished | {{finishedAt}} |
| Duration | {{durationMs}} ms |
| Git Commit | {{commitSha}} |
| Branch | {{branch}} |
| Environment | {{environment}} |
| Repeat Count | {{repeatCount}} per test case |
| Total Executions | {{totalExecutions}} |

### 3.2 Overall Results

| Metric | Value | Gate | Status |
|--------|-------|------|--------|
| Pass Rate | {{passRate}} | ≥ {{gates.passRateMin}} | {{passRateStatus}} |
| Schema Failures | {{schemaFailCount}} | ≤ {{gates.schemaFailuresMax}} | {{schemaStatus}} |
| PII Failures | {{piiFailCount}} | ≤ {{gates.piiFailuresMax}} | {{piiStatus}} |
| Judge Average | {{judgeAvgScore}} | ≥ {{gates.judgeAvgMin}} | {{judgeStatus}} |
| Drift Score | {{driftScore}} | ≤ {{gates.driftScoreMax}} | {{driftStatus}} |
| Cost Estimate | ${{costEstimateUsd}} | — | — |
| Avg Latency | {{latencyAvgMs}} ms | — | — |

**Gate Result: {{gateResult}}**

---

## 4. Detailed Results by Test Case

{{#each results}}
### 4.{{@index}}. {{testCaseName}} ({{modelId}})

| Metric | Value |
|--------|-------|
| Passed | {{passed}} |
| Pass Rate | {{passRate}} ({{runCount}} runs) |
| Latency | {{latencyAvgMs}} ms |
| Tokens | {{totalTokens}} |
| Cost | ${{costUsd}} |

**Assertion Results:**

| Assertion | Score | Status |
|-----------|-------|--------|
{{#each assertionDetails}}
| {{label}} | {{score}} | {{status}} |
{{/each}}

{{#if failureCodes}}
**Failure Codes:** {{failureCodes}}

**Failure Details:** {{failureMessages}}
{{/if}}

{{/each}}

---

## 5. Bias & Fairness Testing

### 5.1 Test Coverage

| Category | Test Cases | Pass Rate |
|----------|-----------|-----------|
{{#each coverageByTag}}
| {{tag}} | {{count}} | {{passRate}} |
{{/each}}

### 5.2 Cross-Model Comparison

| Model | Pass Rate | Avg Judge Score | Avg Latency | Cost |
|-------|-----------|----------------|-------------|------|
{{#each modelComparison}}
| {{modelId}} | {{passRate}} | {{judgeAvg}} | {{latencyAvgMs}} ms | ${{costUsd}} |
{{/each}}

---

## 6. Baseline Comparison

{{#if hasBaseline}}
**Baseline:** {{baselineLabel}} (Run: {{baselineRunId}}, Date: {{baselineDate}})

| Metric | Baseline | Current | Delta |
|--------|----------|---------|-------|
| Pass Rate | {{baseline.passRate}} | {{current.passRate}} | {{delta.passRate}} |
| Judge Avg | {{baseline.judgeAvg}} | {{current.judgeAvg}} | {{delta.judgeAvg}} |
| Schema Fails | {{baseline.schemaFails}} | {{current.schemaFails}} | {{delta.schemaFails}} |
| Drift Score | — | {{current.driftScore}} | — |

### Regressions (tests that previously passed but now fail)

{{#each regressions}}
- **{{testCaseName}}** ({{modelId}}): {{baselinePassRate}} → {{currentPassRate}} | New failures: {{newFailureCodes}}
{{/each}}

{{else}}
No baseline configured for this suite. Recommend setting a baseline for drift detection.
{{/if}}

---

## 7. Audit Trail

### 7.1 Artifact Integrity

| Artifact | SHA-256 Hash |
|----------|-------------|
| Config file | {{configFileHash}} |
| Test report (JSON) | {{reportJsonHash}} |
| This document | {{complianceDocHash}} |

### 7.2 Execution Environment

| Field | Value |
|-------|-------|
| KindLM Version | {{kindlmVersion}} |
| Node.js Version | {{nodeVersion}} |
| OS | {{osInfo}} |
| Timezone | {{timezone}} |

---

*This report was generated automatically by KindLM v{{kindlmVersion}}.
It does not constitute legal advice. Organizations should consult qualified
legal professionals for EU AI Act compliance interpretation.*

*Report generated: {{generatedAt}} | Hash: {{complianceDocHash}}*
```

---

## Compliance Reporter Implementation

```typescript
// packages/core/src/reporters/compliance.ts

import { createHash } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { KindLMConfig } from "../types/config";
import type { AggregatedTestResult } from "../engine/aggregator";
import type { GateEvaluation } from "../engine/gate";

export interface ComplianceReportInput {
  config: KindLMConfig;
  configHash: string;
  results: AggregatedTestResult[];
  gateEvaluation: GateEvaluation;
  runId: string;
  startedAt: string;
  finishedAt: string;
  gitInfo?: { commitSha: string; branch: string };
  environment: string;
  kindlmVersion: string;
  baselineComparison?: {
    baselineLabel: string;
    baselineRunId: string;
    baselineDate: string;
    baseline: Record<string, number>;
    current: Record<string, number>;
    delta: Record<string, number>;
    regressions: Array<{
      testCaseName: string;
      modelId: string;
      baselinePassRate: number;
      currentPassRate: number;
      newFailureCodes: string[];
    }>;
  };
}

export function generateComplianceReport(input: ComplianceReportInput): string {
  const {
    config, configHash, results, gateEvaluation, runId,
    startedAt, finishedAt, gitInfo, environment, kindlmVersion,
  } = input;

  const meta = config.compliance?.metadata ?? {};
  const reportId = createHash("sha256")
    .update(`${runId}-${configHash}-${finishedAt}`)
    .digest("hex")
    .slice(0, 16);

  // Calculate summary metrics
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const passRate = totalTests > 0 ? passedTests / totalTests : 0;
  const schemaFails = results.filter((r) =>
    r.failureCodes.some((c) => c.startsWith("SCHEMA_"))
  ).length;
  const piiFails = results.filter((r) =>
    r.failureCodes.includes("PII_DETECTED")
  ).length;

  // ... template rendering logic ...
  // Produces the markdown document from the template above

  return renderedMarkdown;
}

export function writeComplianceReport(
  input: ComplianceReportInput,
  outputDir: string,
): { markdownPath: string; hash: string } {
  mkdirSync(outputDir, { recursive: true });

  const markdown = generateComplianceReport(input);
  const hash = createHash("sha256").update(markdown).digest("hex");

  const filename = `kindlm-compliance-${input.runId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.md`;
  const markdownPath = join(outputDir, filename);
  writeFileSync(markdownPath, markdown, "utf-8");

  return { markdownPath, hash };
}
```

---

## Artifact Hashing

Every compliance report includes SHA-256 hashes of key artifacts for tamper evidence:

```typescript
export function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export function hashString(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
```

Hashed artifacts:
1. **Config file** — proves which test configuration was used
2. **JSON report** — proves the raw test results
3. **Compliance document** — self-hash for integrity verification
4. **Baseline snapshot** — proves which baseline was compared against

---

## Limitations & Disclaimers

KindLM compliance reports are a **documentation aid**, not a legal compliance solution:

- They do NOT cover all Annex IV requirements (e.g., training data governance, human oversight processes)
- They do NOT provide legal interpretation of the EU AI Act
- They do NOT replace conformity assessment by notified bodies
- They DO provide structured, timestamped, hashable test evidence
- They DO map test results to relevant regulatory requirements
- They DO generate artifacts suitable for inclusion in broader compliance packages

The compliance report should be reviewed by a qualified legal professional before submission to regulatory authorities.

---

## Future Extensions (v1.5+)

- **Custom compliance frameworks** — allow users to define their own mapping templates
- **Report diffing** — compare two compliance reports to show what changed

---

## Free vs Cloud Compliance Features

| Feature | CLI (Free) | Team ($49/mo) | Enterprise ($299/mo) |
|---------|-----------|---------------|---------------------|
| Compliance markdown report | ✓ | ✓ | ✓ |
| SHA-256 hash for tamper evidence | ✓ | ✓ | ✓ |
| Local file output | ✓ | ✓ | ✓ |
| Cloud-stored report history | — | 90 days | Unlimited |
| PDF export with company branding | — | ✓ | ✓ |
| Digitally signed reports | — | — | ✓ |
| Audit log API for report access | — | — | ✓ |
| Automated scheduled compliance runs | — | ✓ | ✓ |
| Report diffing (compare two reports) | — | ✓ | ✓ |

The CLI generates the same high-quality compliance documentation regardless of plan. Cloud adds storage, export formats, and audit features that regulated enterprises need for their compliance workflows.
