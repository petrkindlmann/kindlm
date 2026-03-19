import { describe, it, expect } from "vitest";
import { formatSlackPayload, isSlackUrl } from "./slack-format.js";

describe("isSlackUrl", () => {
  it("returns true for Slack webhook URLs", () => {
    expect(isSlackUrl("https://hooks.slack.com/services/T00/B00/xxxx")).toBe(true);
  });

  it("returns false for non-Slack URLs", () => {
    expect(isSlackUrl("https://example.com/webhook")).toBe(false);
    expect(isSlackUrl("https://slack.com/api/chat.postMessage")).toBe(false);
  });
});

describe("formatSlackPayload", () => {
  const data = {
    runId: "run-1",
    projectId: "proj-1",
    suiteId: "suite-1",
    status: "completed",
    passRate: 0.95,
    testCount: 10,
  };

  it("returns object with text and blocks", () => {
    const result = formatSlackPayload("run.completed", data);
    expect(result.text).toBeDefined();
    expect(result.blocks).toBeDefined();
    expect(Array.isArray(result.blocks)).toBe(true);
  });

  it("includes a header block", () => {
    const result = formatSlackPayload("run.completed", data);
    const blocks = result.blocks as Array<{ type: string; text?: { text: string } }>;
    const header = blocks.find((b) => b.type === "header");
    expect(header).toBeDefined();
    expect(header?.text?.text).toBe("Run Completed");
  });

  it("includes section with status and pass rate fields", () => {
    const result = formatSlackPayload("run.completed", data);
    const blocks = result.blocks as Array<{
      type: string;
      fields?: Array<{ text: string }>;
    }>;
    const section = blocks.find((b) => b.type === "section");
    expect(section).toBeDefined();
    const fieldTexts = section?.fields?.map((f) => f.text) ?? [];
    expect(fieldTexts.some((t) => t.includes("95.0%"))).toBe(true);
    expect(fieldTexts.some((t) => t.includes("completed"))).toBe(true);
    expect(fieldTexts.some((t) => t.includes("10"))).toBe(true);
  });

  it("includes context block with suite and run IDs", () => {
    const result = formatSlackPayload("run.completed", data);
    const blocks = result.blocks as Array<{
      type: string;
      elements?: Array<{ text: string }>;
    }>;
    const context = blocks.find((b) => b.type === "context");
    expect(context).toBeDefined();
    expect(context?.elements?.[0]?.text).toContain("suite-1");
    expect(context?.elements?.[0]?.text).toContain("run-1");
  });

  it("shows N/A when passRate is null", () => {
    const result = formatSlackPayload("run.failed", { ...data, passRate: null });
    const blocks = result.blocks as Array<{
      type: string;
      fields?: Array<{ text: string }>;
    }>;
    const section = blocks.find((b) => b.type === "section");
    const fieldTexts = section?.fields?.map((f) => f.text) ?? [];
    expect(fieldTexts.some((t) => t.includes("N/A"))).toBe(true);
  });

  it("uses failure emoji for failed status", () => {
    const result = formatSlackPayload("run.failed", { ...data, status: "failed" });
    const blocks = result.blocks as Array<{
      type: string;
      fields?: Array<{ text: string }>;
    }>;
    const section = blocks.find((b) => b.type === "section");
    const statusField = section?.fields?.find((f) => f.text.includes("Status"));
    expect(statusField?.text).toContain(":x:");
  });

  it("formats event name with proper casing", () => {
    const result = formatSlackPayload("run.completed", data);
    const blocks = result.blocks as Array<{ type: string; text?: { text: string } }>;
    const header = blocks.find((b) => b.type === "header");
    expect(header?.text?.text).toBe("Run Completed");
  });
});
