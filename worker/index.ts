// Urdu Core: the domain layer. All clients go client → Urdu Core → D1.
//
// Route groups (mounted here):
//   /api/*    PWA routes; session-cookie middleware (f01 s04). The FR-B5 voice route joins
//             this group as POST /api/voice/session (f07).
//   /coach/*  Coach routes; separate bearer-token middleware (f06). Not mounted yet.
import { Hono } from "hono";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

export default app;
