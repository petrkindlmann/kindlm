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
  "23-ADOPT.md": { slug: "adopt", title: "Adopt KindLM in 30 Minutes" },
  "25-TUTORIAL.md": { slug: "tutorial", title: "Tutorial: Refund Agent" },
  "26-CI_GUIDE.md": { slug: "ci-guide", title: "CI: GitHub Actions in 5 Minutes" },
  "08-CLI_REFERENCE.md": { slug: "cli", title: "CLI Reference" },
  "02-CONFIG_SCHEMA.md": { slug: "config-schema", title: "Config Schema" },
  "03-PROVIDER_INTERFACE.md": { slug: "providers", title: "Provider Interface" },
  "04-ASSERTION_ENGINE.md": { slug: "assertions", title: "Assertion Engine" },
  "10-COMMAND-TESTS.md": { slug: "command-tests", title: "Command Tests" },
  "21-OTEL-TRACE.md": { slug: "otel-trace", title: "OpenTelemetry Traces" },
  "27-EXAMPLES.md": { slug: "examples", title: "Examples Gallery" },
  "28-MODELING.md": { slug: "modeling", title: "How to Model My System" },
  "29-TROUBLESHOOTING.md": { slug: "troubleshooting", title: "Troubleshooting" },
  "24-COMPARISON.md": { slug: "comparison", title: "KindLM vs Promptfoo vs Scripts" },
  "01-PROJECT_STRUCTURE.md": { slug: "project-structure", title: "Project Structure" },
"05-CLOUD_API.md": { slug: "cloud-api", title: "Cloud API" },
  "15-OPENAPI.md": { slug: "openapi", title: "OpenAPI Spec" },
  "19-DEPLOYMENT.md": { slug: "deployment", title: "Deployment" },
  "18-SECURITY.md": { slug: "security", title: "Security" },
  "14-ADR.md": { slug: "adr", title: "Architecture Decisions" },
  "11-PRICING.md": { slug: "pricing", title: "Pricing" },
  "06-COMPLIANCE_SPEC.md": { slug: "compliance", title: "Compliance (EU AI Act)" },
  "07-CONTRIBUTING.md": { slug: "contributing", title: "Contributing" },
  "16-TESTING_STRATEGY.md": { slug: "testing-strategy", title: "Testing Strategy" },
  "17-ERROR_HANDLING.md": { slug: "error-handling", title: "Error Handling" },
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
      items: docs.filter((d) =>
        ["getting-started", "adopt", "tutorial", "ci-guide", "cli"].includes(d.slug)
      ),
    },
    {
      label: "Core Concepts",
      items: docs.filter((d) =>
        ["config-schema", "providers", "assertions", "command-tests", "otel-trace"].includes(d.slug)
      ),
    },
    {
      label: "Guides",
      items: docs.filter((d) =>
        ["examples", "modeling", "troubleshooting", "comparison"].includes(d.slug)
      ),
    },
    {
      label: "Infrastructure",
      items: docs.filter((d) =>
        ["project-structure", "cloud-api", "openapi", "deployment", "security"].includes(d.slug)
      ),
    },
    {
      label: "Reference",
      items: docs.filter((d) =>
        ["adr", "pricing"].includes(d.slug)
      ),
    },
    {
      label: "Other",
      items: docs.filter((d) =>
        ["compliance", "contributing", "testing-strategy", "error-handling"].includes(d.slug)
      ),
    },
  ];
}
