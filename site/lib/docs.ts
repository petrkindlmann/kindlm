import fs from "fs";
import path from "path";

const CONTENT_DIR = path.join(process.cwd(), "..", "docs");

export interface DocMeta {
  slug: string;
  title: string;
  filename: string;
  order: number;
}

// Map filenames to URL slugs and display titles
const DOC_MAP: Record<string, { slug: string; title: string }> = {
  "00-README.md": { slug: "getting-started", title: "Getting Started" },
  "01-PROJECT_STRUCTURE.md": { slug: "project-structure", title: "Project Structure" },
  "02-CONFIG_SCHEMA.md": { slug: "config-schema", title: "Config Schema" },
  "03-PROVIDER_INTERFACE.md": { slug: "providers", title: "Provider Interface" },
  "04-ASSERTION_ENGINE.md": { slug: "assertions", title: "Assertion Engine" },
  "05-CLOUD_API.md": { slug: "cloud-api", title: "Cloud API" },
  "06-COMPLIANCE_SPEC.md": { slug: "compliance", title: "Compliance (EU AI Act)" },
  "07-CONTRIBUTING.md": { slug: "contributing", title: "Contributing" },
  "08-CLI_REFERENCE.md": { slug: "cli", title: "CLI Reference" },
  "09-DEEP_RESEARCH.md": { slug: "research", title: "Market Research" },
};

export function getAllDocs(): DocMeta[] {
  return Object.entries(DOC_MAP)
    .map(([filename, { slug, title }], i) => ({
      slug,
      title,
      filename,
      order: i,
    }))
    .sort((a, b) => a.order - b.order);
}

export function getDocBySlug(slug: string): { meta: DocMeta; content: string } | null {
  const entry = Object.entries(DOC_MAP).find(([, v]) => v.slug === slug);
  if (!entry) return null;

  const [filename, { title }] = entry;
  const filePath = path.join(CONTENT_DIR, filename);

  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf-8");
  const order = Object.keys(DOC_MAP).indexOf(filename);

  return {
    meta: { slug, title, filename, order },
    content,
  };
}

export function getDocSlugs(): string[] {
  return Object.values(DOC_MAP).map((v) => v.slug);
}

// Navigation grouping for sidebar
export interface NavGroup {
  label: string;
  items: DocMeta[];
}

export function getNavGroups(): NavGroup[] {
  const docs = getAllDocs();
  return [
    {
      label: "Getting Started",
      items: docs.filter((d) => ["getting-started", "cli"].includes(d.slug)),
    },
    {
      label: "Core Concepts",
      items: docs.filter((d) =>
        ["config-schema", "providers", "assertions"].includes(d.slug)
      ),
    },
    {
      label: "Infrastructure",
      items: docs.filter((d) =>
        ["project-structure", "cloud-api"].includes(d.slug)
      ),
    },
    {
      label: "Other",
      items: docs.filter((d) =>
        ["compliance", "contributing", "research"].includes(d.slug)
      ),
    },
  ];
}
