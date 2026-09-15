import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("responds without a session", async () => {
    const res = await exports.default.fetch("http://urdu.test/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
