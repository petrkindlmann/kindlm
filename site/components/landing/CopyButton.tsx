"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text approach not needed for modern browsers
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="group flex items-center gap-2 px-5 py-3 rounded-[10px] bg-stone-900 text-stone-300 font-mono text-[13px] font-medium min-h-[44px] hover:bg-stone-800 transition-colors cursor-pointer border-0"
      title="Click to copy"
      type="button"
    >
      <span>{text}</span>
      <span className="text-stone-500 group-hover:text-stone-400 text-xs transition-colors">
        {copied ? "\u2713" : "\u2398"}
      </span>
    </button>
  );
}
