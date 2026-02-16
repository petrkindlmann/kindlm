import { Hono } from "hono";
import type { Bindings } from "../types.js";

export const resultRoutes = new Hono<{ Bindings: Bindings }>();

resultRoutes.post("/:runId/results", (c) => {
  void c.req.param("runId");
  return c.json({ error: "Not implemented" }, 501);
});

resultRoutes.get("/:runId/results", (c) => {
  void c.req.param("runId");
  return c.json({ error: "Not implemented" }, 501);
});
