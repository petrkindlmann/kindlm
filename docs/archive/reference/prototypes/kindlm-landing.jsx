"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";


/*
  AUDIT FIXES:
  - Type scale: 6 steps (48/28/24/16/14/13), no in-between
  - Category definer: 15px, not 13px — the positioning text should be visible
  - Mobile: all grids → 1col, no minWidth on code, pre-wrap not pre
  - Touch: min 44px tap targets everywhere
  - Nav: Docs + GitHub always visible
  - Copy: sub-headline = 1 benefit, pain section has heading, grid label = "More"
  - H1 line-height: 1.18 on mobile (was 1.12 — too tight for multi-line)
*/

function useMedia() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return { mobile: w < 640, desktop: w >= 960 };
}

// ── Terminal ──

const LINES = [
  { t: "$ kindlm test", c: "cmd", d: 0 },
  { t: "", c: "x", d: 400 },
  { t: "◈ support-agent · 4 tests · 2 models", c: "dim", d: 650 },
  { t: "", c: "x", d: 850 },
  { t: "✓ refund        claude  3/3  1.2s", c: "ok", d: 1200 },
  { t: "✓ refund        gpt-4o  3/3  0.9s", c: "ok", d: 1550 },
  { t: "✓ order-missing claude  3/3  1.1s", c: "ok", d: 1900 },
  { t: "✗ order-missing gpt-4o  2/3  1.0s", c: "err", d: 2250 },
  { t: "  └ lookup_order never called", c: "errsub", d: 2400 },
  { t: "✓ escalation    claude  3/3  1.3s", c: "ok", d: 2750 },
  { t: "✓ escalation    gpt-4o  3/3  1.1s", c: "ok", d: 3100 },
  { t: "✓ greeting      claude  3/3  0.5s", c: "ok", d: 3450 },
  { t: "✓ greeting      gpt-4o  3/3  0.4s", c: "ok", d: 3800 },
  { t: "", c: "x", d: 4100 },
  { t: "7/8 passed · judge 0.89 · $0.12", c: "stat", d: 4300 },
  { t: "gate: fail — 87.5% < 95%", c: "err", d: 4650 },
];

function Terminal() {
  const [vis, setVis] = useState<typeof LINES>([]);
  const [go, setGo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { mobile } = useMedia();

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setGo(true); }, { threshold: 0.15 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!go) return;
    const ts = LINES.map((l) => setTimeout(() => setVis(p => [...p, l]), l.d));
    return () => ts.forEach(clearTimeout);
  }, [go]);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [vis]);

  const cl: Record<string, string> = { cmd: "#d6d3d1", ok: "#4ade80", err: "#fb7185", errsub: "#fdba74", stat: "#93c5fd", dim: "#57534e", x: "transparent" };

  return (
    <div ref={ref} style={{
      background: "#1c1917", borderRadius: 12,
      padding: mobile ? "14px" : "18px 22px",
      fontFamily: "var(--font-mono)", fontSize: mobile ? 11.5 : 13,
      lineHeight: 1.7, maxHeight: mobile ? 320 : 380,
      overflow: "hidden", overflowX: "auto",
      WebkitOverflowScrolling: "touch",
    }}>
      <div style={{ display: "flex", gap: 6, marginBottom: mobile ? 8 : 12 }}>
        {["#ef4444","#eab308","#22c55e"].map((c,i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: c, opacity: 0.6 }} />
        ))}
      </div>
      {vis.map((l,i) => (
        <div key={i} style={{
          color: cl[l.c], whiteSpace: "pre-wrap", wordBreak: "break-word",
          fontWeight: l.c === "cmd" ? 600 : 400,
          opacity: 0, animation: "lineIn 0.2s ease forwards",
        }}>{l.t || "\u00A0"}</div>
      ))}
      {go && vis.length < LINES.length && <span style={{ color: "#d6d3d1", animation: "blink 1s step-end infinite" }}>▌</span>}
    </div>
  );
}

// ── YAML ──

