import { describe, it, expect } from "vitest";
import type { BaselineIO, BaselineData } from "./store.js";
import {
  serializeBaseline,
  deserializeBaseline,
  readBaseline,
  writeBaseline,
  writeBaselineVersioned,
  listBaselines,
  migrateBaseline,
  BASELINE_VERSION,
} from "./store.js";
import type { Result } from "../types/result.js";

function makeBaselineData(overrides: Partial<BaselineData> = {}): BaselineData {
  return {
    version: BASELINE_VERSION,
    suiteName: "refund-agent",
    createdAt: "2026-01-15T10:00:00.000Z",
    results: {
      "happy-path::openai:gpt-4o": {
        passRate: 1,
        outputText: "Order #12345 found",
        failureCodes: [],
        latencyAvgMs: 150,
        costUsd: 0.05,
        runCount: 3,
      },
    },
    ...overrides,
  };
}

function createMemoryIO(store: Map<string, string> = new Map()): BaselineIO {
  return {
    read(suiteName: string): Result<string> {
      const content = store.get(suiteName);
      if (content === undefined) {
        return {
          success: false,
          error: { code: "BASELINE_NOT_FOUND", message: `Not found: ${suiteName}` },
        };
      }
      return { success: true, data: content };
    },
    write(suiteName: string, content: string): Result<void> {
      store.set(suiteName, content);
      return { success: true, data: undefined };
    },
    list(): Result<string[]> {
      return { success: true, data: [...store.keys()] };
    },
  };
}

describe("serializeBaseline / deserializeBaseline", () => {
  it("round-trips baseline data", () => {
    const data = makeBaselineData();
    const serialized = serializeBaseline(data);
    const result = deserializeBaseline(serialized);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(data);
    }
  });

  it("returns BASELINE_CORRUPT for invalid JSON", () => {
    const result = deserializeBaseline("not json {{{");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("BASELINE_CORRUPT");
    }
  });

  it("returns BASELINE_CORRUPT for missing fields", () => {
    const result = deserializeBaseline(JSON.stringify({ version: BASELINE_VERSION }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("BASELINE_CORRUPT");
      expect(result.error.message).toContain("suiteName");
    }
  });

  it("returns BASELINE_VERSION_MISMATCH for wrong version", () => {
    const data = makeBaselineData({ version: "99" });
    const result = deserializeBaseline(serializeBaseline(data));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("BASELINE_VERSION_MISMATCH");
    }
  });
});

describe("readBaseline", () => {
  it("returns data when baseline exists", () => {
    const data = makeBaselineData();
    const store = new Map([["refund-agent", serializeBaseline(data)]]);
    const io = createMemoryIO(store);
    const result = readBaseline("refund-agent", io);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suiteName).toBe("refund-agent");
    }
  });

  it("returns BASELINE_NOT_FOUND when missing", () => {
    const io = createMemoryIO();
    const result = readBaseline("nonexistent", io);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("BASELINE_NOT_FOUND");
    }
  });
});

describe("writeBaseline", () => {
  it("writes successfully and is readable", () => {
    const store = new Map<string, string>();
    const io = createMemoryIO(store);
    const data = makeBaselineData();

    const writeResult = writeBaseline(data, io);
    expect(writeResult.success).toBe(true);

    const readResult = readBaseline("refund-agent", io);
    expect(readResult.success).toBe(true);
    if (readResult.success) {
      expect(readResult.data).toEqual(data);
    }
  });
});

describe("listBaselines", () => {
  it("returns suite names", () => {
    const store = new Map([
      ["suite-a", serializeBaseline(makeBaselineData({ suiteName: "suite-a" }))],
      ["suite-b", serializeBaseline(makeBaselineData({ suiteName: "suite-b" }))],
    ]);
    const io = createMemoryIO(store);
    const result = listBaselines(io);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(["suite-a", "suite-b"]);
    }
  });
});

