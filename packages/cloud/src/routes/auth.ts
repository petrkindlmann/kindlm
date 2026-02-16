import { Hono } from "hono";
import type { Bindings } from "../types.js";

export const authRoutes = new Hono<{ Bindings: Bindings }>();

authRoutes.post("/tokens", (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

authRoutes.get("/tokens", (c) => {
  return c.json({ error: "Not implemented" }, 501);
});

authRoutes.delete("/tokens/:id", (c) => {
  void c.req.param("id");
  return c.json({ error: "Not implemented" }, 501);
});
