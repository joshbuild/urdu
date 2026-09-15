import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "../worker/auth/crypto";
import { LAST_SEEN_INTERVAL_MS } from "../worker/auth/sessions";
import app from "../worker/index";
import { TEST_UNLOCK_SECRET } from "./constants";

const BASE = "http://urdu.test";
const COOKIE = "__Host-urdu_session";

// Each test gets its own client IP so the unlock rate limiter never carries across tests.
let ipCounter = 0;
const nextIp = () => `203.0.113.${++ipCounter}`;

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return exports.default.fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function unlock(secret: string, ip = nextIp()): Promise<Response> {
  return post("/api/unlock", { secret }, { "CF-Connecting-IP": ip, "User-Agent": "vitest" });
}

function sessionToken(res: Response): string {
  const match = res.headers.get("Set-Cookie")?.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match?.[1]) throw new Error("no session cookie");
  return match[1];
}

async function unlocked(): Promise<string> {
  const res = await unlock(TEST_UNLOCK_SECRET);
  expect(res.status).toBe(200);
  return sessionToken(res);
}

const withCookie = (token: string) => ({ Cookie: `${COOKIE}=${token}` });

async function sessionCount(): Promise<number> {
  const row = await env.DB.prepare("SELECT count(*) AS n FROM sessions").first<{ n: number }>();
  return row?.n ?? -1;
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM sessions").run();
});

describe("test setup", () => {
  it("uses the test secret, not .dev.vars", () => {
    // Boolean on purpose: a failing diff must not print a real secret.
    expect(env.UNLOCK_SECRET === TEST_UNLOCK_SECRET).toBe(true);
  });
});

describe("POST /api/unlock", () => {
  it("rejects a wrong secret without creating a session", async () => {
    const res = await unlock("definitely-not-the-secret-value");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "wrong_secret" });
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(await sessionCount()).toBe(0);
  });

  it("rejects a secret that differs only in length", async () => {
    expect((await unlock(`${TEST_UNLOCK_SECRET}x`)).status).toBe(401);
    expect((await unlock(TEST_UNLOCK_SECRET.slice(0, -1))).status).toBe(401);
  });

  it("sets a hardened session cookie and stores only the token hash", async () => {
    const res = await unlock(TEST_UNLOCK_SECRET);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toMatch(new RegExp(`^${COOKIE}=[A-Za-z0-9_-]{43};`));
    for (const attr of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=31536000"]) {
      expect(cookie).toContain(attr);
    }
    expect(cookie).not.toMatch(/Domain=/i);

    const token = sessionToken(res);
    const row = await env.DB.prepare("SELECT * FROM sessions").first<Record<string, string>>();
    expect(row?.token_hash).toBe(await sha256Hex(token));
    expect(row?.token_hash).not.toContain(token);
    expect(row?.label).toBe("vitest");
    expect(row?.last_seen_at).toBe(row?.created_at);
  });

  it("gives each device its own session", async () => {
    const a = await unlocked();
    const b = await unlocked();
    expect(a).not.toBe(b);
    expect(await sessionCount()).toBe(2);
  });

  it.each([
    ["malformed JSON", "{secret:"],
    ["missing secret", "{}"],
    ["non-string secret", '{"secret":123}'],
    ["non-object body", '"secret"'],
  ])("rejects %s with 400", async (_label, body) => {
    const res = await exports.default.fetch(`${BASE}/api/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body,
    });
    expect(res.status).toBe(400);
    expect(await sessionCount()).toBe(0);
  });

  it("allows 5 attempts per minute per IP, then 429", async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++)
      expect((await unlock("wrong-secret-attempt-000", ip)).status).toBe(401);
    const blocked = await unlock(TEST_UNLOCK_SECRET, ip);
    expect(blocked.status).toBe(429);
    expect(await sessionCount()).toBe(0);
    expect((await unlock(TEST_UNLOCK_SECRET)).status).toBe(200); // another IP is unaffected
  });

  it("refuses to unlock when the configured secret is too short", async () => {
    const ctx = createExecutionContext();
    const req = new Request(`${BASE}/api/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": nextIp() },
      body: JSON.stringify({ secret: "short" }),
    });
    const res = await app.fetch(req, { ...env, UNLOCK_SECRET: "short" }, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(500);
    expect(await sessionCount()).toBe(0);
  });
});

