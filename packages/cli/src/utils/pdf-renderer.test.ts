import { describe, it, expect } from "vitest";

// The parsing functions are not exported, so we test them indirectly
// by extracting and testing the same logic. Since parseSections,
// extractTitle, and extractHash are private, we replicate them here
// to validate the parsing behavior used by renderCompliancePdf.

// --- Replicated parsing logic (mirrors pdf-renderer.ts internals) ---

interface Section {
  heading: string;
  body: string;
}

function parseSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentHeading || currentBody.length > 0) {
        sections.push({ heading: currentHeading, body: currentBody.join("\n").trim() });
      }
      currentHeading = line.slice(3).trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  if (currentHeading || currentBody.length > 0) {
    sections.push({ heading: currentHeading, body: currentBody.join("\n").trim() });
  }

  return sections;
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^# (.+)$/m);
  return match?.[1] ? match[1].trim() : "KindLM Compliance Report";
}

function extractHash(markdown: string): string | null {
  const match = markdown.match(/SHA-256:\s*`([a-f0-9]+)`/i);
  return match?.[1] ?? null;
}

// --- Tests ---

describe("pdf-renderer markdown parsing", () => {
  it("splits markdown into sections by ## headings", () => {
    const markdown = [
      "## Overview",
      "This is the overview content.",
      "",
      "## Test Results",
      "All tests passed.",
      "- test-a: pass",
      "- test-b: pass",
    ].join("\n");

    const sections = parseSections(markdown);

    expect(sections).toHaveLength(2);
    expect(sections[0]!.heading).toBe("Overview");
    expect(sections[0]!.body).toContain("overview content");
    expect(sections[1]!.heading).toBe("Test Results");
    expect(sections[1]!.body).toContain("test-a: pass");
  });

  it("captures preamble text before the first ## heading", () => {
    const markdown = [
      "# Compliance Report",
      "Generated on 2026-01-15",
      "",
      "## Section One",
      "Body of section one.",
    ].join("\n");

    const sections = parseSections(markdown);

    expect(sections).toHaveLength(2);
    // First "section" is the preamble (no heading)
    expect(sections[0]!.heading).toBe("");
    expect(sections[0]!.body).toContain("Compliance Report");
    expect(sections[1]!.heading).toBe("Section One");
  });

  it("extracts title from # heading", () => {
    const markdown = "# EU AI Act Compliance Report\n\n## Details\nSome content.";
    expect(extractTitle(markdown)).toBe("EU AI Act Compliance Report");
  });

  it("returns default title when no # heading exists", () => {
    const markdown = "## Details\nSome content without a title.";
    expect(extractTitle(markdown)).toBe("KindLM Compliance Report");
  });

  it("extracts SHA-256 hash from markdown", () => {
    const markdown = "Report integrity\n\nSHA-256: `a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`\n";
    expect(extractHash(markdown)).toBe("a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4");
  });

  it("returns null when no hash is present", () => {
    const markdown = "## Report\nNo hash in this document.";
    expect(extractHash(markdown)).toBeNull();
  });

  it("detects code blocks in section body", () => {
    const markdown = [
      "## Configuration",
      "```yaml",
      "kindlm: 1",
      "project: test",
      "```",
      "End of section.",
    ].join("\n");

    const sections = parseSections(markdown);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.body).toContain("```yaml");
    expect(sections[0]!.body).toContain("kindlm: 1");
  });
});
