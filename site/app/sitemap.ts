import { getDocSlugs } from "@/lib/docs";

export default function sitemap() {
  const baseUrl = "https://kindlm.com";

  const docPages = getDocSlugs().map((slug) => ({
    url: `${baseUrl}/docs/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 1,
    },
    ...docPages,
  ];
}
