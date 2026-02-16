import { Hono } from "hono";
import type { Bindings } from "../types.js";

export const baselineRoutes = new Hono<{ Bindings: Bindings }>();

baselineRoutes.post("/:suiteId/baselines", (c) => {
  void c.req.param("suiteId");
  return c.json({ error: "Not implemented" }, 501);
});

baselineRoutes.get("/:suiteId/baselines", (c) => {
  void c.req.param("suiteId");
  return c.json({ error: "Not implemented" }, 501);
});

baselineRoutes.post("/:baselineId/activate", (c) => {
  void c.req.param("baselineId");
  return c.json({ error: "Not implemented" }, 501);
});

baselineRoutes.delete("/:baselineId", (c) => {
  void c.req.param("baselineId");
  return c.json({ error: "Not implemented" }, 501);
});
