import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectReporter } from "./select-reporter.js";

describe("selectReporter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(process, "exit").mockImplementation(
      (_code?: string | number | null) => {
        throw new Error("process.exit");
      },
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns a reporter with name 'pretty' for 'pretty'", () => {
    const r = selectReporter("pretty");
    expect(r.name).toBe("pretty");
  });

  it("returns a reporter with name 'json' for 'json'", () => {
    const r = selectReporter("json");
    expect(r.name).toBe("json");
  });

  it("returns a reporter with name 'junit' for 'junit'", () => {
    const r = selectReporter("junit");
    expect(r.name).toBe("junit");
  });

  it("calls console.error and process.exit(1) on unknown reporter type", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(
      (_code?: string | number | null) => {
        throw new Error("process.exit");
      },
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => selectReporter("nope")).toThrow("process.exit");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const errorArg = String(errorSpy.mock.calls[0]![0]);
    expect(errorArg).toContain("nope");
    expect(errorArg).toContain("pretty");
    expect(errorArg).toContain("json");
    expect(errorArg).toContain("junit");
  });
});
