/* eslint-disable no-console */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock node:fs before importing the module under test
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  rmSync: vi.fn(),
  statSync: vi.fn(),
}));

import * as fs from "node:fs";
import { Command } from "commander";

// We'll import after mocks are set up
import { registerCacheCommand } from "./cache.js";

function createProgram(): Command {
  const program = new Command();
  program.exitOverride(); // prevent process.exit in tests
  registerCacheCommand(program);
  return program;
}

describe("registerCacheCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("prints 'Cache is empty' when cache directory does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const program = createProgram();
    await program.parseAsync(["node", "kindlm", "cache", "clear"]);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Cache is empty"),
    );
  });

  it("deletes all json files and subdirs when cache has entries", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockImplementation((dirPath: unknown) => {
      const path = dirPath as string;
      if (path.endsWith("cache")) {
        return ["ab", "cd"] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      if (path.endsWith("ab")) {
        return ["ab1234.json"] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      if (path.endsWith("cd")) {
        return ["cd5678.json", "cdabcd.json"] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      return [] as unknown as ReturnType<typeof fs.readdirSync>;
    });
    vi.mocked(fs.statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof fs.statSync>);

    const program = createProgram();
    await program.parseAsync(["node", "kindlm", "cache", "clear"]);

    // 3 file removals (ab1234.json, cd5678.json, cdabcd.json)
    // The rmSync calls for files: 3 times
    // The rmSync calls for subdirs: up to 2 times (may fail silently)
    const rmCalls = vi.mocked(fs.rmSync).mock.calls;
    const fileCalls = rmCalls.filter(([, opts]) => !opts || !(opts as { recursive?: boolean }).recursive);
    expect(fileCalls.length).toBe(3);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Cleared 3 cached response"),
    );
  });

  it("accumulates byte count from statSync", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockImplementation((dirPath: unknown) => {
      const path = dirPath as string;
      if (path.endsWith("cache")) {
        return ["ab"] as unknown as ReturnType<typeof fs.readdirSync>;
      }
      return ["ab1111.json", "ab2222.json"] as unknown as ReturnType<typeof fs.readdirSync>;
    });
    // Each file is 5120 bytes = 5 KB, two files = 10 KB
    vi.mocked(fs.statSync).mockReturnValue({ size: 5120 } as ReturnType<typeof fs.statSync>);

    const program = createProgram();
    await program.parseAsync(["node", "kindlm", "cache", "clear"]);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("10.0 KB freed"),
    );
  });

  it("reports 0 cached responses when subdirs are empty", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);

    const program = createProgram();
    await program.parseAsync(["node", "kindlm", "cache", "clear"]);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Cleared 0 cached responses"),
    );
  });
});
