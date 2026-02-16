import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./types.js";
import { authRoutes } from "./routes/auth.js";
import { projectRoutes } from "./routes/projects.js";
import { suiteRoutes } from "./routes/suites.js";
import { runRoutes } from "./routes/runs.js";
import { resultRoutes } from "./routes/results.js";
import { baselineRoutes } from "./routes/baselines.js";
import { compareRoutes } from "./routes/compare.js";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

app.route("/v1/auth", authRoutes);
app.route("/v1/projects", projectRoutes);
app.route("/v1/suites", suiteRoutes);
app.route("/v1/runs", runRoutes);
app.route("/v1/results", resultRoutes);
app.route("/v1/baselines", baselineRoutes);
app.route("/v1/compare", compareRoutes);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
