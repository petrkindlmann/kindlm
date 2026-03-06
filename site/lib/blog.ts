import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  filename: string;
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, filename), "utf-8");
      const { data } = matter(raw);
      return {
        slug: filename.replace(/\.md$/, ""),
        title: data.title ?? filename,
        description: data.description ?? "",
        date: data.date ?? "1970-01-01",
        author: data.author ?? "KindLM Team",
        filename,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPostBySlug(slug: string): { meta: BlogPost; content: string } | null {
  const filename = `${slug}.md`;
  const filePath = path.join(BLOG_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return {
    meta: {
      slug,
      title: data.title ?? slug,
      description: data.description ?? "",
      date: data.date ?? "1970-01-01",
      author: data.author ?? "KindLM Team",
      filename,
    },
    content,
  };
}

export function getPostSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}
