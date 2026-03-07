import { describe, it, expect, beforeEach } from "vitest";
import { createMockD1, type MockD1 } from "../test-helpers.js";
import { getQueries } from "./queries.js";

let mockDb: MockD1;
let queries: ReturnType<typeof getQueries>;

beforeEach(() => {
  mockDb = createMockD1();
  queries = getQueries(mockDb as unknown as D1Database);
});

describe("getQueries", () => {
  describe("orgs", () => {
    it("getOrg returns null when not found", async () => {
      const org = await queries.getOrg("nonexistent");
      expect(org).toBeNull();
    });

    it("getOrg maps row correctly", async () => {
      mockDb._configureResponse("SELECT * FROM orgs", {
        first: {
          id: "org-1",
          name: "Acme",
          plan: "team",
          created_at: "2025-01-01",
          updated_at: "2025-01-02",
        },
      });

      const org = await queries.getOrg("org-1");
      expect(org).toEqual({
        id: "org-1",
        name: "Acme",
        plan: "team",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-02",
      });
    });

    it("createOrg inserts and returns org", async () => {
      const org = await queries.createOrg("New Org", "free");
      expect(org.name).toBe("New Org");
      expect(org.plan).toBe("free");
      expect(org.id).toBeTruthy();
    });
  });

  describe("tokens", () => {
    it("getTokenByHash returns null for unknown hash", async () => {
      const token = await queries.getTokenByHash("unknown");
      expect(token).toBeNull();
    });

    it("getTokenByHash maps row correctly", async () => {
      mockDb._configureResponse("SELECT * FROM tokens WHERE token_hash", {
        first: {
          id: "tok-1",
          org_id: "org-1",
          name: "my-token",
          token_hash: "hash123",
          scope: "full",
          project_id: null,
          expires_at: null,
          last_used: null,
          created_at: "2025-01-01",
          revoked_at: null,
        },
      });

      const token = await queries.getTokenByHash("hash123");
      expect(token).toEqual({
        id: "tok-1",
        orgId: "org-1",
        userId: null,
        name: "my-token",
        tokenHash: "hash123",
        scope: "full",
        projectId: null,
        expiresAt: null,
        lastUsed: null,
        createdAt: "2025-01-01",
        revokedAt: null,
      });
    });

    it("createToken returns token with provided fields", async () => {
      const token = await queries.createToken("org-1", "ci-token", "hash", "ci");
      expect(token.orgId).toBe("org-1");
      expect(token.name).toBe("ci-token");
      expect(token.scope).toBe("ci");
      expect(token.revokedAt).toBeNull();
    });

    it("listTokens returns empty array when no tokens", async () => {
      const tokens = await queries.listTokens("org-1");
      expect(tokens).toEqual([]);
    });

    it("revokeToken returns false when not found", async () => {
      const revoked = await queries.revokeToken("nonexistent", "org-1");
      expect(revoked).toBe(false);
    });

    it("revokeToken returns true when found", async () => {
      mockDb._configureResponse("UPDATE tokens SET revoked_at", { changes: 1 });
      const revoked = await queries.revokeToken("tok-1", "org-1");
      expect(revoked).toBe(true);
    });
  });

  describe("projects", () => {
    it("getProject returns null when not found", async () => {
      const project = await queries.getProject("nonexistent");
      expect(project).toBeNull();
    });

    it("createProject returns project", async () => {
      const project = await queries.createProject("org-1", "My Project", "A description");
      expect(project.orgId).toBe("org-1");
      expect(project.name).toBe("My Project");
      expect(project.description).toBe("A description");
    });

    it("countProjects returns 0 when no projects", async () => {
      mockDb._configureResponse("SELECT COUNT", { first: { count: 0 } });
      const count = await queries.countProjects("org-1");
      expect(count).toBe(0);
    });

    it("deleteProject returns false when not found", async () => {
      const deleted = await queries.deleteProject("nonexistent", "org-1");
      expect(deleted).toBe(false);
    });
  });

  describe("suites", () => {
    it("createSuite returns suite with correct fields", async () => {
      const suite = await queries.createSuite("proj-1", "My Suite", "abc123", "desc", "tag1,tag2");
      expect(suite.projectId).toBe("proj-1");
      expect(suite.name).toBe("My Suite");
      expect(suite.configHash).toBe("abc123");
      expect(suite.tags).toBe("tag1,tag2");
    });

    it("getOrCreateSuite creates when not found", async () => {
      const suite = await queries.getOrCreateSuite("proj-1", "New Suite", "hash");
      expect(suite.name).toBe("New Suite");
    });

    it("getOrCreateSuite returns existing when found", async () => {
      mockDb._configureResponse("SELECT * FROM suites WHERE project_id", {
        first: {
          id: "suite-existing",
          project_id: "proj-1",
          name: "Existing",
          description: null,
          config_hash: "oldhash",
          tags: null,
          created_at: "2025-01-01",
          updated_at: "2025-01-01",
        },
      });

      const suite = await queries.getOrCreateSuite("proj-1", "Existing", "newhash");
      expect(suite.id).toBe("suite-existing");
    });
  });

  describe("runs", () => {
    it("createRun returns run with running status", async () => {
      const run = await queries.createRun("proj-1", "suite-1", {
        commitSha: "abc",
        branch: "main",
      });
      expect(run.status).toBe("running");
      expect(run.commitSha).toBe("abc");
      expect(run.branch).toBe("main");
      expect(run.finishedAt).toBeNull();
    });

    it("updateRun with empty fields returns existing run", async () => {
      mockDb._configureResponse("SELECT * FROM runs", {
        first: {
          id: "run-1",
          project_id: "proj-1",
          suite_id: "suite-1",
          status: "running",
          commit_sha: null,
          branch: null,
          environment: null,
          triggered_by: null,
          pass_rate: null,
          drift_score: null,
          schema_fail_count: 0,
          pii_fail_count: 0,
          keyword_fail_count: 0,
          judge_avg_score: null,
          cost_estimate_usd: null,
          latency_avg_ms: null,
          test_count: 0,
          model_count: 0,
          gate_passed: null,
          started_at: "2025-01-01",
          finished_at: null,
          created_at: "2025-01-01",
        },
      });

      const run = await queries.updateRun("run-1", {});
      expect(run).not.toBeNull();
      expect(run?.status).toBe("running");
    });
  });

  describe("results", () => {
    it("createResults calls batch for multiple results", async () => {
      await queries.createResults("run-1", [
        { testCaseName: "test-1", modelId: "gpt-4", passed: 1, passRate: 1.0, runCount: 3 },
        { testCaseName: "test-2", modelId: "gpt-4", passed: 0, passRate: 0.67, runCount: 3 },
      ]);
      expect(mockDb.batch).toHaveBeenCalledOnce();
    });

    it("createResults does not call batch for empty array", async () => {
      await queries.createResults("run-1", []);
      expect(mockDb.batch).not.toHaveBeenCalled();
    });
  });

  describe("baselines", () => {
    it("createBaseline returns baseline with isActive=0", async () => {
      const baseline = await queries.createBaseline("suite-1", "run-1", "v1.0");
      expect(baseline.isActive).toBe(0);
      expect(baseline.label).toBe("v1.0");
    });

    it("deleteBaseline returns false when not found", async () => {
      const deleted = await queries.deleteBaseline("nonexistent");
      expect(deleted).toBe(false);
    });

    it("activateBaseline uses batch for atomic deactivate+activate", async () => {
      const activated = await queries.activateBaseline("bl-1", "suite-1");
      expect(activated).toBe(true);
      expect(mockDb.batch).toHaveBeenCalledOnce();
    });
  });
});
