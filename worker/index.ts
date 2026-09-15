// Urdu Core: the domain layer. All clients go client → Urdu Core → D1.
//
// Route groups (mounted here):
//   /api/*    PWA routes; session-cookie middleware. The FR-B5 voice route joins this
//             group as POST /api/voice/session (f07).
//   /coach/*  Coach routes; separate bearer-token middleware (f06). Not mounted yet.
//
// Order matters: Hono runs handlers in registration order, so everything registered
// before `requireSession` is public.
import { Hono } from "hono";
import { requireJson, requireSession } from "./auth/middleware";
import type { AppEnv } from "./env";
import { lockRoutes, unlockRoutes } from "./routes/api-auth";
import { reviewRoutes } from "./routes/api-review";
import { vocabRoutes } from "./routes/api-vocab";

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.use("/api/*", requireJson);

// Public
app.route("/", unlockRoutes);

// Session required from here on
app.use("/api/*", requireSession);
app.route("/", lockRoutes);
app.route("/", vocabRoutes);
app.route("/", reviewRoutes);

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

export default app;
