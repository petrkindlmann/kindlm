import { Hono } from "hono";
import type { Bindings } from "../types.js";

export const runRoutes = new Hono<{ Bindings: Bindings }>();

runRoutes.post("/:projectId/runs", (c) => {
  void c.req.param("projectId");
  return c.json({ error: "Not implemented" }, 501);
});

runRoutes.get("/:runId", (c) => {
  void c.req.param("runId");
  return c.json({ error: "Not implemented" }, 501);
});

runRoutes.patch("/:runId", (c) => {
  void c.req.param("runId");
  return c.json({ error: "Not implemented" }, 501);
});

runRoutes.get("/:projectId/runs", (c) => {
  void c.req.param("projectId");
  return c.json({ error: "Not implemented" }, 501);
});
