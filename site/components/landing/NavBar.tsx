"use client";

import { useState, useEffect } from "react";

export function NavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 40;
      setScrolled((prev) => (prev !== next ? next : prev));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Main navigation"
      className={`fixed top-0 left-0 right-0 z-50 px-5 py-2.5 sm:px-6 sm:py-3 transition-all duration-300 ${
        scrolled
          ? "bg-stone-50/95 backdrop-blur-xl border-b border-stone-200"
          : "border-b border-transparent"
      }`}
    >
      <div className="max-w-[960px] mx-auto flex justify-between items-center">
        <a href="/" className="font-bold text-base tracking-[-0.04em] no-underline text-stone-900">
          kindlm
        </a>
        <div className="flex items-center gap-1.5 sm:gap-4">
          <a
            href="/docs"
            className="text-[13px] font-medium text-stone-500 no-underline p-2 hover:text-stone-700 transition-colors"
          >
            Docs
          </a>
          <a
            href="https://github.com/kindlm/kindlm"
            target="_blank"
            rel="noopener"
            className="text-[13px] font-medium text-stone-500 no-underline p-2 hover:text-stone-700 transition-colors"
          >
            GitHub
          </a>
          <a
            href="/docs/getting-started"
            className="hidden sm:flex items-center px-4 py-2 text-[13px] font-semibold rounded-lg bg-stone-900 text-stone-50 no-underline ml-1 hover:bg-stone-800 transition-colors"
          >
            Get started
          </a>
        </div>
      </div>
    </nav>
  );
}
