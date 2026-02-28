import { useState, useEffect, useRef } from "react";

const QUESTIONS = [
  {
    id: "domain",
    question: "What domain does your AI system operate in?",
    subtitle: "The EU AI Act classifies risk by application domain.",
    options: [
      { label: "Employment & HR", value: "hr", risk: "high", detail: "Recruitment, screening, performance evaluation, promotions" },
      { label: "Credit & Finance", value: "finance", risk: "high", detail: "Credit scoring, insurance pricing, financial risk assessment" },
      { label: "Healthcare", value: "health", risk: "high", detail: "Medical diagnosis support, triage, treatment suggestions" },
      { label: "Education", value: "education", risk: "high", detail: "Student assessment, admissions, learning path decisions" },
      { label: "Law Enforcement", value: "law", risk: "high", detail: "Risk profiling, evidence evaluation, crime prediction" },
      { label: "Critical Infrastructure", value: "infra", risk: "high", detail: "Energy, water, transport, digital infrastructure management" },
      { label: "Customer Service", value: "support", risk: "limited", detail: "Chatbots, support agents, content generation" },
      { label: "Content & Creative", value: "content", risk: "limited", detail: "Text generation, image creation, content moderation" },
      { label: "Developer Tools", value: "devtools", risk: "minimal", detail: "Code generation, testing, deployment automation" },
      { label: "Other / Not Sure", value: "other", risk: "unknown", detail: "We'll help you figure it out" },
    ]
  },
  {
    id: "autonomy",
    question: "How autonomous is your AI system?",
    subtitle: "Higher autonomy = higher risk classification.",
    options: [
      { label: "Fully autonomous decisions", value: "full", riskMod: 2, detail: "System acts without human review (e.g., auto-approves, auto-blocks)" },
      { label: "Recommends, human decides", value: "recommend", riskMod: 0, detail: "System suggests actions, human makes final call" },
      { label: "Assists human work", value: "assist", riskMod: -1, detail: "System provides information, human drives the workflow" },
      { label: "Fully human-controlled", value: "manual", riskMod: -2, detail: "AI provides data, all decisions are manual" },
    ]
  },
  {
    id: "tools",
    question: "Does your AI system call external tools or APIs?",
    subtitle: "Tool-calling agents need behavioral testing.",
    options: [
      { label: "Yes — databases, APIs, payments, etc.", value: "yes_critical", tools: true, detail: "Agent makes API calls that change state (create, update, delete)" },
      { label: "Yes — read-only queries", value: "yes_readonly", tools: true, detail: "Agent retrieves data but doesn't modify anything" },
      { label: "No — text generation only", value: "no", tools: false, detail: "Agent produces text responses without external calls" },
    ]
  },
  {
    id: "data",
    question: "Does your system process personal data?",
    subtitle: "PII handling affects both GDPR and EU AI Act requirements.",
    options: [
      { label: "Yes — sensitive personal data", value: "sensitive", pii: "high", detail: "Health records, biometrics, financial data, ethnicity, political views" },
      { label: "Yes — standard personal data", value: "standard", pii: "medium", detail: "Names, emails, phone numbers, addresses" },
      { label: "No personal data", value: "none", pii: "low", detail: "Only processes non-personal business data" },
    ]
  },
  {
    id: "deployment",
    question: "Where will your AI system be deployed?",
    subtitle: "EU AI Act applies to systems serving EU users, regardless of where you're based.",
    options: [
      { label: "EU market (or serving EU users)", value: "eu", euScope: true, detail: "If ANY of your users are in the EU, this applies to you" },
      { label: "US only", value: "us", euScope: false, detail: "No EU users — but US state AI laws are emerging" },
      { label: "Global", value: "global", euScope: true, detail: "Global = includes EU = EU AI Act applies" },
      { label: "Internal only", value: "internal", euScope: false, detail: "Internal tools may still be in scope if they affect EU employees" },
    ]
  }
];

const RISK_COLORS = {
  unacceptable: { bg: "#7f1d1d", border: "#dc2626", text: "#fca5a5", label: "Unacceptable Risk" },
  high: { bg: "#7c2d12", border: "#ea580c", text: "#fdba74", label: "High Risk" },
  limited: { bg: "#713f12", border: "#ca8a04", text: "#fde047", label: "Limited Risk" },
  minimal: { bg: "#14532d", border: "#16a34a", text: "#86efac", label: "Minimal Risk" },
  unknown: { bg: "#1e293b", border: "#64748b", text: "#94a3b8", label: "Assessment Needed" },
};

