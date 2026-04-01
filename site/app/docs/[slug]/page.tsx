import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Markdown from "@/components/Markdown";
import { getDocBySlug, getDocSlugs, getAllDocs } from "@/lib/docs";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) return {};
  return {
    title: doc.meta.title,
    description: `KindLM documentation — ${doc.meta.title}`,
  };
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  const allDocs = getAllDocs();
  const idx = allDocs.findIndex((d) => d.slug === slug);
  const prev = idx > 0 ? allDocs[idx - 1] : null;
  const next = idx < allDocs.length - 1 ? allDocs[idx + 1] : null;

  return (
    <article>
      <Markdown content={doc.content} />

      {/* Prev / Next nav */}
      <div className="mt-16 pt-8 border-t border-stone-200 flex justify-between gap-4">
        {prev ? (
          <Link
            href={`/docs/${prev.slug}`}
            className="group text-left no-underline"
          >
            <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
              Previous
            </span>
            <span className="block text-sm font-medium text-stone-600 group-hover:text-indigo-500 mt-1">
              ← {prev.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={`/docs/${next.slug}`}
            className="group text-right no-underline"
          >
            <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">
              Next
            </span>
            <span className="block text-sm font-medium text-stone-600 group-hover:text-indigo-500 mt-1">
              {next.title} →
            </span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </article>
  );
}
