// POST /api/unlock (public, rate-limited) and POST /api/lock (session).

import { Hono } from "hono";
import { clearSessionCookie, setSessionCookie } from "../auth/cookie";
import { MIN_SECRET_LENGTH, newSessionToken, secretMatches, sha256Hex } from "../auth/crypto";
import { createSession, deleteSession } from "../auth/sessions";
import type { AppEnv } from "../env";

export const unlockRoutes = new Hono<AppEnv>();

unlockRoutes.post("/api/unlock", async (c) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const { success } = await c.env.UNLOCK_LIMITER.limit({ key: `unlock:${ip}` });
  if (!success) return c.json({ error: "too_many_attempts" }, 429);

  const expected = c.env.UNLOCK_SECRET;
  if (typeof expected !== "string" || expected.length < MIN_SECRET_LENGTH) {
    console.error("UNLOCK_SECRET is missing or shorter than 24 characters");
    return c.json({ error: "server_misconfigured" }, 500);
  }

  const body = await c.req.json<unknown>().catch(() => null);
  const secret =
    body && typeof body === "object" && "secret" in body
      ? (body as { secret: unknown }).secret
      : null;
  if (typeof secret !== "string") return c.json({ error: "invalid_request" }, 400);

  if (!(await secretMatches(secret, expected))) {
    return c.json({ error: "wrong_secret" }, 401);
  }

  const token = newSessionToken();
  await createSession(
    c.env.DB,
    await sha256Hex(token),
    new Date(),
    c.req.header("User-Agent") ?? null,
  );
  setSessionCookie(c, token);
  c.header("Cache-Control", "no-store");
  return c.json({ ok: true });
});

export const lockRoutes = new Hono<AppEnv>();

// Mounted behind requireSession in worker/index.ts.
lockRoutes.post("/api/lock", async (c) => {
  await deleteSession(c.env.DB, c.get("sessionId"));
  clearSessionCookie(c);
  return c.json({ ok: true });
});
