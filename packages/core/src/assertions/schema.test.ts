import { describe, it, expect } from "vitest";
import type { AssertionContext } from "./interface.js";
import { createSchemaAssertion } from "./schema.js";

function ctx(outputText: string): AssertionContext {
  return { outputText, toolCalls: [], configDir: "/tmp" };
}

describe("createSchemaAssertion", () => {
  describe("JSON parsing", () => {
    it("passes for valid JSON", async () => {
      const assertion = createSchemaAssertion({ format: "json" });
      const results = await assertion.evaluate(ctx('{"key": "value"}'));
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ passed: true, label: expect.stringContaining("valid JSON") });
    });

    it("fails for invalid JSON", async () => {
      const assertion = createSchemaAssertion({ format: "json" });
      const results = await assertion.evaluate(ctx("not json {"));
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        passed: false,
        failureCode: "SCHEMA_PARSE_ERROR",
      });
    });

    it("returns early on JSON parse failure (no further checks)", async () => {
      const assertion = createSchemaAssertion({
        format: "json",
        schemaContent: { type: "object" },
        contains: ["hello"],
      });
      const results = await assertion.evaluate(ctx("not json"));
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ failureCode: "SCHEMA_PARSE_ERROR" });
    });
  });

  describe("JSON Schema validation", () => {
    it("passes for valid schema", async () => {
      const assertion = createSchemaAssertion({
        format: "json",
        schemaContent: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      });
      const results = await assertion.evaluate(ctx('{"name": "test"}'));
      expect(results).toHaveLength(2);
      expect(results[1]).toMatchObject({
        passed: true,
        label: expect.stringContaining("JSON Schema"),
      });
    });

    it("fails for invalid schema", async () => {
      const assertion = createSchemaAssertion({
        format: "json",
        schemaContent: {
          type: "object",
          properties: { age: { type: "number" } },
          required: ["age"],
        },
      });
      const results = await assertion.evaluate(ctx('{"name": "test"}'));
      expect(results).toHaveLength(2);
      expect(results[1]).toMatchObject({
        passed: false,
        failureCode: "SCHEMA_INVALID",
      });
    });

    it("reports all errors", async () => {
      const assertion = createSchemaAssertion({
        format: "json",
        schemaContent: {
          type: "object",
          properties: {
            a: { type: "number" },
            b: { type: "number" },
          },
          required: ["a", "b"],
        },
      });
      const results = await assertion.evaluate(ctx("{}"));
      expect(results[1]).toHaveProperty("metadata");
    });
  });

  describe("schema compilation error", () => {
    it("returns SCHEMA_INVALID when schema fails to compile", async () => {
      const assertion = createSchemaAssertion({
        format: "json",
        schemaContent: {
          type: "object",
          properties: {
            name: { type: "not-a-real-type" },
          },
        },
      });
      const results = await assertion.evaluate(ctx('{"name": "test"}'));
      // First result is the JSON parse check (passes), second is schema validation
      const schemaResult = results.find((r) => r.label === "Output matches JSON Schema");
      expect(schemaResult).toBeDefined();
      if (!schemaResult) return;
      expect(schemaResult.passed).toBe(false);
      expect(schemaResult.failureCode).toBe("SCHEMA_INVALID");
      expect(schemaResult.failureMessage).toContain("compilation failed");
    });
  });

  describe("contains", () => {
    it("passes when substring found", async () => {
      const assertion = createSchemaAssertion({
        format: "text",
        contains: ["hello"],
      });
      const results = await assertion.evaluate(ctx("hello world"));
      expect(results[0]).toMatchObject({ passed: true });
    });

    it("is case-insensitive", async () => {
      const assertion = createSchemaAssertion({
        format: "text",
        contains: ["hello"],
      });
      const results = await assertion.evaluate(ctx("Hello World"));
      expect(results[0]).toMatchObject({ passed: true });
    });

    it("fails when substring missing", async () => {
      const assertion = createSchemaAssertion({
        format: "text",
        contains: ["goodbye"],
      });
      const results = await assertion.evaluate(ctx("hello world"));
      expect(results[0]).toMatchObject({
        passed: false,
        failureCode: "CONTAINS_FAILED",
      });
    });

    it("checks each substring independently", async () => {
      const assertion = createSchemaAssertion({
        format: "text",
        contains: ["hello", "missing"],
      });
      const results = await assertion.evaluate(ctx("hello world"));
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ passed: true });
      expect(results[1]).toMatchObject({ passed: false });
    });
  });

  describe("notContains", () => {
    it("passes when substring absent", async () => {
      const assertion = createSchemaAssertion({
        format: "text",
        notContains: ["secret"],
      });
      const results = await assertion.evaluate(ctx("hello world"));
      expect(results[0]).toMatchObject({ passed: true });
    });

    it("fails when substring present", async () => {
      const assertion = createSchemaAssertion({
        format: "text",
        notContains: ["world"],
      });
      const results = await assertion.evaluate(ctx("hello world"));
      expect(results[0]).toMatchObject({
        passed: false,
        failureCode: "NOT_CONTAINS_FAILED",
      });
    });
  });

  describe("maxLength", () => {
    it("passes when within limit", async () => {
      const assertion = createSchemaAssertion({
        format: "text",
        maxLength: 100,
      });
      const results = await assertion.evaluate(ctx("short text"));
      expect(results[0]).toMatchObject({ passed: true });
    });

    it("fails when exceeding limit", async () => {
      const assertion = createSchemaAssertion({
        format: "text",
        maxLength: 5,
      });
      const results = await assertion.evaluate(ctx("this is too long"));
      expect(results[0]).toMatchObject({
        passed: false,
        failureCode: "MAX_LENGTH_EXCEEDED",
      });
    });
  });
});
