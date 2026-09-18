import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReviewResponse, SettingsResponse, VocabItem } from "../shared/api";
import { ladder, nearestStep } from "../shared/ladders";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
});

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

async function create(urdu: string): Promise<VocabItem> {
  return json<VocabItem>(await api("POST", "/api/vocab", { urdu }), 201);
}

describe("GET/PATCH /api/settings", () => {
  it("defaults to Moderate (3)", async () => {
    expect(await json<SettingsResponse>(await api("GET", "/api/settings"))).toEqual({
      active_ladder_id: 3,
    });
  });

  it.each([2, 3, 4, 5, 6])("switches to preset %i", async (id) => {
    expect(await json(await api("PATCH", "/api/settings", { active_ladder_id: id }))).toEqual({
      active_ladder_id: id,
    });
    expect(await json(await api("GET", "/api/settings"))).toEqual({ active_ladder_id: id });
    expect(await json(await api("GET", "/api/status"))).toMatchObject({ active_ladder_id: id });
  });

  it.each([
    ["the legacy ladder", { active_ladder_id: 1 }],
    ["an unknown id", { active_ladder_id: 7 }],
    ["a string id", { active_ladder_id: "3" }],
    ["an extra key", { active_ladder_id: 4, theme: "dark" }],
    ["an array", [4]],
  ])("rejects %s with 400", async (_label, body) => {
    expect(await json(await api("PATCH", "/api/settings", body), 400)).toMatchObject({
      error: "invalid_request",
    });
    expect(await json(await api("GET", "/api/settings"))).toEqual({ active_ladder_id: 3 });
  });

  it("requires a session", async () => {
    expect((await exports.default.fetch("http://urdu.test/api/settings")).status).toBe(401);
  });
});

describe("switching ladders", () => {
  it("rewrites no due time, and moves an item at its next review to the nearest rung", async () => {
    const reviewed = await create(KITAB);
    const untouched = await create(PANI);
    for (const item of [reviewed, untouched]) {
      await json(
        await api("POST", `/api/vocab/${item.id}/reviews`, {
          grade: "confident",
          direction: "ur_en",
        }),
        201,
      );
    }
    const snapshot = async () =>
      (
        await env.DB.prepare(
          "SELECT id, ladder_id, ladder_step, due_at FROM vocab ORDER BY id",
        ).all()
      ).results;
    const before = await snapshot();

    await json(await api("PATCH", "/api/settings", { active_ladder_id: 5 }));
    expect(await snapshot()).toEqual(before);

    const current = await json<VocabItem>(await api("GET", `/api/vocab/${reviewed.id}`));
    expect(current).toMatchObject({ ladder_id: 3, ladder_step: 2 });
    const body = await json<ReviewResponse>(
      await api("POST", `/api/vocab/${reviewed.id}/reviews`, {
        grade: "hesitant",
        direction: "ur_en",
      }),
      201,
    );
    const step = nearestStep(ladder(5), current.interval_seconds);
    expect(body.item).toMatchObject({
      ladder_id: 5,
      ladder_step: step,
      interval_seconds: ladder(5).intervals_seconds[step],
    });
    expect(body.event).toMatchObject({
      ladder_before_id: 3,
      step_before: 2,
      interval_before: current.interval_seconds,
      ladder_id: 5,
      step_after: step,
      applied_delta: 0,
    });
    const other = await json<VocabItem>(await api("GET", `/api/vocab/${untouched.id}`));
    expect(other.ladder_id).toBe(3);
  });
});
