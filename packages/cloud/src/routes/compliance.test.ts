import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AppEnv, Plan, Bindings, Run, Project } from "../types.js";
import { complianceRoutes } from "./compliance.js";
import { testExecutionCtx } from "../test-helpers.js";

// Track stored keys so sign+verify roundtrip works with realistic key storage
let storedKeys: Map<string, { publicKey: string; privateKeyEnc: string; algorithm: string; createdAt: string }>;

// Track runs for sign-report/verify-report tests
let storedRuns: Map<string, Partial<Run>>;
let storedProjects: Map<string, Partial<Project>>;

const mockLogAudit = vi.fn().mockResolvedValue(undefined);

vi.mock("../db/queries.js", () => ({
  getQueries: () => ({
    getSigningKey: vi.fn(async (orgId: string) => {
      return storedKeys.get(orgId) ?? null;
    }),
    createSigningKey: vi.fn(async (orgId: string, publicKey: string, privateKeyEnc: string) => {
      const entry = { publicKey, privateKeyEnc, algorithm: "Ed25519", createdAt: new Date().toISOString() };
      storedKeys.set(orgId, entry);
      return entry;
    }),
    getRun: vi.fn(async (id: string) => {
      return storedRuns.get(id) ?? null;
    }),
    getProject: vi.fn(async (id: string) => {
      return storedProjects.get(id) ?? null;
    }),
    updateRun: vi.fn(async (id: string, fields: Partial<Run>) => {
      const existing = storedRuns.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...fields };
      storedRuns.set(id, updated);
      return updated;
    }),
    logAudit: mockLogAudit,
  }),
}));

const TEST_SIGNING_SECRET = "test-signing-key-secret-for-compliance-tests";

function makeEnv(): Bindings {
  return {
    DB: {} as D1Database,
    ENVIRONMENT: "test",
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    SIGNING_KEY_SECRET: TEST_SIGNING_SECRET,
  };
}

function createMockApp(plan: Plan = "enterprise") {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("auth", {
      org: { id: "org-1", name: "Test Org", plan, createdAt: "", updatedAt: "" },
      token: { id: "tok-1", orgId: "org-1", userId: null, name: "test", tokenHash: "", scope: "full" as const, projectId: null, expiresAt: null, lastUsed: null, createdAt: "", revokedAt: null },
      user: null,
    });
    await next();
  });
  app.route("/v1/compliance", complianceRoutes);
  return app;
}

function req(app: Hono<AppEnv>, url: string, init?: RequestInit) {
  return app.request(url, init, makeEnv(), testExecutionCtx);
}