const ARTICLES = {
  high: [
    { num: 9, name: "Risk Management System", req: "Establish and maintain a risk management system throughout the AI system's lifecycle.", eng: "Automated test suites that run on every deployment, covering behavioral correctness, edge cases, and failure modes.", kindlm: "KindLM test suites serve as executable risk management documentation." },
    { num: 10, name: "Data Governance", req: "Training, validation, and testing datasets must be relevant, representative, and free from bias.", eng: "Diverse test inputs covering demographic groups, edge cases, and adversarial scenarios.", kindlm: "Test multiple inputs per scenario with varied demographics and edge cases." },
    { num: 11, name: "Technical Documentation", req: "Maintain detailed documentation of the AI system design, development, and testing.", eng: "Auto-generated reports from test execution with full traceability.", kindlm: "KindLM generates EU AI Act Annex IV compliance reports from test results." },
    { num: 12, name: "Record-Keeping", req: "Automatic logging of events throughout the system's lifecycle.", eng: "Structured logs of every test run, agent decision, and tool call with timestamps and git metadata.", kindlm: "Every test run produces structured JSON logs with full provenance." },
    { num: 14, name: "Human Oversight", req: "Enable human oversight and intervention capabilities.", eng: "Test that agents escalate appropriately and don't make autonomous decisions outside scope.", kindlm: "tool_not_called assertions verify agents don't act beyond authorized scope." },
    { num: 15, name: "Accuracy & Robustness", req: "Achieve appropriate levels of accuracy, robustness, and consistency.", eng: "Multi-run consistency testing, drift detection, and regression suites.", kindlm: "Run tests 3-10x per scenario to measure behavioral consistency." },
  ],
  limited: [
    { num: 50, name: "Transparency", req: "Users must be informed they are interacting with an AI system.", eng: "Test that the agent identifies itself as AI when asked.", kindlm: "judge assertion: 'Clearly identifies itself as an AI system'" },
    { num: 52, name: "AI-Generated Content Marking", req: "AI-generated content must be marked as such.", eng: "Verify output includes appropriate disclosures.", kindlm: "contains assertion for AI disclosure markers." },
  ],
  minimal: [
    { num: "N/A", name: "Voluntary Codes of Conduct", req: "Encouraged to adopt voluntary codes of conduct for trustworthy AI.", eng: "Best practice: add behavioral testing to CI/CD even when not required.", kindlm: "KindLM provides testing discipline as a best practice." },
  ]
};

function ProgressBar({ current, total }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i <= current ? "linear-gradient(90deg, #3b82f6, #8b5cf6)" : "#1e293b",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}

function RiskBadge({ level, size = "normal" }) {
  const c = RISK_COLORS[level] || RISK_COLORS.unknown;
  return (
    <span style={{
      display: "inline-block",
      padding: size === "large" ? "8px 20px" : "4px 12px",
      borderRadius: 8,
      background: c.bg,
      border: `1px solid ${c.border}`,
      color: c.text,
      fontSize: size === "large" ? 16 : 12,
      fontWeight: 700,
      letterSpacing: 0.5,
    }}>{c.label}</span>
  );
}

