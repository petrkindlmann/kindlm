import { Hono } from "hono";
import type { Bindings } from "../types.js";

export const compareRoutes = new Hono<{ Bindings: Bindings }>();

compareRoutes.get("/:runId/compare", (c) => {
  void c.req.param("runId");
  return c.json({ error: "Not implemented" }, 501);
});
