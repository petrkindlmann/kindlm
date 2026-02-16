import type { Metadata } from "next";
import Link from "next/link";
import DocsSidebar from "@/components/DocsSidebar";
import { getNavGroups } from "@/lib/docs";

export const metadata: Metadata = {
  title: {
    template: "%s | KindLM Docs",
    default: "Docs | KindLM",
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const groups = getNavGroups();

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-stone-50/95 backdrop-blur-md border-b border-stone-200 px-4 lg:px-6">
        <div className="h-full flex items-center justify-between max-w-[1400px] mx-auto">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-bold text-[15px] tracking-tight text-stone-900 no-underline"
            >
              kindlm
            </Link>
            <span className="text-stone-300 text-sm hidden sm:inline">/</span>
            <Link
              href="/docs"
              className="text-sm font-medium text-stone-500 no-underline hidden sm:inline hover:text-stone-700"
            >
              Documentation
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/kindlm/kindlm"
              target="_blank"
              rel="noopener"
              className="text-[13px] text-stone-500 no-underline hover:text-stone-700"
            >
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/@kindlm/cli"
              target="_blank"
              rel="noopener"
              className="text-[13px] text-stone-500 no-underline hover:text-stone-700"
            >
              npm
            </a>
          </div>
        </div>
      </nav>

      <div className="flex pt-14">
        <DocsSidebar groups={groups} />

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-10 lg:py-12 max-w-3xl">
          {children}
        </main>
      </div>
    </div>
  );
}
