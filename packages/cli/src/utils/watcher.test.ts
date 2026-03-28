import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock node:fs before importing the module under test
const mockWatchClose = vi.fn();
const mockWatch = vi.fn().mockReturnValue({ close: mockWatchClose });

vi.mock("node:fs", () => ({
  watch: mockWatch,
}));

// Import after mock setup
const { watchFile } = await import("./watcher.js");

describe("watchFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls fs.watch with the given file path", () => {
    const onChange = vi.fn();
    const watcher = watchFile("/path/to/kindlm.yaml", onChange);

    expect(mockWatch).toHaveBeenCalledWith(
      "/path/to/kindlm.yaml",
      expect.any(Function),
    );

    watcher.close();
  });

  it("debounces rapid changes", () => {
    const onChange = vi.fn();
    watchFile("/path/to/kindlm.yaml", onChange, { debounceMs: 200 });

    // Get the callback that was passed to fs.watch
    const watchCallback = mockWatch.mock.calls[0]![1] as () => void;

    // Simulate rapid file changes
    watchCallback();
    watchCallback();
    watchCallback();

    // onChange should not have been called yet
    expect(onChange).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(200);

    // Should only fire once
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("uses default debounce of 300ms when not specified", () => {
    const onChange = vi.fn();
    watchFile("/path/to/kindlm.yaml", onChange);

    const watchCallback = mockWatch.mock.calls[0]![1] as () => void;
    watchCallback();

    // At 299ms, not fired yet
    vi.advanceTimersByTime(299);
    expect(onChange).not.toHaveBeenCalled();

    // At 300ms, fires
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("fires again after debounce period for subsequent changes", () => {
    const onChange = vi.fn();
    watchFile("/path/to/kindlm.yaml", onChange, { debounceMs: 100 });

    const watchCallback = mockWatch.mock.calls[0]![1] as () => void;

    // First change
    watchCallback();
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Second change
    watchCallback();
    vi.advanceTimersByTime(100);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("closes the fs.watch handle on close()", () => {
    const onChange = vi.fn();
    const watcher = watchFile("/path/to/kindlm.yaml", onChange);

    watcher.close();

    expect(mockWatchClose).toHaveBeenCalled();
  });

  it("clears pending timer on close()", () => {
    const onChange = vi.fn();
    const watcher = watchFile("/path/to/kindlm.yaml", onChange, {
      debounceMs: 500,
    });

    const watchCallback = mockWatch.mock.calls[0]![1] as () => void;
    watchCallback();

    // Close before debounce fires
    watcher.close();
    vi.advanceTimersByTime(500);

    // onChange should never fire
    expect(onChange).not.toHaveBeenCalled();
  });
});
