import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";
import { clearSessionCookie, readSessionCookie } from "./cookie";
import { sha256Hex } from "./crypto";
import { findSession, touchSession } from "./sessions";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Every state-changing request must declare a JSON body. A cross-site form can't send
// that content type without a CORS preflight, which together with SameSite=Strict
// closes CSRF.
export const requireJson = createMiddleware<AppEnv>(async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const mediaType = c.req.header("Content-Type")?.split(";")[0]?.trim().toLowerCase();
    if (mediaType !== "application/json") {
      return c.json({ error: "unsupported_media_type" }, 415);
    }
  }
  await next();
});

export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const token = readSessionCookie(c);
  const session = token ? await findSession(c.env.DB, await sha256Hex(token)) : null;
  if (!session) {
    if (token) clearSessionCookie(c);
    return c.json({ error: "unauthorized" }, 401);
  }
  await touchSession(c.env.DB, session, new Date());
  c.set("sessionId", session.id);
  await next();
});
