import { Hono } from "hono";
import type { Bindings } from "../types.js";

export const suiteRoutes = new Hono<{ Bindings: Bindings }>();

suiteRoutes.post("/:projectId/suites", (c) => {
  void c.req.param("projectId");
  return c.json({ error: "Not implemented" }, 501);
});

suiteRoutes.get("/:projectId/suites", (c) => {
  void c.req.param("projectId");
  return c.json({ error: "Not implemented" }, 501);
});

suiteRoutes.get("/:suiteId", (c) => {
  void c.req.param("suiteId");
  return c.json({ error: "Not implemented" }, 501);
});
