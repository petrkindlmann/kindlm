import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import { registerLoginCommand } from "./login.js";

vi.mock("../cloud/auth.js", () => ({
  loadToken: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
}));

vi.mock("../cloud/client.js", () => ({
  createCloudClient: vi.fn(),
  getCloudUrl: vi.fn(() => "https://api.kindlm.com"),
  CloudApiError: class CloudApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "CloudApiError";
      this.status = status;
    }
  },
}));

import { loadToken, saveToken, clearToken } from "../cloud/auth.js";
import { createCloudClient, CloudApiError } from "../cloud/client.js";

const mockLoadToken = vi.mocked(loadToken);
const mockSaveToken = vi.mocked(saveToken);
const mockClearToken = vi.mocked(clearToken);
const mockCreateCloudClient = vi.mocked(createCloudClient);

describe("login command", () => {
  let program: Command;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerLoginCommand(program);

    logs = [];
    errors = [];
    exitCode = undefined;

    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });
  });

  it("accepts a valid klm_ token via --token flag", async () => {
    const mockClient = { get: vi.fn().mockResolvedValue({}), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), baseUrl: "" };
    mockCreateCloudClient.mockReturnValue(mockClient);

    try {
      await program.parseAsync(["node", "kindlm", "login", "--token", "klm_abc123"]);
    } catch {
      // commander exitOverride
    }

    expect(mockSaveToken).toHaveBeenCalledWith("klm_abc123");
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Authenticated successfully");
  });

  it("rejects a token that does not start with klm_", async () => {
    try {
      await program.parseAsync(["node", "kindlm", "login", "--token", "sk-invalid-token"]);
    } catch {
      // process.exit throws
    }

    expect(exitCode).toBe(1);
    expect(mockSaveToken).not.toHaveBeenCalled();
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("Invalid token format");
  });

  it("--logout clears stored token", async () => {
    try {
      await program.parseAsync(["node", "kindlm", "login", "--logout"]);
    } catch {
      // commander exitOverride
    }

    expect(mockClearToken).toHaveBeenCalledOnce();
    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Logged out");
  });

  it("--status shows authenticated state when token is valid", async () => {
    mockLoadToken.mockReturnValue("klm_valid123");
    const mockClient = { get: vi.fn().mockResolvedValue({}), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), baseUrl: "" };
    mockCreateCloudClient.mockReturnValue(mockClient);

    try {
      await program.parseAsync(["node", "kindlm", "login", "--status"]);
    } catch {
      // commander exitOverride
    }

    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Authenticated");
  });

  it("--status shows not authenticated when no token exists", async () => {
    mockLoadToken.mockReturnValue(null);

    try {
      await program.parseAsync(["node", "kindlm", "login", "--status"]);
    } catch {
      // commander exitOverride
    }

    const allOutput = logs.join("\n");
    expect(allOutput).toContain("Not authenticated");
  });

  it("rejects token when Cloud API returns 401", async () => {
    const mockClient = {
      get: vi.fn().mockRejectedValue(new CloudApiError(401, "Unauthorized")),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      baseUrl: "",
    };
    mockCreateCloudClient.mockReturnValue(mockClient);

    try {
      await program.parseAsync(["node", "kindlm", "login", "--token", "klm_expired999"]);
    } catch {
      // process.exit throws
    }

    expect(exitCode).toBe(1);
    expect(mockSaveToken).not.toHaveBeenCalled();
    const allErrors = errors.join("\n");
    expect(allErrors).toContain("Invalid or expired token");
  });
});
