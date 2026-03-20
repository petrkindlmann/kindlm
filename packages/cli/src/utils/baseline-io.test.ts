import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFileBaselineIO } from "./baseline-io.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockReaddirSync = vi.mocked(readdirSync);

describe("FileBaselineIO", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("write", () => {
    it("creates directory and writes file", () => {
      const io = createFileBaselineIO("/project/.kindlm");

      const result = io.write("my-suite", '{"version":"1"}');

      expect(result.success).toBe(true);
      expect(mockMkdirSync).toHaveBeenCalledWith(
        "/project/.kindlm/baselines",
        { recursive: true },
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "/project/.kindlm/baselines/my-suite.json",
        '{"version":"1"}',
        "utf-8",
      );
    });

    it("returns error when write fails", () => {
      mockMkdirSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const io = createFileBaselineIO("/project/.kindlm");
      const result = io.write("my-suite", "{}");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Permission denied");
      }
    });
  });

  describe("read", () => {
    it("returns file content", () => {
      mockReadFileSync.mockReturnValue('{"version":"1","suiteName":"my-suite"}' as never);

      const io = createFileBaselineIO("/project/.kindlm");
      const result = io.read("my-suite");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain("my-suite");
      }
      expect(mockReadFileSync).toHaveBeenCalledWith(
        "/project/.kindlm/baselines/my-suite.json",
        "utf-8",
      );
    });

    it("returns error when file does not exist", () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      const io = createFileBaselineIO("/project/.kindlm");
      const result = io.read("missing-suite");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("BASELINE_NOT_FOUND");
      }
    });
  });

  describe("list", () => {
    it("returns baseline names from .json files", () => {
      mockReaddirSync.mockReturnValue(["suite-a.json", "suite-b.json", "readme.txt"] as never);

      const io = createFileBaselineIO("/project/.kindlm");
      const result = io.list();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(["suite-a", "suite-b"]);
      }
    });

    it("creates baselines directory if it does not exist", () => {
      mockReaddirSync.mockReturnValue([] as never);

      const io = createFileBaselineIO("/project/.kindlm");
      io.list();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        "/project/.kindlm/baselines",
        { recursive: true },
      );
    });

    it("returns empty array when no JSON files exist", () => {
      mockReaddirSync.mockReturnValue([] as never);

      const io = createFileBaselineIO("/project/.kindlm");
      const result = io.list();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });
  });

  describe("sanitizeFilename", () => {
    it("replaces special characters with underscores", () => {
      mockReadFileSync.mockReturnValue("{}" as never);

      const io = createFileBaselineIO("/project/.kindlm");
      io.read("my suite/with:special<chars>");

      // sanitizeFilename should convert special chars to underscores
      expect(mockReadFileSync).toHaveBeenCalledWith(
        "/project/.kindlm/baselines/my_suite_with_special_chars_.json",
        "utf-8",
      );
    });

    it("preserves hyphens and underscores", () => {
      mockReadFileSync.mockReturnValue("{}" as never);

      const io = createFileBaselineIO("/project/.kindlm");
      io.read("my-suite_v2");

      expect(mockReadFileSync).toHaveBeenCalledWith(
        "/project/.kindlm/baselines/my-suite_v2.json",
        "utf-8",
      );
    });

    it("two different names can map to the same sanitized filename", () => {
      // "my suite" and "my+suite" both sanitize to "my_suite"
      mockReadFileSync.mockReturnValue("{}" as never);

      const io = createFileBaselineIO("/project/.kindlm");
      io.read("my suite");

      const firstCall = mockReadFileSync.mock.calls[0]?.[0];

      mockReadFileSync.mockClear();
      mockReadFileSync.mockReturnValue("{}" as never);

      io.read("my+suite");

      const secondCall = mockReadFileSync.mock.calls[0]?.[0];

      expect(firstCall).toBe(secondCall);
    });
  });
});
