import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock chokidar before importing module under test
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn().mockReturnThis();
const mockWatch = vi.fn().mockReturnValue({ on: mockOn, close: mockClose });

vi.mock("chokidar", () => ({ watch: mockWatch }));

// Import after mock setup
const { watchFiles } = await import("./watcher.js");

describe("watchFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOn.mockReturnThis();
    mockClose.mockResolvedValue(undefined);
    mockWatch.mockReturnValue({ on: mockOn, close: mockClose });
  });

  it("calls chokidar.watch() with the provided paths array", () => {
    const paths = ["/path/to/kindlm.yaml", "/path/to/other.yaml"];
    const onChange = vi.fn();
    const handle = watchFiles(paths, onChange);

    expect(mockWatch).toHaveBeenCalledWith(paths, expect.any(Object));

    handle.close();
  });

  it("passes ignoreInitial: true and awaitWriteFinish defaults to chokidar", () => {
    const onChange = vi.fn();
    const handle = watchFiles(["/path/to/file.yaml"], onChange);

    expect(mockWatch).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
      }),
    );

    handle.close();
  });

  it("forwards custom stabilityThreshold to chokidar options", () => {
    const onChange = vi.fn();
    const handle = watchFiles(["/path/to/file.yaml"], onChange, {
      stabilityThreshold: 500,
    });

    expect(mockWatch).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
      }),
    );

    handle.close();
  });

  it("triggers onChange callback on 'change' event", () => {
    const onChange = vi.fn();
    watchFiles(["/path/to/file.yaml"], onChange);

    // Find the change event handler registered via .on("change", handler)
    const changeCall = mockOn.mock.calls.find(([event]) => event === "change");
    expect(changeCall).toBeDefined();
    const changeHandler = changeCall?.[1] as () => void;

    changeHandler();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("triggers onChange callback on 'add' event", () => {
    const onChange = vi.fn();
    watchFiles(["/path/to/file.yaml"], onChange);

    const addCall = mockOn.mock.calls.find(([event]) => event === "add");
    expect(addCall).toBeDefined();
    const addHandler = addCall?.[1] as () => void;

    addHandler();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls watcher.close() on the chokidar instance when close() is called", () => {
    const onChange = vi.fn();
    const handle = watchFiles(["/path/to/file.yaml"], onChange);

    handle.close();

    expect(mockClose).toHaveBeenCalled();
  });
});