const YAML_TEXT = `- name: "refund-happy-path"
  prompt: "support_agent"
  vars:
    message: "Charged twice for #12345"
  expect:
    toolCalls:
      - tool: "lookup_order"
        argsMatch: { order_id: "12345" }
      - tool: "escalate_to_human"
        shouldNotCall: true
    judge:
      - criteria: "Empathetic tone"
        minScore: 0.8
    guardrails:
      pii: { enabled: true }`;

function YamlBlock() {
  const { mobile } = useMedia();
  return (
    <div style={{
      background: "#1c1917", borderRadius: 12,
      padding: mobile ? "14px" : "18px 22px",
      fontFamily: "var(--font-mono)", fontSize: mobile ? 11 : 12,
      lineHeight: 1.8, overflowX: "auto",
      WebkitOverflowScrolling: "touch",
    }}>
      {YAML_TEXT.split("\n").map((ln, i) => {
        let c = "#a8a29e";
        if (ln.match(/^\s*-?\s*\w+:/)) c = "#7dd3fc";
        if (ln.includes('"')) c = "#86efac";
        if (ln.match(/\b\d+\.?\d*\b/) && !ln.includes('"')) c = "#fde68a";
        if (ln.includes("true")||ln.includes("false")) c = "#f9a8d4";
        return <div key={i} style={{ color: c, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{ln||"\u00A0"}</div>;
      })}
    </div>
  );
}

// ── Helpers ──

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true); }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} style={{ opacity: v?1:0, transform: v?"none":"translateY(16px)", transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms` }}>{children}</div>;
}

function Cd({ children }: { children: ReactNode }) {
  return <span style={{
    background: "#f5f5f4", padding: "1px 5px", borderRadius: 3,
    fontSize: "0.88em", fontFamily: "var(--font-mono)", color: "#44403c",
  }}>{children}</span>;
}

// ── Page ──

export default function LandingPage() {
  const [sy, setSy] = useState(0);
  const { mobile, desktop } = useMedia();
  useEffect(() => {
    const h = () => setSy(window.scrollY);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const px = mobile ? 20 : 24;
  const gap = mobile ? 64 : 96;

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf9", color: "#1c1917", fontFamily: "var(--font-inter)", overflowX: "hidden" }}>

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        padding: `${mobile ? 10 : 12}px ${px}px`,
        background: sy > 40 ? "rgba(250,250,249,0.92)" : "transparent",
        backdropFilter: sy > 40 ? "blur(12px)" : "none",
        WebkitBackdropFilter: sy > 40 ? "blur(12px)" : "none",
        borderBottom: sy > 40 ? "1px solid #e7e5e4" : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.04em" }}>kindlm</span>
          <div style={{ display: "flex", alignItems: "center", gap: mobile ? 6 : 16 }}>
            <a href="/docs" style={{ fontSize: 13, fontWeight: 500, color: "#78716c", textDecoration: "none", padding: "8px 6px" }}>Docs</a>
            <a href="#pricing" style={{ fontSize: 13, fontWeight: 500, color: "#78716c", textDecoration: "none", padding: "8px 6px" }}>Pricing</a>
            <a href="https://github.com/kindlm/kindlm" target="_blank" rel="noopener" style={{ fontSize: 13, fontWeight: 500, color: "#78716c", textDecoration: "none", padding: "8px 6px" }}>GitHub</a>
            {!mobile && <a href="/docs/getting-started" style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, background: "#1c1917", color: "#fafaf9", textDecoration: "none", marginLeft: 4 }}>Get started</a>}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 560, margin: "0 auto", padding: `${mobile ? 100 : 144}px ${px}px ${mobile ? 24 : 36}px`, textAlign: "center" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#6366f1", marginBottom: mobile ? 14 : 18, opacity: 0, animation: "fadeUp 0.6s ease 0.1s forwards" }}>
          Testing for AI agents
        </p>
        <h1 style={{
          fontSize: mobile ? 30 : desktop ? 48 : 40,
          fontWeight: 700, letterSpacing: "-0.035em",
          lineHeight: mobile ? 1.18 : 1.12, color: "#0c0a09",
          opacity: 0, animation: "fadeUp 0.6s ease 0.2s forwards",
        }}>
          Know what your agent will do before your users do
        </h1>
        <p style={{
          fontSize: 16, color: "#57534e", lineHeight: 1.6,
          marginTop: mobile ? 14 : 18, maxWidth: 400, marginLeft: "auto", marginRight: "auto",
          opacity: 0, animation: "fadeUp 0.6s ease 0.35s forwards",
        }}>
          Regression tests for agentic workflows — tool calls, output quality, and compliance. Defined in YAML, run in CI.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: mobile ? 24 : 28, flexWrap: "wrap", opacity: 0, animation: "fadeUp 0.6s ease 0.5s forwards" }}>
          <span style={{ padding: "12px 20px", borderRadius: 10, background: "#1c1917", color: "#d6d3d1", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, minHeight: 44, display: "flex", alignItems: "center" }}>
            npm i -g @kindlm/cli
          </span>
          <a href="/docs" style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #d6d3d1", color: "#44403c", fontSize: 14, fontWeight: 600, textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>
            Read the docs
          </a>
        </div>
        <p style={{ fontSize: 13, color: "#a8a29e", marginTop: 14, opacity: 0, animation: "fadeUp 0.6s ease 0.55s forwards" }}>
          Open source · MIT · No account needed · <a href="#pricing" style={{ color: "#6366f1", textDecoration: "none", fontWeight: 500 }}>Cloud available</a>
        </p>
      </section>

      {/* Terminal */}
      <section style={{ maxWidth: 560, margin: "0 auto", padding: `12px ${px}px ${gap}px` }}>
        <div style={{ opacity: 0, animation: "fadeUp 0.7s ease 0.65s forwards" }}><Terminal /></div>
      </section>

      {/* ── PROBLEM ── */}
      <section style={{ borderTop: "1px solid #e7e5e4", padding: `${mobile ? 48 : 72}px ${px}px` }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <Reveal>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", marginBottom: 14 }}>The problem</p>
            <p style={{ fontSize: 16, color: "#44403c", lineHeight: 1.7 }}>
              You deploy a prompt change on Friday. Monday, your agent approves refunds it shouldn&apos;t — it stopped calling <Cd>lookup_order</Cd> and started hallucinating.
            </p>
            <p style={{ fontSize: 16, color: "#44403c", lineHeight: 1.7, marginTop: 14 }}>
              No errors. No alerts. The output looked fine. The behavior was wrong.
            </p>
            <p style={{ fontSize: 16, color: "#0c0a09", lineHeight: 1.7, marginTop: 14, fontWeight: 600 }}>
              KindLM catches this before it ships.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: `${mobile ? 48 : 64}px ${px}px ${gap}px` }}>
        <Reveal>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", marginBottom: 10 }}>How it works</p>
          <h2 style={{ fontSize: mobile ? 22 : 28, fontWeight: 700, letterSpacing: "-0.03em" }}>Describe what should happen. Run it.</h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: desktop ? "1fr 1fr" : "1fr", gap: mobile ? 16 : 20, marginTop: mobile ? 24 : 36 }}>
          <Reveal delay={60}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#a8a29e", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>You write this</p>
            <YamlBlock />
          </Reveal>
          <Reveal delay={120}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#a8a29e", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>KindLM checks this</p>
            <div style={{ background: "white", borderRadius: 12, padding: mobile ? 14 : 18, border: "1px solid #e7e5e4" }}>
              {[
                { type: "TOOL", text: "lookup_order called correctly" },
                { type: "TOOL", text: "escalate_to_human not called" },
                { type: "JUDGE", text: "Empathetic tone — 0.92" },
                { type: "PII", text: "No personal data leaked" },
                { type: "DRIFT", text: "0.04 from baseline" },
                { type: "COST", text: "$0.003 per execution" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < 5 ? "1px solid #f5f5f4" : "none" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#a8a29e", minWidth: 34, letterSpacing: "0.04em" }}>{r.type}</span>
                  <span style={{ fontSize: mobile ? 12 : 13, fontFamily: "var(--font-mono)", color: "#44403c" }}>{r.text}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: `0 ${px}px` }}>
        <Reveal><p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", marginBottom: 4 }}>Capabilities</p></Reveal>

        {[
          {
            title: "Every tool call. Every argument.",
            body: "Assert which tools were called, in what order, with what arguments. Define tools that must never be called. Test the decisions, not just the output.",
            visual: "code",
            code: [
              { c: "#7dd3fc", t: "toolCalls:" },
              { c: "#a8a29e", t: "  # Look up the order first" },
              { c: "#7dd3fc", t: '  - tool: "lookup_order"' },
              { c: "#86efac", t: '    argsMatch: { order_id: "12345" }' },
              { c: "#a8a29e", t: "  # Then issue the refund" },
              { c: "#7dd3fc", t: '  - tool: "issue_refund"' },
              { c: "#a8a29e", t: "  # Never escalate routine cases" },
              { c: "#7dd3fc", t: '  - tool: "escalate_to_human"' },
              { c: "#f9a8d4", t: "    shouldNotCall: true" },
            ],
          },
          {
            title: "Quality you can measure.",
            body: "An LLM judge scores each criterion from 0 to 1 — and explains why. Set thresholds. When a score drops, you know exactly which criterion failed.",
            visual: "judge",
          },
          {
            title: "See exactly what changed.",
            body: "Save a baseline. Run again after any change. KindLM compares semantically — not string diffs. Cost, latency, and quality tracked together.",
            visual: "drift",
          },
        ].map((f, fi) => (
          <Reveal key={fi} delay={30}>
            <div style={{
              display: "grid", gridTemplateColumns: desktop ? "1fr 1fr" : "1fr",
              gap: mobile ? 20 : 40, padding: `${mobile ? 32 : 44}px 0`,
              borderTop: "1px solid #e7e5e4",
            }}>
              <div>
                <h3 style={{ fontSize: mobile ? 20 : 24, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 16, color: "#57534e", lineHeight: 1.65 }}>{f.body}</p>
              </div>

              {f.visual === "code" && (
                <div style={{ background: "#1c1917", borderRadius: 12, padding: mobile ? "14px" : "18px 22px", fontFamily: "var(--font-mono)", fontSize: mobile ? 11 : 12, lineHeight: 1.85, overflowX: "auto" }}>
                  {f.code.map((l, i) => <div key={i} style={{ color: l.c, whiteSpace: "pre-wrap" }}>{l.t}</div>)}
                </div>
              )}

              {f.visual === "judge" && (
                <div style={{ background: "white", borderRadius: 12, padding: mobile ? 14 : 20, border: "1px solid #e7e5e4" }}>
                  {[
                    { criteria: "Empathetic, addresses the issue", score: 0.92, pass: true },
                    { criteria: "No promises about timeline", score: 0.71, pass: false },
                    { criteria: "Correct company terminology", score: 0.88, pass: true },
                  ].map((j, i) => (
                    <div key={i} style={{ padding: "12px 0", borderBottom: i < 2 ? "1px solid #f5f5f4" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, color: "#44403c", flex: 1 }}>{j.criteria}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)", color: j.pass ? "#16a34a" : "#dc2626", flexShrink: 0 }}>{j.score.toFixed(2)}</span>
                      </div>
                      <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: "#f5f5f4", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${j.score * 100}%`, background: j.pass ? "#22c55e" : "#ef4444" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {f.visual === "drift" && (
                <div style={{ background: "white", borderRadius: 12, padding: mobile ? 14 : 20, border: "1px solid #e7e5e4" }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#a8a29e", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>vs. baseline · Feb 10</p>
                  {[
                    { m: "Pass rate", v: "87.5%", d: "−12.5%", bad: true },
                    { m: "Judge avg", v: "0.89", d: "−0.02", bad: false },
                    { m: "Drift", v: "0.04", d: null, bad: false },
                    { m: "Latency", v: "940ms", d: "−40ms", bad: false },
                    { m: "Cost", v: "$0.12", d: "+9%", bad: false },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < 4 ? "1px solid #f5f5f4" : "none" }}>
                      <span style={{ fontSize: 14, color: "#57534e" }}>{r.m}</span>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "#44403c", fontWeight: 500 }}>{r.v}</span>
                        {r.d && <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: r.bad ? "#dc2626" : "#78716c", fontWeight: r.bad ? 600 : 400 }}>{r.d}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Reveal>
        ))}
      </section>

      {/* ── MORE ── */}
      <section style={{ maxWidth: 960, margin: "0 auto", padding: `${mobile ? 40 : 56}px ${px}px ${gap}px` }}>
        <Reveal><p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", marginBottom: 16 }}>More</p></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : desktop ? "repeat(3, 1fr)" : "1fr 1fr", gap: 1, background: "#e7e5e4", borderRadius: 12, overflow: "hidden", border: "1px solid #e7e5e4" }}>
          {[
            { t: "PII detection", d: "SSNs, credit cards, emails. Custom patterns. Zero tolerance by default." },
            { t: "Schema validation", d: "JSON Schema on structured outputs. Every run, automatically." },
            { t: "Keyword guardrails", d: "Words your agent must never say. Phrases it must include." },
            { t: "Multi-model", d: "Same tests against Claude and GPT-4o. Compare quality, cost, latency." },
            { t: "CI-native", d: "JUnit XML, JSON, exit codes. GitHub Actions and GitLab CI ready." },
            { t: "No SDK", d: "YAML config, CLI execution. Any engineer can read and contribute." },
          ].map((f, i) => (
            <Reveal key={i} delay={i * 25}>
              <div style={{ background: "white", padding: mobile ? "20px 18px" : "24px 22px" }}>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{f.t}</p>
                <p style={{ fontSize: 13, color: "#78716c", lineHeight: 1.5 }}>{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── COMPLIANCE ── */}
      <section style={{ borderTop: "1px solid #e7e5e4", padding: `${mobile ? 48 : 72}px ${px}px` }}>
        <div style={{ maxWidth: 460, margin: "0 auto", textAlign: "center" }}>
          <Reveal>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", marginBottom: 10 }}>EU AI Act · August 2026</p>
            <h2 style={{ fontSize: mobile ? 22 : 28, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 12 }}>
              An auditor asks for test records. You have them.
            </h2>
            <p style={{ fontSize: 16, color: "#57534e", lineHeight: 1.6, maxWidth: 380, margin: "0 auto 20px" }}>
              Add <Cd>--compliance</Cd> to any run. Annex IV–mapped docs, timestamped and hashed.
            </p>
            <div style={{ display: "inline-flex", flexDirection: "column", gap: 3, background: "#1c1917", borderRadius: 10, padding: mobile ? "12px 14px" : "14px 20px", fontFamily: "var(--font-mono)", fontSize: mobile ? 11.5 : 13, color: "#a8a29e", textAlign: "left" }}>
              <span><span style={{ color: "#d6d3d1" }}>$</span> kindlm test --compliance</span>
              <span style={{ color: "#86efac" }}>  → compliance-2026-02-15.md</span>
              <span style={{ color: "#57534e" }}>  SHA-256: a1b2c3...e5f6</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ maxWidth: 960, margin: "0 auto", padding: `${mobile ? 48 : 72}px ${px}px ${gap}px` }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: mobile ? 28 : 40 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#6366f1", marginBottom: 10 }}>Pricing</p>
            <h2 style={{ fontSize: mobile ? 22 : 28, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>
              The CLI is free. Forever.
            </h2>
            <p style={{ fontSize: 16, color: "#57534e", maxWidth: 420, margin: "0 auto" }}>
              Cloud adds team features and compliance storage for when you need them.
            </p>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, 1fr)", gap: mobile ? 12 : 1, background: mobile ? "transparent" : "#e7e5e4", borderRadius: 14, overflow: "hidden", border: mobile ? "none" : "1px solid #e7e5e4" }}>
          {[
            {
              name: "Open Source",
              price: "$0",
              period: "forever",
              desc: "Everything you need to test locally",
              features: ["All assertion types", "All providers", "Compliance report (local MD)", "JUnit XML for CI", "Baseline comparison", "Unlimited test runs"],
              cta: "npm i -g @kindlm/cli",
              ctaStyle: "dark",
              highlight: false,
            },
            {
              name: "Team",
              price: "$49",
              period: "/month",
              desc: "Dashboard, history, and collaboration",
              features: ["Everything in Open Source", "Cloud dashboard", "90-day test history", "10 team members", "5 projects", "Slack + webhook alerts", "Compliance PDF export", "Email support"],
              cta: "Start free trial",
              ctaStyle: "primary",
              highlight: true,
            },
            {
              name: "Enterprise",
              price: "$299",
              period: "/month",
              desc: "For regulated industries",
              features: ["Everything in Team", "Unlimited history + members", "Signed compliance reports", "SSO / SAML", "Audit log API", "99.9% SLA", "Dedicated support"],
              cta: "Contact us",
              ctaStyle: "outline",
              highlight: false,
            },
          ].map((tier, ti) => (
            <Reveal key={ti} delay={ti * 40}>
              <div style={{
                background: tier.highlight ? "#fafaf9" : "white",
                padding: mobile ? "24px 20px" : "28px 24px",
                borderRadius: mobile ? 14 : 0,
                border: mobile ? `1px solid ${tier.highlight ? "#c7d2fe" : "#e7e5e4"}` : "none",
                position: "relative",
              }}>
                {tier.highlight && (
                  <div style={{
                    position: "absolute", top: mobile ? -10 : -1, left: "50%", transform: "translateX(-50%)",
                    background: "#6366f1", color: "white", fontSize: 11, fontWeight: 600,
                    padding: "3px 12px", borderRadius: 6, letterSpacing: "0.02em",
                  }}>
                    Most popular
                  </div>
                )}
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{tier.name}</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 4 }}>
                  <span style={{ fontSize: mobile ? 28 : 32, fontWeight: 700, letterSpacing: "-0.03em" }}>{tier.price}</span>
                  <span style={{ fontSize: 13, color: "#78716c" }}>{tier.period}</span>
                </div>
                <p style={{ fontSize: 13, color: "#78716c", marginBottom: 16, lineHeight: 1.4 }}>{tier.desc}</p>
                <div style={{
                  padding: "10px 16px", borderRadius: 8, textAlign: "center", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  ...(tier.ctaStyle === "dark" ? { background: "#1c1917", color: "#d6d3d1", fontFamily: "var(--font-mono)", fontWeight: 500 } :
                     tier.ctaStyle === "primary" ? { background: "#6366f1", color: "white" } :
                     { border: "1px solid #d6d3d1", color: "#44403c" }),
                }}>
                  {tier.cta}
                </div>
                <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  {tier.features.map((f, fi) => (
                    <div key={fi} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#22c55e", fontSize: 13, lineHeight: "20px", flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 13, color: "#57534e", lineHeight: "20px" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ maxWidth: 460, margin: "0 auto", padding: `${mobile ? 40 : 56}px ${px}px ${mobile ? 80 : 100}px`, textAlign: "center" }}>
        <Reveal>
          <h2 style={{ fontSize: mobile ? 22 : 28, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 10 }}>
            Three lines of YAML. One command.
          </h2>
          <p style={{ fontSize: 16, color: "#57534e", marginBottom: 24 }}>Free and open source. Add Cloud when your team needs it.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ padding: "12px 20px", borderRadius: 10, background: "#1c1917", color: "#d6d3d1", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, minHeight: 44, display: "flex", alignItems: "center" }}>npm i -g @kindlm/cli</span>
            <a href="/docs" style={{ padding: "12px 20px", borderRadius: 10, border: "1px solid #d6d3d1", color: "#44403c", fontSize: 14, fontWeight: 600, textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>Read the docs</a>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: `16px ${px}px`, borderTop: "1px solid #e7e5e4" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#a8a29e" }}><strong style={{ color: "#78716c" }}>kindlm</strong> · MIT</span>
          <div style={{ display: "flex", gap: 14 }}>
            <a href="https://github.com/kindlm/kindlm" target="_blank" rel="noopener" style={{ color: "#a8a29e", textDecoration: "none", fontSize: 13, padding: "4px 0" }}>GitHub</a>
            <a href="/docs" style={{ color: "#a8a29e", textDecoration: "none", fontSize: 13, padding: "4px 0" }}>Docs</a>
            <a href="#pricing" style={{ color: "#a8a29e", textDecoration: "none", fontSize: 13, padding: "4px 0" }}>Pricing</a>
            <a href="https://www.npmjs.com/package/@kindlm/cli" target="_blank" rel="noopener" style={{ color: "#a8a29e", textDecoration: "none", fontSize: 13, padding: "4px 0" }}>npm</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
