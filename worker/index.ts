// Urdu Core: the domain layer. All clients go client → Urdu Core → D1.
//
// Route groups (mounted here):
//   /api/*    PWA routes; session-cookie middleware. /api/voice/* is the f07 voice Coach:
//             the FR-B5 session broker and its tool relay. /api/admin/* is the sponsor-only
//             import (f02) and rides the same session — no second secret. /api/handoffs
//             is the f06 clipboard paste path, on the same session.
//   /coach/*  Bearer-token routes for external Coach clients: v1 (DECISIONS 260918h).
//
// Order matters: Hono runs handlers in registration order, so everything registered
// before `requireSession` is public.
import { Hono } from "hono";
import { requireJson, requireSession } from "./auth/middleware";
import type { AppEnv } from "./env";
import { adminRoutes } from "./routes/api-admin";
import { lockRoutes, unlockRoutes } from "./routes/api-auth";
import { dashRoutes } from "./routes/api-dash";
import { handoffRoutes } from "./routes/api-handoff";
import { intakeRoutes } from "./routes/api-intake";
import { reviewRoutes } from "./routes/api-review";
import { settingsRoutes } from "./routes/api-settings";
import { vocabRoutes } from "./routes/api-vocab";
import { voiceRoutes } from "./routes/api-voice";

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.use("/api/*", requireJson);

// Public
app.route("/", unlockRoutes);

// Session required from here on
app.use("/api/*", requireSession);
app.route("/", lockRoutes);
app.route("/", handoffRoutes);
app.route("/", intakeRoutes);
app.route("/", vocabRoutes);
app.route("/", reviewRoutes);
app.route("/", settingsRoutes);
app.route("/", dashRoutes);
app.route("/", adminRoutes);
app.route("/", voiceRoutes);

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

export default app;
