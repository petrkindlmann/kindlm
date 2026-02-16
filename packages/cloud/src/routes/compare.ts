import { Hono } from "hono";
import type { AppEnv, TestResult } from "../types.js";
import { getQueries } from "../db/queries.js";

interface ResultDiff {
  testCaseName: string;
  modelId: string;
  status: "regression" | "improvement" | "unchanged" | "new" | "removed";
  baselinePassRate: number | null;
  currentPassRate: number | null;
  delta: number | null;
}

export const compareRoutes = new Hono<AppEnv>();

// GET /:runId/compare — Compare run against active baseline
compareRoutes.get("/:runId/compare", async (c) => {
  const runId = c.req.param("runId");
  const auth = c.get("auth");
  const queries = getQueries(c.env.DB);

  const run = await queries.getRun(runId);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }

  const project = await queries.getProject(run.projectId);
  if (!project || project.orgId !== auth.org.id) {
    return c.json({ error: "Run not found" }, 404);
  }

  const activeBaseline = await queries.getActiveBaseline(run.suiteId);
  if (!activeBaseline) {
    return c.json({ hasBaseline: false });
  }

  const baselineResults = await queries.listResults(activeBaseline.runId);
  const currentResults = await queries.listResults(runId);

  const baselineMap = new Map<string, TestResult>();
  for (const r of baselineResults) {
    baselineMap.set(`${r.testCaseName}::${r.modelId}`, r);
  }

  const currentMap = new Map<string, TestResult>();
  for (const r of currentResults) {
    currentMap.set(`${r.testCaseName}::${r.modelId}`, r);
  }

  const diffs: ResultDiff[] = [];

  // Check current results against baseline
  for (const [key, current] of currentMap) {
    const baseline = baselineMap.get(key);
    if (!baseline) {
      diffs.push({
        testCaseName: current.testCaseName,
        modelId: current.modelId,
        status: "new",
        baselinePassRate: null,
        currentPassRate: current.passRate,
        delta: null,
      });
    } else {
      const delta = current.passRate - baseline.passRate;
      let status: ResultDiff["status"] = "unchanged";
      if (delta < -0.001) status = "regression";
      else if (delta > 0.001) status = "improvement";

      diffs.push({
        testCaseName: current.testCaseName,
        modelId: current.modelId,
        status,
        baselinePassRate: baseline.passRate,
        currentPassRate: current.passRate,
        delta: Math.round(delta * 10000) / 10000,
      });
    }
  }

  // Check for removed tests
  for (const [key, baseline] of baselineMap) {
    if (!currentMap.has(key)) {
      diffs.push({
        testCaseName: baseline.testCaseName,
        modelId: baseline.modelId,
        status: "removed",
        baselinePassRate: baseline.passRate,
        currentPassRate: null,
        delta: null,
      });
    }
  }

  const summary = {
    regressions: diffs.filter((d) => d.status === "regression").length,
    improvements: diffs.filter((d) => d.status === "improvement").length,
    unchanged: diffs.filter((d) => d.status === "unchanged").length,
    new: diffs.filter((d) => d.status === "new").length,
    removed: diffs.filter((d) => d.status === "removed").length,
  };

  return c.json({
    hasBaseline: true,
    baseline: {
      id: activeBaseline.id,
      label: activeBaseline.label,
      runId: activeBaseline.runId,
    },
    summary,
    diffs,
  });
});
