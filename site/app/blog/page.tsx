import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-8">Blog</h1>
      {posts.length === 0 ? (
        <p className="text-stone-500">No posts yet.</p>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <article key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group no-underline block"
              >
                <p className="text-[13px] text-stone-400 mb-1">
                  {post.date} · {post.author}
                </p>
                <h2 className="text-xl font-semibold text-stone-900 group-hover:text-indigo-500 transition-colors">
                  {post.title}
                </h2>
                <p className="text-stone-600 mt-1 text-[15px] leading-relaxed">
                  {post.description}
                </p>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
