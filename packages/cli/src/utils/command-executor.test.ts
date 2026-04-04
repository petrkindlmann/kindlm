import { describe, it, expect } from "vitest";
import { createNodeCommandExecutor } from "./command-executor.js";

const isWindows = process.platform === "win32";

describe.skipIf(isWindows)("NodeCommandExecutor", () => {
  const executor = createNodeCommandExecutor();

  it("returns stdout for a successful command", async () => {
    const result = await executor.execute('echo "hello world"', {
      cwd: "/tmp",
      env: {},
      timeoutMs: 5000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stdout.trim()).toBe("hello world");
      expect(result.data.exitCode).toBe(0);
    }
  });

  it("returns stderr and non-zero exit code for a failed command", async () => {
    const result = await executor.execute("sh -c 'echo fail >&2; exit 2'", {
      cwd: "/tmp",
      env: {},
      timeoutMs: 5000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stderr.trim()).toBe("fail");
      expect(result.data.exitCode).toBe(2);
    }
  });

  it("returns timeout error when command exceeds timeoutMs", async () => {
    const result = await executor.execute("sleep 10", {
      cwd: "/tmp",
      env: {},
      timeoutMs: 200,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("PROVIDER_TIMEOUT");
      expect(result.error.message).toContain("timed out");
    }
  });

  it("passes environment variables to the child process", async () => {
    const result = await executor.execute('echo "$TEST_VAR_XYZ"', {
      cwd: "/tmp",
      env: { TEST_VAR_XYZ: "custom_value" },
      timeoutMs: 5000,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stdout.trim()).toBe("custom_value");
    }
  });
});
