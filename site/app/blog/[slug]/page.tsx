import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Markdown from "@/components/Markdown";
import { getPostBySlug, getPostSlugs } from "@/lib/blog";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.meta.title,
    description: post.meta.description,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <article>
      <header className="mb-8">
        <p className="text-[13px] text-stone-400 mb-2">
          {post.meta.date} · {post.meta.author}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          {post.meta.title}
        </h1>
        {post.meta.description && (
          <p className="text-stone-600 mt-2 text-lg leading-relaxed">
            {post.meta.description}
          </p>
        )}
      </header>
      <Markdown content={post.content} />
    </article>
  );
}
