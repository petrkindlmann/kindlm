import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ora at module level — must come before imports of spinner
const mockInstance = {
  start: vi.fn().mockReturnThis(),
  succeed: vi.fn(),
  fail: vi.fn(),
  stop: vi.fn(),
};

vi.mock("ora", () => ({
  default: vi.fn(() => mockInstance),
}));

import ora from "ora";
import { createSpinner } from "./spinner.js";

const mockedOra = vi.mocked(ora);

describe("createSpinner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore mockReturnThis after clearAllMocks resets it
    mockInstance.start.mockReturnThis();
  });

  it("start calls ora with text and process.stderr stream, then calls .start()", () => {
    const spinner = createSpinner();
    spinner.start("Loading...");

    expect(mockedOra).toHaveBeenCalledWith({ text: "Loading...", stream: process.stderr });
    expect(mockInstance.start).toHaveBeenCalledTimes(1);
  });

  it("succeed delegates to instance.succeed with text after start", () => {
    const spinner = createSpinner();
    spinner.start("Working...");
    spinner.succeed("Done");

    expect(mockInstance.succeed).toHaveBeenCalledWith("Done");
  });

  it("fail delegates to instance.fail with text after start", () => {
    const spinner = createSpinner();
    spinner.start("Working...");
    spinner.fail("Error occurred");

    expect(mockInstance.fail).toHaveBeenCalledWith("Error occurred");
  });

  it("stop delegates to instance.stop after start", () => {
    const spinner = createSpinner();
    spinner.start("Working...");
    spinner.stop();

    expect(mockInstance.stop).toHaveBeenCalledTimes(1);
  });

  it("succeed before start is a no-op — instance.succeed not called", () => {
    const spinner = createSpinner();
    spinner.succeed("Done");

    expect(mockInstance.succeed).not.toHaveBeenCalled();
    expect(mockedOra).not.toHaveBeenCalled();
  });

  it("fail before start is a no-op — instance.fail not called", () => {
    const spinner = createSpinner();
    spinner.fail("Error");

    expect(mockInstance.fail).not.toHaveBeenCalled();
    expect(mockedOra).not.toHaveBeenCalled();
  });

  it("stop before start is a no-op — instance.stop not called", () => {
    const spinner = createSpinner();
    spinner.stop();

    expect(mockInstance.stop).not.toHaveBeenCalled();
    expect(mockedOra).not.toHaveBeenCalled();
  });

  it("instance cleared after succeed — subsequent stop is a no-op", () => {
    const spinner = createSpinner();
    spinner.start("Working...");
    spinner.succeed("Done");

    // succeed already called; stop should be no-op since instance was cleared
    spinner.stop();

    expect(mockInstance.succeed).toHaveBeenCalledTimes(1);
    expect(mockInstance.stop).not.toHaveBeenCalled();
  });
});