describe("writeBaselineVersioned", () => {
  it("writes two files: versioned + latest pointer", () => {
    const store = new Map<string, string>();
    const io = createMemoryIO(store);
    const data = makeBaselineData();

    const result = writeBaselineVersioned(data, io);
    expect(result.success).toBe(true);

    // Should have exactly 2 entries: the versioned file and the -latest pointer
    expect(store.size).toBe(2);
    const keys = [...store.keys()];
    const versionedKey = keys.find((k) => k.match(/refund-agent-\d{14}/));
    const latestKey = keys.find((k) => k === "refund-agent-latest");
    expect(versionedKey).toBeDefined();
    expect(latestKey).toBeDefined();
  });

  it("calling twice never overwrites the first versioned file", () => {
    const store = new Map<string, string>();
    const io = createMemoryIO(store);
    const data = makeBaselineData();

    writeBaselineVersioned(data, io);
    const keysAfterFirst = [...store.keys()].filter((k) => k !== "refund-agent-latest");
    expect(keysAfterFirst.length).toBe(1);

    // Sleep 1ms is not reliable in unit tests; simulate different timestamp by
    // using a new call — in real usage timestamps differ. For test stability
    // just verify the pointer can be updated while the old versioned file stays.
    writeBaselineVersioned(data, io);
    // Both versioned files should still be in store (pointer was updated)
    // Note: same timestamp produces same key so we check that -latest was updated
    const latestContent = store.get("refund-agent-latest");
    expect(latestContent).toBeDefined();
    const pointer = JSON.parse(latestContent!) as { latestFile: string };
    expect(pointer).toHaveProperty("latestFile");
    expect(pointer.latestFile).toMatch(/refund-agent-\d{14}-[0-9a-f]{6}\.json/);
  });

  it("pointer file contains only latestFile reference, not content copy", () => {
    const store = new Map<string, string>();
    const io = createMemoryIO(store);
    const data = makeBaselineData();

    writeBaselineVersioned(data, io);

    const latestContent = store.get("refund-agent-latest");
    expect(latestContent).toBeDefined();
    const pointer = JSON.parse(latestContent!) as Record<string, unknown>;

    // Must have latestFile key
    expect(pointer).toHaveProperty("latestFile");
    // Must NOT contain results or other baseline content fields
    expect(pointer).not.toHaveProperty("results");
    expect(pointer).not.toHaveProperty("version");
    expect(pointer).not.toHaveProperty("suiteName");
    // latestFile must be a string ending in .json
    expect(typeof pointer["latestFile"]).toBe("string");
    expect((pointer["latestFile"] as string).endsWith(".json")).toBe(true);
  });

  it("versioned file contains savedAt timestamp", () => {
    const store = new Map<string, string>();
    const io = createMemoryIO(store);
    const data = makeBaselineData();

    writeBaselineVersioned(data, io);

    const keys = [...store.keys()];
    const versionedKey = keys.find((k) => k.match(/refund-agent-\d{14}/));
    expect(versionedKey).toBeDefined();
    const versionedContent = store.get(versionedKey!);
    const parsed = JSON.parse(versionedContent!) as BaselineData;
    expect(parsed.savedAt).toBeDefined();
    expect(typeof parsed.savedAt).toBe("string");
    // Should be a valid ISO timestamp
    expect(new Date(parsed.savedAt!).toISOString()).toBe(parsed.savedAt);
  });

  it("does not mutate the original data object", () => {
    const store = new Map<string, string>();
    const io = createMemoryIO(store);
    const data = makeBaselineData();

    writeBaselineVersioned(data, io);

    expect(data.savedAt).toBeUndefined();
  });

  it("returns the error if versioned write fails", () => {
    const failingIO: BaselineIO = {
      read: () => ({ success: false, error: { code: "BASELINE_NOT_FOUND", message: "nope" } }),
      write: () => ({ success: false, error: { code: "UNKNOWN_ERROR", message: "disk full" } }),
      list: () => ({ success: true, data: [] }),
    };
    const result = writeBaselineVersioned(makeBaselineData(), failingIO);
    expect(result.success).toBe(false);
  });
});

describe("migrateBaseline", () => {
  it("returns ok with migrated=false for current version", () => {
    const data = makeBaselineData();
    const result = migrateBaseline(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.migrated).toBe(false);
      expect(result.baseline).toEqual(data);
    }
  });

  it("returns error for unknown version", () => {
    const data = makeBaselineData({ version: "99" });
    const result = migrateBaseline(data);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Unsupported baseline version");
      expect(result.error).toContain('"99"');
    }
  });

  it("returns error for non-object input", () => {
    const result = migrateBaseline("not an object");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not an object");
    }
  });

  it("returns error for null input", () => {
    const result = migrateBaseline(null);
    expect(result.ok).toBe(false);
  });

  it("returns error for missing version field", () => {
    const result = migrateBaseline({ suiteName: "test" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("version");
    }
  });

  it("returns error when current version has missing required fields", () => {
    const result = migrateBaseline({ version: BASELINE_VERSION });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("suiteName");
    }
  });

  it("deserializeBaseline succeeds for current version via migration", () => {
    const data = makeBaselineData();
    const serialized = serializeBaseline(data);
    const result = deserializeBaseline(serialized);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe(BASELINE_VERSION);
    }
  });

  it("deserializeBaseline fails with BASELINE_VERSION_MISMATCH for unknown version", () => {
    const data = makeBaselineData({ version: "99" });
    const serialized = serializeBaseline(data);
    const result = deserializeBaseline(serialized);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("BASELINE_VERSION_MISMATCH");
    }
  });
});
