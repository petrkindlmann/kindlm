import { describe, it, expect } from "vitest";
import type { AssertionContext } from "./interface.js";
import {
  createPiiAssertion,
  luhnValid,
  ibanMod97Valid,
  PII_DETECTORS,
  DETECTOR_NAMES,
} from "./pii.js";
import type { DetectorName } from "./pii.js";

function ctx(outputText: string): AssertionContext {
  return { outputText, toolCalls: [], configDir: "/tmp" };
}

const DEFAULT_PATTERNS = [
  "\\b\\d{3}-\\d{2}-\\d{4}\\b",
  "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
  "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
];

async function fired(detector: DetectorName, text: string): Promise<boolean> {
  const assertion = createPiiAssertion({
    denyPatterns: [],
    detectors: [detector],
  });
  const results = await assertion.evaluate(ctx(text));
  return results[0]?.passed === false;
}

// ============================================================
// Legacy denyPatterns behavior (back-compat — must not change)
// ============================================================

describe("createPiiAssertion — legacy denyPatterns", () => {
  it("passes for clean text", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(ctx("This is a normal sentence."));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("detects SSN pattern", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(ctx("My SSN is 123-45-6789"));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "PII_DETECTED",
    });
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("pii-pattern-1");
  });

  it("detects credit card pattern", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(ctx("Card: 4111 1111 1111 1111"));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "PII_DETECTED",
    });
  });

  it("detects email pattern", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(ctx("Contact me at user@example.com"));
    expect(results[0]).toMatchObject({ passed: false });
  });

  it("detects multiple PII matches", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(
      ctx("SSN: 123-45-6789, email: test@example.com"),
    );
    expect(results[0]).toMatchObject({ passed: false });
    const metadata = results[0]?.metadata as { matches: unknown[] } | undefined;
    expect(metadata?.matches.length).toBeGreaterThan(1);
  });

  it("uses custom patterns", async () => {
    const assertion = createPiiAssertion({
      denyPatterns: [],
      customPatterns: [{ name: "api-key", pattern: "sk-[a-zA-Z0-9]{20,}" }],
    });
    const results = await assertion.evaluate(
      ctx("Key: sk-abcdefghijklmnopqrstuvwxyz"),
    );
    expect(results[0]).toMatchObject({ passed: false });
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("api-key");
  });

  it("passes when custom patterns don't match", async () => {
    const assertion = createPiiAssertion({
      denyPatterns: [],
      customPatterns: [{ name: "api-key", pattern: "sk-[a-zA-Z0-9]{20,}" }],
    });
    const results = await assertion.evaluate(ctx("No keys here"));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("redacts matched values in failure message", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(ctx("SSN: 123-45-6789"));
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).not.toContain("123-45-6789");
    expect(msg).toContain("****");
  });

  it("redacts short matches with correct length", async () => {
    const assertion = createPiiAssertion({
      denyPatterns: [],
      customPatterns: [{ name: "pin", pattern: "\\b\\d{4}\\b" }],
    });
    const results = await assertion.evaluate(ctx("PIN: 1234"));
    const msg = (results[0] as { failureMessage?: string }).failureMessage ?? "";
    expect(msg).toContain("****");
    expect(msg).not.toContain("1234");
  });

  it("rejects nested quantifier patterns (ReDoS protection)", async () => {
    const assertion = createPiiAssertion({
      denyPatterns: [],
      customPatterns: [{ name: "evil", pattern: "(a+)+$" }],
    });
    const results = await assertion.evaluate(ctx("aaaa"));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "INVALID_PATTERN",
    });
  });

  it("limits matches to prevent runaway scanning", async () => {
    const assertion = createPiiAssertion({ denyPatterns: ["[a-z]"] });
    const longText = "a".repeat(5000);
    const results = await assertion.evaluate(ctx(longText));
    expect(results[0]).toMatchObject({ passed: false });
    const metadata = results[0]?.metadata as { matches: unknown[] } | undefined;
    expect(metadata?.matches.length).toBeLessThanOrEqual(1000);
  });

  it("passes for empty string input", async () => {
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const results = await assertion.evaluate(ctx(""));
    expect(results[0]).toMatchObject({ passed: true });
  });
});

// ============================================================
// Checksum validators
// ============================================================

describe("luhnValid", () => {
  it("accepts a Luhn-valid card number", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("4111 1111 1111 1111")).toBe(true);
  });
  it("rejects a Luhn-invalid card number", () => {
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(luhnValid("1234567812345678")).toBe(false);
  });
});