describe("session middleware", () => {
  it("leaves health public", async () => {
    const res = await exports.default.fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
  });

  it("returns 401 for protected routes without a cookie", async () => {
    expect((await exports.default.fetch(`${BASE}/api/nope`)).status).toBe(401);
    expect((await post("/api/lock", {})).status).toBe(401);
  });

  it("returns 401 and clears an unknown cookie", async () => {
    const res = await exports.default.fetch(`${BASE}/api/nope`, { headers: withCookie("forged") });
    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toMatch(new RegExp(`^${COOKIE}=;.*Max-Age=0`));
  });

  it("admits a valid session (unknown route is then a 404)", async () => {
    const token = await unlocked();
    const res = await exports.default.fetch(`${BASE}/api/nope`, { headers: withCookie(token) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("revokes a device when its session row is deleted", async () => {
    const token = await unlocked();
    await env.DB.prepare("DELETE FROM sessions").run();
    const res = await exports.default.fetch(`${BASE}/api/nope`, { headers: withCookie(token) });
    expect(res.status).toBe(401);
  });

  it("refreshes last_seen_at only when it is over an hour old", async () => {
    const token = await unlocked();
    const recent = new Date(Date.now() - LAST_SEEN_INTERVAL_MS / 2).toISOString();
    const stale = new Date(Date.now() - LAST_SEEN_INTERVAL_MS * 2).toISOString();
    const lastSeen = async () =>
      (await env.DB.prepare("SELECT last_seen_at FROM sessions").first<{ last_seen_at: string }>())
        ?.last_seen_at;

    await env.DB.prepare("UPDATE sessions SET last_seen_at = ?").bind(recent).run();
    await exports.default.fetch(`${BASE}/api/nope`, { headers: withCookie(token) });
    expect(await lastSeen()).toBe(recent);

    await env.DB.prepare("UPDATE sessions SET last_seen_at = ?").bind(stale).run();
    await exports.default.fetch(`${BASE}/api/nope`, { headers: withCookie(token) });
    expect(Date.parse((await lastSeen()) ?? "")).toBeGreaterThan(Date.now() - 60_000);
  });
});

describe("POST /api/lock", () => {
  it("deletes only this device's session and clears the cookie", async () => {
    const mine = await unlocked();
    const other = await unlocked();

    const res = await post("/api/lock", undefined, withCookie(mine));
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toMatch(new RegExp(`^${COOKIE}=;.*Max-Age=0`));
    expect(await sessionCount()).toBe(1);

    const again = await exports.default.fetch(`${BASE}/api/nope`, { headers: withCookie(mine) });
    expect(again.status).toBe(401);
    const stillIn = await exports.default.fetch(`${BASE}/api/nope`, { headers: withCookie(other) });
    expect(stillIn.status).toBe(404);
  });
});

describe("JSON content-type guard", () => {
  it.each([
    ["no content type", {}],
    ["text/plain", { "Content-Type": "text/plain" }],
    ["form", { "Content-Type": "application/x-www-form-urlencoded" }],
  ])("rejects POST /api/unlock with %s (415)", async (_label, headers) => {
    const res = await exports.default.fetch(`${BASE}/api/unlock`, {
      method: "POST",
      headers: { "CF-Connecting-IP": nextIp(), ...headers },
      body: JSON.stringify({ secret: TEST_UNLOCK_SECRET }),
    });
    expect(res.status).toBe(415);
    expect(await sessionCount()).toBe(0);
  });

  it("rejects a non-JSON lock even with a valid cookie", async () => {
    const token = await unlocked();
    const res = await exports.default.fetch(`${BASE}/api/lock`, {
      method: "POST",
      headers: { "Content-Type": "text/plain", ...withCookie(token) },
    });
    expect(res.status).toBe(415);
    expect(await sessionCount()).toBe(1);
  });

  it("accepts a charset parameter", async () => {
    const res = await post(
      "/api/unlock",
      { secret: TEST_UNLOCK_SECRET },
      {
        "Content-Type": "application/json; charset=utf-8",
        "CF-Connecting-IP": nextIp(),
      },
    );
    expect(res.status).toBe(200);
  });
});
