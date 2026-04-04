import { NavBar } from "./landing/NavBar";
import { Terminal } from "./landing/Terminal";
import { Reveal } from "./landing/Reveal";
import { CopyButton } from "./landing/CopyButton";
import { HeroDots } from "./landing/HeroDots";

// ── Pre-computed YAML syntax highlighting (runs once at build time) ──

const YAML_TEXT = `- name: "refund-happy-path"
  input: "Charged twice for order #12345"
  assert:
    - type: tool_called
      value: lookup_order
      args: { order_id: "12345" }
    - type: tool_not_called
      value: escalate_to_human
    - type: judge
      criteria: "Empathetic tone"
      threshold: 0.8
    - type: no_pii`;

function colorizeYaml(text: string) {
  return text.split("\n").map((line) => {
    let color = "#78716c"; // stone-500 — passes contrast on dark bg
    if (/^\s*-?\s*\w+:/.test(line)) color = "#7dd3fc";
    if (line.includes('"')) color = "#86efac";
    if (/\b\d+\.?\d*\b/.test(line) && !line.includes('"')) color = "#fde68a";
    if (line.includes("true") || line.includes("false")) color = "#f9a8d4";
    return { text: line, color };
  });
}

const YAML_LINES = colorizeYaml(YAML_TEXT);

// ── Feature code block (matching real KindLM assert syntax) ──

const TOOL_CALL_CODE = [
  { c: "#7dd3fc", t: "assert:" },
  { c: "#a8a29e", t: "  # Look up the order first" },
  { c: "#7dd3fc", t: "  - type: tool_called" },
  { c: "#86efac", t: "    value: lookup_order" },
  { c: "#86efac", t: '    args: { order_id: "12345" }' },
  { c: "#a8a29e", t: "  # Then issue the refund" },
  { c: "#7dd3fc", t: "  - type: tool_called" },
  { c: "#86efac", t: "    value: issue_refund" },
  { c: "#a8a29e", t: "  # Never escalate routine cases" },
  { c: "#7dd3fc", t: "  - type: tool_not_called" },
  { c: "#f9a8d4", t: "    value: escalate_to_human" },
];

const JUDGE_DATA = [
  { criteria: "Empathetic, addresses the issue", score: 0.92, pass: true },
  { criteria: "No promises about timeline", score: 0.71, pass: false },
  { criteria: "Correct company terminology", score: 0.88, pass: true },
];

const DRIFT_DATA = [
  { metric: "Pass rate", value: "87.5%", delta: "\u221212.5%", bad: true },
  { metric: "Judge avg", value: "0.89", delta: "\u22120.02", bad: false },
  { metric: "Drift", value: "0.04", delta: null, bad: false },
  { metric: "Latency", value: "940ms", delta: "\u221240ms", bad: false },
  { metric: "Cost", value: "$0.12", delta: "+9%", bad: false },
];

const CHECK_ITEMS = [
  { type: "TOOL", text: "lookup_order called correctly" },
  { type: "TOOL", text: "escalate_to_human not called" },
  { type: "JUDGE", text: "Empathetic tone \u2014 0.92" },
  { type: "PII", text: "No personal data leaked" },
  { type: "DRIFT", text: "0.04 from baseline" },
  { type: "COST", text: "$0.003 per execution" },
];

const GRID_CARDS = [
  { title: "PII detection", desc: "SSNs, credit cards, emails. Custom patterns. Zero tolerance by default." },
  { title: "Schema validation", desc: "JSON Schema on structured outputs. Every run, automatically." },
  { title: "Keyword guardrails", desc: "Words your agent must never say. Phrases it must include." },
  { title: "Multi-model", desc: "Same tests against OpenAI, Anthropic, Gemini, Mistral, Cohere, and Ollama. Compare quality, cost, latency." },
  { title: "CI-native", desc: "JUnit XML, JSON, exit codes. GitHub Actions and GitLab CI ready." },
  { title: "No SDK", desc: "YAML config, CLI execution. Any engineer can read and contribute." },
];

const PROVIDERS = ["OpenAI", "Anthropic", "Gemini", "Mistral", "Cohere", "Ollama"];

// ── Inline code tag (server component) ──

function Cd({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-stone-100 px-1.5 py-px rounded text-[0.88em] font-mono text-stone-700">
      {children}
    </code>
  );
}

