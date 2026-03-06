import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    template: "%s | KindLM Blog",
    default: "Blog | KindLM",
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-stone-50">
      <nav className="fixed top-0 left-0 right-0 z-50 h-14 bg-stone-50/95 backdrop-blur-md border-b border-stone-200 px-4 lg:px-6">
        <div className="h-full flex items-center justify-between max-w-[700px] mx-auto">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-bold text-[15px] tracking-tight text-stone-900 no-underline"
            >
              kindlm
            </Link>
            <span className="text-stone-300 text-sm hidden sm:inline">/</span>
            <Link
              href="/blog"
              className="text-sm font-medium text-stone-500 no-underline hidden sm:inline hover:text-stone-700"
            >
              Blog
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/docs"
              className="text-[13px] text-stone-500 no-underline hover:text-stone-700"
            >
              Docs
            </a>
            <a
              href="https://github.com/kindlm/kindlm"
              target="_blank"
              rel="noopener"
              className="text-[13px] text-stone-500 no-underline hover:text-stone-700"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>
      <main className="pt-24 pb-10 lg:pb-12 px-5 sm:px-6 max-w-[700px] mx-auto">
        {children}
      </main>
    </div>
  );
}
