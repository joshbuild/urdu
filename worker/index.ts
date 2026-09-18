// Urdu Core: the domain layer. All clients go client → Urdu Core → D1.
//
// Route groups (mounted here):
//   /api/*    PWA routes; session-cookie middleware. The FR-B5 voice route joins this
//             group as POST /api/voice/session (f07). /api/admin/* is the sponsor-only
//             import (f02) and rides the same session — no second secret. /api/handoffs
//             is the f06 clipboard paste path, on the same session.
//   /coach/*  Coach routes; separate bearer-token middleware (f06). Not mounted yet.
//
// Order matters: Hono runs handlers in registration order, so everything registered
// before `requireSession` is public.
import { Hono } from "hono";
import { requireJson, requireSession } from "./auth/middleware";
import type { AppEnv } from "./env";
import { adminRoutes } from "./routes/api-admin";
import { lockRoutes, unlockRoutes } from "./routes/api-auth";
import { handoffRoutes } from "./routes/api-handoff";
import { reviewRoutes } from "./routes/api-review";
import { settingsRoutes } from "./routes/api-settings";
import { vocabRoutes } from "./routes/api-vocab";

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.use("/api/*", requireJson);

// Public
app.route("/", unlockRoutes);

// Session required from here on
app.use("/api/*", requireSession);
app.route("/", lockRoutes);
// Before vocabRoutes, so /api/vocab/incomplete is not read as an item id.
app.route("/", handoffRoutes);
app.route("/", vocabRoutes);
app.route("/", reviewRoutes);
app.route("/", settingsRoutes);
app.route("/", adminRoutes);

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

export default app;