describe("ibanMod97Valid", () => {
  it("accepts a mod-97-valid IBAN", () => {
    expect(ibanMod97Valid("GB82WEST12345698765432")).toBe(true);
    expect(ibanMod97Valid("DE89370400440532013000")).toBe(true);
  });
  it("rejects a mod-97-invalid IBAN", () => {
    expect(ibanMod97Valid("GB82WEST12345698765433")).toBe(false);
    expect(ibanMod97Valid("DE89370400440532013001")).toBe(false);
  });
});

// ============================================================
// Named-detector registry — positive + negative control each
// ============================================================

describe("named PII detector registry", () => {
  it("exposes all 8 detector names", () => {
    expect(DETECTOR_NAMES.sort()).toEqual(
      [
        "api_key",
        "credit_card",
        "email",
        "iban",
        "ip",
        "jwt",
        "phone",
        "ssn",
      ].sort(),
    );
    expect(PII_DETECTORS.credit_card.validate).toBe(luhnValid);
    expect(PII_DETECTORS.iban.validate).toBe(ibanMod97Valid);
  });

  it("ssn: matches dashed and undashed, ignores a clean control", async () => {
    expect(await fired("ssn", "ssn 123-45-6789")).toBe(true);
    expect(await fired("ssn", "ssn 123456789")).toBe(true);
    expect(await fired("ssn", "the year was 2024 and all was well")).toBe(false);
  });

  it("credit_card: matches a Luhn-valid number, rejects a Luhn-invalid one", async () => {
    expect(await fired("credit_card", "card 4111 1111 1111 1111")).toBe(true);
    expect(await fired("credit_card", "card 4111 1111 1111 1112")).toBe(false);
  });

  it("email: matches an address, ignores plain text", async () => {
    expect(await fired("email", "reach me at jane.doe@example.com")).toBe(true);
    expect(await fired("email", "no address here at all")).toBe(false);
  });

  it("phone: matches US format and E.164, ignores a short number", async () => {
    expect(await fired("phone", "call (415) 555-2671")).toBe(true);
    expect(await fired("phone", "call +14155552671")).toBe(true);
    expect(await fired("phone", "press 5 to continue")).toBe(false);
  });

  it("iban: matches a mod-97-valid IBAN, rejects a mod-97-invalid one", async () => {
    expect(await fired("iban", "pay to GB82WEST12345698765432 please")).toBe(true);
    expect(await fired("iban", "pay to GB82WEST12345698765433 please")).toBe(false);
  });

  it("ip: matches an IPv4 address, ignores an out-of-range quad", async () => {
    expect(await fired("ip", "server at 192.168.1.42")).toBe(true);
    expect(await fired("ip", "version 999.999.999.999 build")).toBe(false);
  });

  it("jwt: matches a three-segment token, ignores a two-segment string", async () => {
    expect(
      await fired(
        "jwt",
        "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NX0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk",
      ),
    ).toBe(true);
    expect(await fired("jwt", "header.payload only here")).toBe(false);
  });

  it("api_key: matches AKIA/sk-/ghp_/xox prefixes, ignores random text", async () => {
    expect(await fired("api_key", "key AKIAIOSFODNN7EXAMPLE")).toBe(true);
    expect(await fired("api_key", "key sk-abcdefghijklmnop1234")).toBe(true);
    expect(await fired("api_key", "key ghp_abcdefghijklmnopqrstuvwxyz1234")).toBe(
      true,
    );
    expect(await fired("api_key", "key xoxb-1234567890-abcdEFGH")).toBe(true);
    expect(await fired("api_key", "nothing secret in this sentence")).toBe(false);
  });

  it("runs only the selected detectors (does not fire on others' PII)", async () => {
    // email-only selection must not flag an SSN
    expect(await fired("email", "ssn 123-45-6789")).toBe(false);
  });

  it("back-compat: absent detectors runs legacy denyPatterns unchanged", async () => {
    // No `detectors` field → legacy path: the 3 default patterns fire.
    const assertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const ssn = await assertion.evaluate(ctx("ssn 123-45-6789"));
    expect(ssn[0]).toMatchObject({ passed: false });
    const ccAssertion = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const cc = await ccAssertion.evaluate(ctx("card 4111 1111 1111 1111"));
    expect(cc[0]).toMatchObject({ passed: false });
    // Undashed SSN was NOT covered by the legacy default — must stay uncovered.
    const undashed = createPiiAssertion({ denyPatterns: DEFAULT_PATTERNS });
    const u = await undashed.evaluate(ctx("ssn 123456789"));
    expect(u[0]).toMatchObject({ passed: true });
  });

  it("preserves the ReDoS guard for custom patterns when detectors are set", async () => {
    const assertion = createPiiAssertion({
      denyPatterns: [],
      detectors: ["email"],
      customPatterns: [{ name: "evil", pattern: "(a+)+$" }],
    });
    const results = await assertion.evaluate(ctx("aaaa"));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "INVALID_PATTERN",
    });
  });
});
