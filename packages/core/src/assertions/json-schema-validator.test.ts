import { describe, it, expect } from "vitest";
import { createJsonSchemaValidator } from "./schema.js";

describe("createJsonSchemaValidator", () => {
  it("returns { valid: true } when data matches the schema", () => {
    const validate = createJsonSchemaValidator();
    const result = validate(
      {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
      },
      { city: "Prague" },
    );
    expect(result).toEqual({ valid: true });
  });

  it("returns { valid: false } with errors when data violates the schema", () => {
    const validate = createJsonSchemaValidator();
    const result = validate(
      {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
        additionalProperties: false,
      },
      { city: "Prague", leaked: "secret" },
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.join(" ")).toContain("additional");
    }
  });

  it("enforces additionalProperties: false (rejects extra args)", () => {
    const validate = createJsonSchemaValidator();
    const schema = {
      type: "object",
      properties: { amount: { type: "number" } },
      required: ["amount"],
      additionalProperties: false,
    };
    expect(validate(schema, { amount: 10 }).valid).toBe(true);
    expect(validate(schema, { amount: 10, extra: true }).valid).toBe(false);
  });

  it("has ajv-formats enabled (validates format keywords)", () => {
    const validate = createJsonSchemaValidator();
    const schema = {
      type: "object",
      properties: { contact: { type: "string", format: "email" } },
      required: ["contact"],
    };
    expect(validate(schema, { contact: "a@b.com" }).valid).toBe(true);
    expect(validate(schema, { contact: "not-an-email" }).valid).toBe(false);
  });

  it("reports compile errors as a failed validation result", () => {
    const validate = createJsonSchemaValidator();
    const result = validate(
      { type: "not-a-real-type" } as Record<string, unknown>,
      {},
    );
    expect(result.valid).toBe(false);
  });
});
