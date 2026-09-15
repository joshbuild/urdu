import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

// __Host- makes the browser require Secure, Path=/ and no Domain. Chrome treats
// http://localhost as secure, so the same cookie works under `pnpm dev`.
export const SESSION_COOKIE = "__Host-urdu_session";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

const attributes = {
  httpOnly: true,
  secure: true,
  sameSite: "Strict",
  path: "/",
} as const;

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE, token, { ...attributes, maxAge: ONE_YEAR_SECONDS });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, attributes);
}
