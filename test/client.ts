// Test client for authenticated /api calls: unlocks once per test and sends the cookie.
import { env, exports } from "cloudflare:workers";
import { TEST_UNLOCK_SECRET } from "./constants";

const BASE = "http://urdu.test";
const COOKIE = "__Host-urdu_session";

let ipCounter = 0;

export const TABLES = ["review_events", "vocab", "handoffs", "tags", "sessions"] as const;

export async function clearTables(): Promise<void> {
  await env.DB.batch(TABLES.map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
}

export type Api = (method: string, path: string, body?: unknown) => Promise<Response>;

export async function unlockedApi(): Promise<Api> {
  const res = await exports.default.fetch(`${BASE}/api/unlock`, {
    method: "POST",
    // Separate IP range from auth.test.ts; each unlock gets its own so the limiter never trips.
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": `198.51.100.${++ipCounter % 250}`,
    },
    body: JSON.stringify({ secret: TEST_UNLOCK_SECRET }),
  });
  const token = res.headers.get("Set-Cookie")?.match(new RegExp(`${COOKIE}=([^;]+)`))?.[1];
  if (!token) throw new Error(`unlock failed: ${res.status}`);

  return (method, path, body) =>
    exports.default.fetch(`${BASE}${path}`, {
      method,
      headers: {
        Cookie: `${COOKIE}=${token}`,
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}