export default function ComplianceChecker() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  const handleSelect = (questionId, option) => {
    const newAnswers = { ...answers, [questionId]: option };
    setAnswers(newAnswers);
    if (step < QUESTIONS.length - 1) {
      setTimeout(() => setStep(step + 1), 300);
    } else {
      setTimeout(() => setShowResults(true), 400);
    }
  };

  const restart = () => {
    setStep(0);
    setAnswers({});
    setShowResults(false);
  };

  // Calculate risk level
  const getRiskLevel = () => {
    const domain = answers.domain;
    const autonomy = answers.autonomy;
    if (!domain || !autonomy) return "unknown";
    let baseRisk = domain.risk;
    if (baseRisk === "high" && autonomy.riskMod >= 2) return "high";
    if (baseRisk === "high") return "high";
    if (baseRisk === "limited" && autonomy.riskMod >= 2) return "high";
    if (baseRisk === "limited") return "limited";
    if (baseRisk === "minimal" && autonomy.riskMod >= 2) return "limited";
    return "minimal";
  };

  const riskLevel = getRiskLevel();
  const euScope = answers.deployment?.euScope ?? true;
  const hasTools = answers.tools?.tools ?? false;
  const piiLevel = answers.data?.pii ?? "low";

  const daysLeft = Math.max(0, Math.ceil((new Date("2026-08-02") - new Date()) / (1000 * 60 * 60 * 24)));

  const q = QUESTIONS[step];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c18",
      color: "#e2e8f0",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
      `}</style>

      <div style={{ maxWidth: 720, width: "100%", padding: "40px 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "6px 16px", borderRadius: 20,
            background: "#1e293b", border: "1px solid #334155",
            fontSize: 12, color: "#94a3b8", marginBottom: 16,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: "#ef4444", animation: "pulse 2s infinite" }} />
            {daysLeft} days until EU AI Act deadline
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: -0.5,
            margin: "8px 0",
            background: "linear-gradient(135deg, #e2e8f0, #94a3b8)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>EU AI Act Compliance Checker</h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            Answer 5 questions → get your risk classification and action plan
          </p>
        </div>

        {!showResults ? (
          <div style={{ animation: "fadeIn 0.3s ease-out" }} key={step}>
            <ProgressBar current={step} total={QUESTIONS.length} />

            <div style={{
              fontSize: 11, color: "#64748b", fontWeight: 600,
              letterSpacing: 1, textTransform: "uppercase", marginBottom: 8,
            }}>Question {step + 1} of {QUESTIONS.length}</div>

            <h2 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 6px", letterSpacing: -0.3 }}>
              {q.question}
            </h2>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 24px" }}>{q.subtitle}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {q.options.map((opt) => {
                const selected = answers[q.id]?.value === opt.value;
                return (
                  <button key={opt.value} onClick={() => handleSelect(q.id, opt)} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "16px 20px",
                    background: selected ? "#1e293b" : "#0f172a",
                    border: `1px solid ${selected ? "#3b82f6" : "#1e293b"}`,
                    borderRadius: 12, cursor: "pointer",
                    textAlign: "left", color: "#e2e8f0",
                    transition: "all 0.15s",
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 10, flexShrink: 0, marginTop: 2,
                      border: `2px solid ${selected ? "#3b82f6" : "#334155"}`,
                      background: selected ? "#3b82f6" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {selected && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#fff" }} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{opt.detail}</div>
                    </div>
                    {opt.risk && (
                      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                        <RiskBadge level={opt.risk} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {step > 0 && (
              <button onClick={() => setStep(step - 1)} style={{
                marginTop: 16, padding: "8px 16px", background: "transparent",
                border: "1px solid #334155", borderRadius: 8,
                color: "#64748b", fontSize: 13, cursor: "pointer",
              }}>← Back</button>
            )}
          </div>
        ) : (
          /* RESULTS */
          <div style={{ animation: "fadeIn 0.4s ease-out" }}>
            {/* Risk Classification */}
            <div style={{
              background: "#0f172a", border: "1px solid #1e293b",
              borderRadius: 16, padding: 28, marginBottom: 20,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>
                Your AI System Classification
              </div>
              <RiskBadge level={riskLevel} size="large" />

              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
                marginTop: 24, textAlign: "center",
              }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: RISK_COLORS[riskLevel].text }}>{daysLeft}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Days to comply</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>€35M</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Max penalty</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0" }}>{ARTICLES[riskLevel]?.length || 0}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>Articles applicable</div>
                </div>
              </div>
            </div>

            {/* EU Scope Warning */}
            {!euScope && (
              <div style={{
                background: "#14532d33", border: "1px solid #16a34a44",
                borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 13,
              }}>
                <strong style={{ color: "#86efac" }}>Note:</strong>
                <span style={{ color: "#94a3b8" }}> Your system may be outside EU AI Act scope for now. However, US states (Colorado, California) are introducing similar AI legislation. Consider compliance as a competitive advantage.</span>
              </div>
            )}

            {/* Tool Calling Alert */}
            {hasTools && (
              <div style={{
                background: "#3b82f611", border: "1px solid #3b82f633",
                borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 13,
              }}>
                <strong style={{ color: "#60a5fa" }}>Your agent calls external tools.</strong>
                <span style={{ color: "#94a3b8" }}> This means you need <strong>behavioral testing</strong> — verifying that the agent calls the right tools, with the right arguments, in the right order. Standard text output testing is not sufficient.</span>
              </div>
            )}

            {/* PII Alert */}
            {piiLevel !== "low" && (
              <div style={{
                background: "#a855f711", border: "1px solid #a855f733",
                borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 13,
              }}>
                <strong style={{ color: "#c084fc" }}>Your system processes {piiLevel === "high" ? "sensitive " : ""}personal data.</strong>
                <span style={{ color: "#94a3b8" }}> Every test should include PII detection assertions to prevent data leakage. GDPR requirements apply in addition to the EU AI Act.</span>
              </div>
            )}

            {/* Requirements Table */}
            <div style={{
              background: "#0f172a", border: "1px solid #1e293b",
              borderRadius: 16, padding: 24, marginBottom: 20,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px", letterSpacing: -0.3 }}>
                Requirements for {RISK_COLORS[riskLevel].label} Systems
              </h3>

              {(ARTICLES[riskLevel] || []).map((art, i) => (
                <div key={i} style={{
                  padding: "16px 0",
                  borderTop: i > 0 ? "1px solid #1e293b" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 4,
                      background: "#1e293b", fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#94a3b8", fontWeight: 600,
                    }}>Art. {art.num}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{art.name}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px", lineHeight: 1.6 }}>
                    <strong style={{ color: "#64748b" }}>Requirement:</strong> {art.req}
                  </p>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px", lineHeight: 1.6 }}>
                    <strong style={{ color: "#64748b" }}>Engineering work:</strong> {art.eng}
                  </p>
                  <p style={{ fontSize: 12, color: "#60a5fa", margin: 0, lineHeight: 1.6 }}>
                    <strong style={{ color: "#3b82f6" }}>KindLM:</strong> {art.kindlm}
                  </p>
                </div>
              ))}
            </div>

            {/* Action Plan */}
            <div style={{
              background: "#0f172a", border: "1px solid #1e293b",
              borderRadius: 16, padding: 24, marginBottom: 20,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Your {daysLeft}-Day Action Plan</h3>

              {[
                { phase: "Foundation", weeks: "Weeks 1-4", items: ["Install KindLM and write initial test suites", "Map your agent's tool-calling behavior", "Set up CI/CD integration with GitHub Actions", "Establish baseline behavioral metrics"] },
                { phase: "Coverage", weeks: "Weeks 5-12", items: ["Expand test cases to cover edge cases and adversarial inputs", "Add PII detection and data governance assertions", "Implement drift detection for model version changes", "Document human oversight and escalation paths"] },
                { phase: "Documentation", weeks: "Weeks 13-20", items: ["Generate EU AI Act Annex IV compliance reports", "Create risk management documentation from test results", "Establish continuous monitoring and record-keeping", "Prepare for conformity assessment (if required)"] },
              ].map((phase, i) => (
                <div key={i} style={{
                  padding: "14px 0",
                  borderTop: i > 0 ? "1px solid #1e293b" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 14,
                      background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "#fff",
                    }}>{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{phase.phase}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{phase.weeks}</div>
                    </div>
                  </div>
                  {phase.items.map((item, j) => (
                    <div key={j} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "4px 0 4px 38px", fontSize: 13, color: "#94a3b8",
                    }}>
                      <span style={{ color: "#334155" }}>→</span> {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{
              background: "linear-gradient(135deg, #1e3a5f, #2d1b69)",
              border: "1px solid #3b82f644",
              borderRadius: 16, padding: 28, textAlign: "center",
              marginBottom: 20,
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Start Testing Your Agent's Behavior</h3>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 20px" }}>
                KindLM is open-source, MIT licensed, and takes 2 minutes to set up.
              </p>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 14,
                background: "#0f172a", padding: "12px 20px", borderRadius: 8,
                color: "#60a5fa", marginBottom: 20, display: "inline-block",
              }}>
                npm install -g @kindlm/cli
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <a href="https://github.com/kindlmann/kindlm" target="_blank" rel="noopener" style={{
                  padding: "12px 24px", borderRadius: 10, background: "#1e293b",
                  color: "#e2e8f0", fontSize: 14, fontWeight: 600,
                  textDecoration: "none", border: "1px solid #334155",
                }}>⭐ GitHub</a>
                <a href="https://kindlm.com/docs" target="_blank" rel="noopener" style={{
                  padding: "12px 24px", borderRadius: 10,
                  background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                  color: "#fff", fontSize: 14, fontWeight: 600,
                  textDecoration: "none",
                }}>Read the Docs →</a>
                <a href="https://kindlm.com/playground" target="_blank" rel="noopener" style={{
                  padding: "12px 24px", borderRadius: 10, background: "#1e293b",
                  color: "#e2e8f0", fontSize: 14, fontWeight: 600,
                  textDecoration: "none", border: "1px solid #334155",
                }}>🎮 Try Playground</a>
              </div>
            </div>

            {/* Restart */}
            <div style={{ textAlign: "center" }}>
              <button onClick={restart} style={{
                padding: "10px 20px", background: "transparent",
                border: "1px solid #334155", borderRadius: 8,
                color: "#64748b", fontSize: 13, cursor: "pointer",
              }}>↻ Start Over</button>
              <p style={{ fontSize: 11, color: "#475569", marginTop: 12 }}>
                This tool provides general guidance, not legal advice. Consult a qualified legal professional for compliance decisions.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 40, paddingTop: 20, borderTop: "1px solid #1e293b",
          textAlign: "center", fontSize: 11, color: "#475569",
        }}>
          Built by <a href="https://kindlm.com" style={{ color: "#64748b" }}>KindLM</a> · 
          Open source · MIT License · Not legal advice
        </div>
      </div>
    </div>
  );
}