// ── Page (server component — no "use client") ──

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:bg-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg">
        Skip to content
      </a>

      <NavBar />

      <main id="main-content">
        {/* ── HERO ── */}
        <div className="relative overflow-hidden">
          <HeroDots />
        <section className="relative z-10 max-w-[560px] mx-auto pt-[100px] sm:pt-36 pb-6 sm:pb-9 px-5 sm:px-6 text-center">
            <p
              className="text-[15px] font-semibold text-indigo-500 mb-3.5 sm:mb-[18px] opacity-0 animate-fade-up"
              style={{ animationDelay: "0.1s" }}
            >
              Testing for AI agents
            </p>
            <h1
              className="text-[30px] sm:text-[40px] lg:text-5xl font-bold tracking-[-0.035em] leading-[1.18] sm:leading-[1.12] text-stone-950 opacity-0 animate-fade-up"
              style={{ animationDelay: "0.2s" }}
            >
              Know what your agent will do before your users do
            </h1>
            <p
              className="text-base text-stone-600 leading-relaxed mt-3.5 sm:mt-[18px] max-w-[400px] mx-auto opacity-0 animate-fade-up"
              style={{ animationDelay: "0.35s" }}
            >
              Regression tests for agentic workflows &mdash; tool calls, output quality, and compliance. Defined in YAML, run in CI.
            </p>
            <div
              className="flex gap-2.5 justify-center mt-6 sm:mt-7 flex-wrap opacity-0 animate-fade-up"
              style={{ animationDelay: "0.5s" }}
            >
              <CopyButton text="npm i -g @kindlm/cli" />
              <a
                href="/docs"
                className="px-5 py-3 rounded-[10px] border border-stone-300 text-stone-700 text-sm font-semibold no-underline min-h-[44px] flex items-center hover:border-stone-400 transition-colors"
              >
                Read the docs
              </a>
            </div>
            <p
              className="text-[13px] text-stone-500 mt-3.5 opacity-0 animate-fade-up"
              style={{ animationDelay: "0.55s" }}
            >
              Open source &middot; MIT &middot; No account needed
            </p>
            <div
              className="flex gap-2.5 sm:gap-4 justify-center flex-wrap mt-[18px] sm:mt-[22px] opacity-0 animate-fade-up"
              style={{ animationDelay: "0.6s" }}
            >
              {PROVIDERS.map((provider) => (
                <span key={provider} className="text-xs font-medium text-stone-500 tracking-wide">
                  {provider}
                </span>
              ))}
            </div>
        </section>
        </div>

        {/* ── Terminal ── */}
        <section className="max-w-[560px] mx-auto pt-3 pb-16 sm:pb-24 px-5 sm:px-6">
          <div className="opacity-0 animate-fade-up" style={{ animationDelay: "0.65s" }}>
            <Terminal />
          </div>
        </section>

        {/* ── PROBLEM ── */}
        <section className="border-t border-stone-200 py-12 sm:py-[72px] px-5 sm:px-6">
          <div className="max-w-[480px] mx-auto">
            <Reveal>
              <p className="text-[13px] font-semibold text-indigo-500 mb-3.5">The problem</p>
              <p className="text-base text-stone-700 leading-[1.7]">
                You deploy a prompt change on Friday. Monday, your agent approves refunds it shouldn&apos;t &mdash; it stopped calling <Cd>lookup_order</Cd> and started hallucinating.
              </p>
              <p className="text-base text-stone-700 leading-[1.7] mt-3.5">
                No errors. No alerts. The output looked fine. The behavior was wrong.
              </p>
              <p className="text-base text-stone-950 leading-[1.7] mt-3.5 font-semibold">
                KindLM catches this before it ships.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="max-w-[960px] mx-auto py-12 sm:pt-16 pb-16 sm:pb-24 px-5 sm:px-6">
          <Reveal>
            <p className="text-[13px] font-semibold text-indigo-500 mb-2.5">How it works</p>
            <h2 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.03em]">
              Describe what should happen. Run it.
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mt-6 sm:mt-9">
            <Reveal delay={60}>
              <p className="text-[11px] font-semibold text-stone-500 tracking-[0.06em] uppercase mb-2">
                You write this
              </p>
              <div className="bg-stone-900 rounded-xl p-3.5 sm:px-[22px] sm:py-[18px] font-mono text-[11px] sm:text-xs leading-[1.8] overflow-x-auto touch-pan-x">
                {YAML_LINES.map((line, i) => (
                  <div
                    key={i}
                    className="whitespace-pre-wrap break-words"
                    style={{ color: line.color }}
                  >
                    {line.text || "\u00A0"}
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={120}>
              <p className="text-[11px] font-semibold text-stone-500 tracking-[0.06em] uppercase mb-2">
                KindLM checks this
              </p>
              <div className="bg-white rounded-xl p-3.5 sm:p-[18px] border border-stone-200">
                {CHECK_ITEMS.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 py-2 ${i < CHECK_ITEMS.length - 1 ? "border-b border-stone-100" : ""}`}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    <span className="text-[10px] font-semibold text-stone-500 min-w-[34px] tracking-wide">
                      {item.type}
                    </span>
                    <span className="text-xs sm:text-[13px] font-mono text-stone-700">
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="max-w-[960px] mx-auto px-5 sm:px-6">
          <Reveal>
            <p className="text-[13px] font-semibold text-indigo-500 mb-1">Capabilities</p>
          </Reveal>

          {/* Tool calls */}
          <Reveal delay={30}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-10 py-8 sm:py-11 border-t border-stone-200">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-[-0.02em] mb-2.5">
                  Every tool call. Every argument.
                </h3>
                <p className="text-base text-stone-600 leading-[1.65]">
                  Assert which tools were called, in what order, with what arguments. Define tools that must never be called. Test the decisions, not just the output.
                </p>
              </div>
              <div className="bg-stone-900 rounded-xl p-3.5 sm:px-[22px] sm:py-[18px] font-mono text-[11px] sm:text-xs leading-[1.85] overflow-x-auto">
                {TOOL_CALL_CODE.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap" style={{ color: line.c }}>
                    {line.t}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Judge */}
          <Reveal delay={30}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-10 py-8 sm:py-11 border-t border-stone-200">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-[-0.02em] mb-2.5">
                  Quality you can measure.
                </h3>
                <p className="text-base text-stone-600 leading-[1.65]">
                  An LLM judge scores each criterion from 0 to 1 &mdash; and explains why. Set thresholds. When a score drops, you know exactly which criterion failed.
                </p>
              </div>
              <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-stone-200">
                {JUDGE_DATA.map((item, i) => (
                  <div
                    key={i}
                    className={`py-3 ${i < JUDGE_DATA.length - 1 ? "border-b border-stone-100" : ""}`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm text-stone-700 flex-1">{item.criteria}</span>
                      <span
                        className={`text-[13px] font-semibold font-mono shrink-0 ${item.pass ? "text-green-600" : "text-red-600"}`}
                      >
                        {item.score.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-[3px] rounded-sm bg-stone-100 overflow-hidden">
                      <div
                        className={`h-full rounded-sm ${item.pass ? "bg-green-500" : "bg-red-500"}`}
                        style={{ width: `${item.score * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Drift */}
          <Reveal delay={30}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-10 py-8 sm:py-11 border-t border-stone-200">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-[-0.02em] mb-2.5">
                  See exactly what changed.
                </h3>
                <p className="text-base text-stone-600 leading-[1.65]">
                  Save a baseline. Run again after any change. KindLM compares semantically &mdash; not string diffs. Cost, latency, and quality tracked together.
                </p>
              </div>
              <div className="bg-white rounded-xl p-3.5 sm:p-5 border border-stone-200">
                <p className="text-[11px] font-semibold text-stone-500 tracking-[0.06em] uppercase mb-3">
                  vs. baseline &middot; Feb 10
                </p>
                {DRIFT_DATA.map((item, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center py-[7px] ${i < DRIFT_DATA.length - 1 ? "border-b border-stone-100" : ""}`}
                  >
                    <span className="text-sm text-stone-600">{item.metric}</span>
                    <div className="flex gap-2.5 items-center">
                      <span className="font-mono text-[13px] text-stone-700 font-medium">
                        {item.value}
                      </span>
                      {item.delta && (
                        <span
                          className={`font-mono text-xs ${item.bad ? "text-red-600 font-semibold" : "text-stone-500"}`}
                        >
                          {item.delta}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── MORE ── */}
        <section className="max-w-[960px] mx-auto px-5 sm:px-6 pt-10 sm:pt-14 pb-16 sm:pb-24">
          <Reveal>
            <p className="text-[13px] font-semibold text-indigo-500 mb-4">More</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-stone-200 rounded-xl overflow-hidden border border-stone-200">
            {GRID_CARDS.map((card, i) => (
              <Reveal key={i} delay={i * 25}>
                <div className="bg-white p-5 sm:px-[22px] sm:py-6">
                  <p className="text-sm font-semibold mb-1">{card.title}</p>
                  <p className="text-[13px] text-stone-500 leading-snug">{card.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── COMPLIANCE ── */}
        <section className="border-t border-stone-200 py-12 sm:py-[72px] px-5 sm:px-6">
          <div className="max-w-[460px] mx-auto text-center">
            <Reveal>
              <p className="text-[13px] font-semibold text-indigo-500 mb-2.5">
                EU AI Act &middot; August 2026
              </p>
              <h2 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.025em] mb-3">
                An auditor asks for test records. You have them.
              </h2>
              <p className="text-base text-stone-600 leading-relaxed max-w-[380px] mx-auto mb-5">
                Add <Cd>--compliance</Cd> to any run. Annex IV&ndash;mapped docs, timestamped and hashed.
              </p>
              <div className="inline-flex flex-col gap-[3px] bg-stone-900 rounded-[10px] p-3 sm:px-5 sm:py-3.5 font-mono text-[11.5px] sm:text-[13px] text-stone-500 text-left">
                <span>
                  <span className="text-stone-300">$</span> kindlm test --compliance
                </span>
                <span className="text-green-400">
                  &nbsp; &rarr; compliance-2026-02-15.md
                </span>
                <span className="text-stone-600">
                  &nbsp; SHA-256: a1b2c3...e5f6
                </span>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="max-w-[460px] mx-auto px-5 sm:px-6 pt-10 sm:pt-14 pb-16 sm:pb-20 text-center">
          <Reveal>
            <h2 className="text-[22px] sm:text-[28px] font-bold tracking-[-0.025em] mb-2.5">
              Three lines of YAML. One command.
            </h2>
            <p className="text-base text-stone-600 mb-6">
              Open source. No account required.
            </p>
            <div className="flex gap-2.5 justify-center flex-wrap">
              <CopyButton text="npm i -g @kindlm/cli" />
              <a
                href="/docs"
                className="px-5 py-3 rounded-[10px] border border-stone-300 text-stone-700 text-sm font-semibold no-underline min-h-[44px] flex items-center hover:border-stone-400 transition-colors"
              >
                Read the docs
              </a>
            </div>
          </Reveal>
        </section>

        {/* ── CROSS-PROMOTION ── */}
        <section className="max-w-[480px] mx-auto px-5 sm:px-6 pb-16 sm:pb-20">
          <Reveal>
            <p className="text-[13px] font-semibold text-stone-400 mb-3">
              More tools by{" "}
              <a
                href="https://kindlmann.com"
                target="_blank"
                rel="noopener"
                className="text-stone-400 underline underline-offset-2 hover:text-stone-600 transition-colors"
              >
                Petr Kindlmann
              </a>
            </p>
            <div className="flex flex-col gap-1.5 text-[13px] text-stone-500 leading-relaxed">
              <p>
                <a href="https://breakit.dev" target="_blank" rel="noopener" className="text-stone-600 font-medium no-underline hover:text-stone-800 transition-colors">breakit</a>
                {" "}&mdash; 25 AI personas test your website with real Playwright browsers
              </p>
              <p>
                <a href="https://www.npmjs.com/package/complytest" target="_blank" rel="noopener" className="text-stone-600 font-medium no-underline hover:text-stone-800 transition-colors">ComplyTest</a>
                {" "}&mdash; compliance scanner for GDPR, WCAG 2.2, and security
              </p>
              <p>
                <a href="https://www.npmjs.com/package/pw-doctor" target="_blank" rel="noopener" className="text-stone-600 font-medium no-underline hover:text-stone-800 transition-colors">pw-doctor</a>
                {" "}&mdash; AI-assisted Playwright selector maintenance
              </p>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="px-5 sm:px-6 py-4 border-t border-stone-200">
        <div className="max-w-[960px] mx-auto flex justify-between items-center flex-wrap gap-2">
          <span className="text-[13px] text-stone-500">
            <strong className="text-stone-500 font-semibold">kindlm</strong> &middot; MIT &middot; Built by{" "}
            <a
              href="https://kindlmann.com"
              target="_blank"
              rel="noopener"
              className="text-stone-500 no-underline hover:text-stone-700 transition-colors"
            >
              Petr Kindlmann
            </a>
          </span>
          <div className="flex gap-3.5">
            <a
              href="https://github.com/kindlm/kindlm"
              target="_blank"
              rel="noopener"
              className="text-stone-500 no-underline text-[13px] py-2 px-1 hover:text-stone-700 transition-colors min-h-[44px] flex items-center"
            >
              GitHub
            </a>
            <a
              href="/blog"
              className="text-stone-500 no-underline text-[13px] py-2 px-1 hover:text-stone-700 transition-colors min-h-[44px] flex items-center"
            >
              Blog
            </a>
            <a
              href="/docs"
              className="text-stone-500 no-underline text-[13px] py-2 px-1 hover:text-stone-700 transition-colors min-h-[44px] flex items-center"
            >
              Docs
            </a>
            <a
              href="https://www.npmjs.com/package/@kindlm/cli"
              target="_blank"
              rel="noopener"
              className="text-stone-500 no-underline text-[13px] py-2 px-1 hover:text-stone-700 transition-colors min-h-[44px] flex items-center"
            >
              npm
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
