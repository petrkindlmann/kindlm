"use client";

import { useState, useEffect, useRef } from "react";

const LINES = [
  { t: "$ kindlm test", c: "cmd", d: 0 },
  { t: "", c: "x", d: 400 },
  { t: "\u25C8 support-agent \u00B7 4 tests \u00B7 3 models", c: "dim", d: 650 },
  { t: "", c: "x", d: 850 },
  { t: "\u2713 refund        claude  3/3  1.2s", c: "ok", d: 1200 },
  { t: "\u2713 refund        gpt-4o  3/3  0.9s", c: "ok", d: 1550 },
  { t: "\u2713 order-missing claude  3/3  1.1s", c: "ok", d: 1900 },
  { t: "\u2717 order-missing gpt-4o  2/3  1.0s", c: "err", d: 2250 },
  { t: "  \u2514 lookup_order never called", c: "errsub", d: 2400 },
  { t: "\u2713 escalation    gemini  3/3  0.8s", c: "ok", d: 2750 },
  { t: "\u2713 escalation    gpt-4o  3/3  1.1s", c: "ok", d: 3100 },
  { t: "\u2713 greeting      claude  3/3  0.5s", c: "ok", d: 3450 },
  { t: "\u2713 greeting      gpt-4o  3/3  0.4s", c: "ok", d: 3800 },
  { t: "", c: "x", d: 4100 },
  { t: "7/8 passed \u00B7 judge 0.89 \u00B7 $0.12", c: "stat", d: 4300 },
  { t: "gate: fail \u2014 87.5% < 95%", c: "err", d: 4650 },
];

const COLORS: Record<string, string> = {
  cmd: "#d6d3d1",
  ok: "#4ade80",
  err: "#fb7185",
  errsub: "#fdba74",
  stat: "#93c5fd",
  dim: "#57534e",
  x: "transparent",
};

export function Terminal() {
  const [visible, setVisible] = useState<typeof LINES>([]);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStarted(true);
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      setVisible(LINES);
      return;
    }

    const timers = LINES.map((line) =>
      setTimeout(() => setVisible((prev) => [...prev, line]), line.d),
    );
    return () => timers.forEach(clearTimeout);
  }, [started]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Animated terminal showing kindlm test output: 7 of 8 tests passing across Claude, GPT-4o, and Gemini"
      className="bg-stone-900 rounded-xl p-3.5 sm:px-[22px] sm:py-[18px] font-mono text-[11.5px] sm:text-[13px] leading-[1.7] max-h-[320px] sm:max-h-[380px] overflow-hidden overflow-x-auto touch-pan-x"
    >
      <div className="flex gap-1.5 mb-2 sm:mb-3">
        {["#ef4444", "#eab308", "#22c55e"].map((color) => (
          <div
            key={color}
            className="w-2 h-2 rounded-full opacity-60"
            style={{ background: color }}
          />
        ))}
      </div>
      {visible.map((line, i) => (
        <div
          key={i}
          className="whitespace-pre-wrap break-words animate-line-in motion-reduce:animate-none motion-reduce:opacity-100"
          style={{
            color: COLORS[line.c],
            fontWeight: line.c === "cmd" ? 600 : 400,
          }}
        >
          {line.t || "\u00A0"}
        </div>
      ))}
      {started && visible.length < LINES.length && (
        <span className="text-stone-300 animate-blink motion-reduce:animate-none">
          \u258C
        </span>
      )}
    </div>
  );
}
