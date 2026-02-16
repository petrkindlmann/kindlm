import { describe, it, expect } from "vitest";
import type { AssertionContext } from "./interface.js";
import {
  createKeywordsPresentAssertion,
  createKeywordsAbsentAssertion,
} from "./keywords.js";

function ctx(outputText: string): AssertionContext {
  return { outputText, toolCalls: [], configDir: "/tmp" };
}

describe("createKeywordsPresentAssertion", () => {
  it("passes when keyword is found", async () => {
    const assertion = createKeywordsPresentAssertion(["hello", "world"]);
    const results = await assertion.evaluate(ctx("Hello there!"));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("is case-insensitive", async () => {
    const assertion = createKeywordsPresentAssertion(["HELLO"]);
    const results = await assertion.evaluate(ctx("hello world"));
    expect(results[0]).toMatchObject({ passed: true });
  });

  it("fails when no keywords found", async () => {
    const assertion = createKeywordsPresentAssertion(["missing", "absent"]);
    const results = await assertion.evaluate(ctx("nothing here"));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "KEYWORD_MISSING",
    });
  });

  it("passes if at least one keyword matches", async () => {
    const assertion = createKeywordsPresentAssertion(["missing", "here"]);
    const results = await assertion.evaluate(ctx("nothing here"));
    expect(results[0]).toMatchObject({ passed: true });
  });
});

describe("createKeywordsAbsentAssertion", () => {
  it("passes when no denied keywords found", async () => {
    const assertion = createKeywordsAbsentAssertion(["secret", "password"]);
    const results = await assertion.evaluate(ctx("This is safe content"));
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("fails when denied keyword found", async () => {
    const assertion = createKeywordsAbsentAssertion(["secret"]);
    const results = await assertion.evaluate(ctx("This is a secret message"));
    expect(results[0]).toMatchObject({
      passed: false,
      failureCode: "KEYWORD_DENIED",
    });
  });

  it("is case-insensitive", async () => {
    const assertion = createKeywordsAbsentAssertion(["SECRET"]);
    const results = await assertion.evaluate(ctx("this is a secret"));
    expect(results[0]).toMatchObject({ passed: false });
  });

  it("checks each keyword independently", async () => {
    const assertion = createKeywordsAbsentAssertion(["good", "bad"]);
    const results = await assertion.evaluate(ctx("This is bad content"));
    expect(results[0]).toMatchObject({ passed: true });  // "good" not found
    expect(results[1]).toMatchObject({ passed: false }); // "bad" found
  });
});