describe("compliance routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedKeys = new Map();
    storedRuns = new Map();
    storedProjects = new Map();
  });

  it("POST /sign rejects non-enterprise plans", async () => {
    const app = createMockApp("team");
    const res = await req(app, "/v1/compliance/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test report" }),
    });
    expect(res.status).toBe(403);
  });

  it("POST /sign requires content", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/compliance/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST /verify requires content and signature", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/compliance/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test" }),
    });
    expect(res.status).toBe(400);
  });

  it("GET /public-key returns 404 when no key exists", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/compliance/public-key");
    expect(res.status).toBe(404);
  });

  it("POST /sign creates key, signs content, and returns signature", async () => {
    const app = createMockApp("enterprise");
    const res = await req(app, "/v1/compliance/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "EU AI Act Compliance Report v1" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      signature: string;
      publicKey: string;
      algorithm: string;
      signedAt: string;
    };
    expect(body.signature).toBeTruthy();
    expect(body.publicKey).toBeTruthy();
    expect(body.algorithm).toBe("Ed25519");
    expect(body.signedAt).toBeTruthy();

    // Key should have been stored
    expect(storedKeys.has("org-1")).toBe(true);
  });

  it("POST /verify with valid signature returns { valid: true }", async () => {
    const app = createMockApp("enterprise");
    const content = "EU AI Act Compliance Report - Test Content";

    // First, sign the content
    const signRes = await req(app, "/v1/compliance/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    expect(signRes.status).toBe(200);
    const signBody = (await signRes.json()) as { signature: string; publicKey: string };

    // Then, verify the signature
    const verifyRes = await req(app, "/v1/compliance/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, signature: signBody.signature }),
    });

    expect(verifyRes.status).toBe(200);
    const verifyBody = (await verifyRes.json()) as { valid: boolean; algorithm: string };
    expect(verifyBody.valid).toBe(true);
    expect(verifyBody.algorithm).toBe("Ed25519");
  });

  it("POST /verify with tampered content returns { valid: false }", async () => {
    const app = createMockApp("enterprise");
    const content = "Original compliance report content";

    // Sign the original content
    const signRes = await req(app, "/v1/compliance/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    expect(signRes.status).toBe(200);
    const signBody = (await signRes.json()) as { signature: string };

    // Verify with tampered content
    const verifyRes = await req(app, "/v1/compliance/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Tampered compliance report content",
        signature: signBody.signature,
      }),
    });

    expect(verifyRes.status).toBe(200);
    const verifyBody = (await verifyRes.json()) as { valid: boolean };
    expect(verifyBody.valid).toBe(false);
  });

  it("GET /public-key returns the public key after signing", async () => {
    const app = createMockApp("enterprise");

    // First sign something to create a key
    const signRes = await req(app, "/v1/compliance/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test content for key creation" }),
    });
    expect(signRes.status).toBe(200);
    const signBody = (await signRes.json()) as { publicKey: string };

    // Now fetch the public key
    const keyRes = await req(app, "/v1/compliance/public-key");

    expect(keyRes.status).toBe(200);
    const keyBody = (await keyRes.json()) as {
      publicKey: string;
      algorithm: string;
      createdAt: string;
    };
    expect(keyBody.publicKey).toBe(signBody.publicKey);
    expect(keyBody.algorithm).toBe("Ed25519");
    expect(keyBody.createdAt).toBeTruthy();
  });

  // ------- Run-level compliance signing -------

  describe("POST /sign-report", () => {
    it("rejects non-enterprise plans", async () => {
      const app = createMockApp("team");
      const res = await req(app, "/v1/compliance/sign-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });
      expect(res.status).toBe(403);
    });

    it("requires runId", async () => {
      const app = createMockApp("enterprise");
      const res = await req(app, "/v1/compliance/sign-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("runId is required");
    });

    it("returns 404 when run not found", async () => {
      const app = createMockApp("enterprise");
      const res = await req(app, "/v1/compliance/sign-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "nonexistent" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 when run belongs to different org", async () => {
      storedRuns.set("run-1", {
        id: "run-1",
        projectId: "proj-other",
        complianceReport: "# Report",
        complianceSignature: null,
      });
      storedProjects.set("proj-other", {
        id: "proj-other",
        orgId: "org-other", // Different org
        name: "Other Project",
      });

      const app = createMockApp("enterprise");
      const res = await req(app, "/v1/compliance/sign-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 when run has no compliance report", async () => {
      storedRuns.set("run-1", {
        id: "run-1",
        projectId: "proj-1",
        complianceReport: null,
        complianceSignature: null,
      });
      storedProjects.set("proj-1", {
        id: "proj-1",
        orgId: "org-1",
        name: "Test Project",
      });

      const app = createMockApp("enterprise");
      const res = await req(app, "/v1/compliance/sign-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("no compliance report");
    });

    it("returns 409 when report already signed", async () => {
      storedRuns.set("run-1", {
        id: "run-1",
        projectId: "proj-1",
        complianceReport: "# Report",
        complianceSignature: "existing-sig",
      });
      storedProjects.set("proj-1", {
        id: "proj-1",
        orgId: "org-1",
        name: "Test Project",
      });

      const app = createMockApp("enterprise");
      const res = await req(app, "/v1/compliance/sign-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("already signed");
    });

    it("signs a compliance report and stores signature on the run", async () => {
      storedRuns.set("run-1", {
        id: "run-1",
        projectId: "proj-1",
        complianceReport: "# EU AI Act Compliance Report\n\nAll tests passed.",
        complianceSignature: null,
        complianceSignedAt: null,
      });
      storedProjects.set("proj-1", {
        id: "proj-1",
        orgId: "org-1",
        name: "Test Project",
      });

      const app = createMockApp("enterprise");
      const res = await req(app, "/v1/compliance/sign-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        runId: string;
        signature: string;
        publicKey: string;
        algorithm: string;
        signedAt: string;
      };
      expect(body.runId).toBe("run-1");
      expect(body.signature).toBeTruthy();
      expect(body.publicKey).toBeTruthy();
      expect(body.algorithm).toBe("Ed25519");
      expect(body.signedAt).toBeTruthy();

      // Run should have been updated with signature
      const updatedRun = storedRuns.get("run-1");
      expect(updatedRun?.complianceSignature).toBe(body.signature);
      expect(updatedRun?.complianceSignedAt).toBe(body.signedAt);
    });
  });

  describe("POST /verify-report", () => {
    it("rejects non-enterprise plans", async () => {
      const app = createMockApp("team");
      const res = await req(app, "/v1/compliance/verify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });
      expect(res.status).toBe(403);
    });

    it("requires runId", async () => {
      const app = createMockApp("enterprise");
      const res = await req(app, "/v1/compliance/verify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when run has no signed report", async () => {
      storedRuns.set("run-1", {
        id: "run-1",
        projectId: "proj-1",
        complianceReport: "# Report",
        complianceSignature: null,
      });
      storedProjects.set("proj-1", {
        id: "proj-1",
        orgId: "org-1",
        name: "Test Project",
      });

      const app = createMockApp("enterprise");
      const res = await req(app, "/v1/compliance/verify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("no signed compliance report");
    });

    it("sign-report then verify-report roundtrip succeeds", async () => {
      const reportContent = "# EU AI Act Compliance Report\n\nFull test results here.";
      storedRuns.set("run-1", {
        id: "run-1",
        projectId: "proj-1",
        complianceReport: reportContent,
        complianceSignature: null,
        complianceSignedAt: null,
      });
      storedProjects.set("proj-1", {
        id: "proj-1",
        orgId: "org-1",
        name: "Test Project",
      });

      const app = createMockApp("enterprise");

      // Sign the report
      const signRes = await req(app, "/v1/compliance/sign-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });
      expect(signRes.status).toBe(200);

      // Verify the report
      const verifyRes = await req(app, "/v1/compliance/verify-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: "run-1" }),
      });
      expect(verifyRes.status).toBe(200);
      const verifyBody = (await verifyRes.json()) as {
        runId: string;
        valid: boolean;
        algorithm: string;
        signedAt: string;
      };
      expect(verifyBody.runId).toBe("run-1");
      expect(verifyBody.valid).toBe(true);
      expect(verifyBody.algorithm).toBe("Ed25519");
      expect(verifyBody.signedAt).toBeTruthy();
    });
  });
});
