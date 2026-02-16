import { Hono } from "hono";
import type { Bindings } from "../types.js";

export const projectRoutes = new Hono<{ Bindings: Bindings }>();

projectRoutes.post("/", (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

projectRoutes.get("/", (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

projectRoutes.get("/:projectId", (c) => {
  void c.req.param("projectId");
  return c.json({ error: "Not implemented" }, 501);
});

projectRoutes.delete("/:projectId", (c) => {
  void c.req.param("projectId");
  return c.json({ error: "Not implemented" }, 501);
});
