import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ExportResponse, ReviewResponse, VocabItem } from "../shared/api";
import { todayIn } from "../shared/dates";
import { addSeconds, LADDERS, ladder, maxStep, scheduleReview } from "../shared/ladders";
import { GRADES } from "../shared/mastery";
import { applyReview, recordReview } from "../worker/domain/review";
import { getVocab } from "../worker/domain/vocab";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const UNKNOWN_ID = "01JZZZZZZZZZZZZZZZZZZZZZZZ";
const MODERATE = ladder(3);

let api: Api;
let today: string;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
  today = todayIn(env.HOME_TZ);
});

async function create(body: Record<string, unknown>): Promise<VocabItem> {
  const res = await api("POST", "/api/vocab", body);
  expect(res.status).toBe(201);
  return res.json();
}

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

// Put an item on the Moderate ladder at `step`, reviewed at `last` (null = never reviewed).
async function setStep(id: string, step: number, last: string | null = null) {
  const interval = MODERATE.intervals_seconds[step] as number;
  await env.DB.prepare(
    `UPDATE vocab SET ladder_id = 3, ladder_step = ?, interval_seconds = ?, last_reviewed_at = ?,
       due_at = ? WHERE id = ?`,
  )
    .bind(step, interval, last, last === null ? null : addSeconds(last, interval), id)
    .run();
}

async function events() {
  const { results } = await env.DB.prepare(
    "SELECT * FROM review_events ORDER BY reviewed_at, id",
  ).all();
  return results;
}

describe("POST /api/vocab/:id/reviews", () => {
  it("records a review: new rung, due from now, one event with before and after", async () => {
    const item = await create({ urdu: KITAB });
    const last = "2026-09-01T08:00:00.000Z";
    await setStep(item.id, 2, last);
    const before = await getVocab(env.DB, item.id);

    const body = await json<ReviewResponse>(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "correct", direction: "en_ur" }),
      201,
    );

    const at = body.item.updated_at;
    const interval = MODERATE.intervals_seconds[3] as number;
    expect(Math.abs(Date.parse(at) - Date.now())).toBeLessThan(5000);
    expect(body.item).toMatchObject({
      id: item.id,
      ladder_id: 3,
      ladder_step: 3,
      interval_seconds: interval,
      last_reviewed_at: at,
      due_at: addSeconds(at, interval),
    });
    expect(body.event).toMatchObject({
      vocab_id: item.id,
      reviewed_at: at,
      grade: "correct",
      direction: "en_ur",
      source: "pwa",
      handoff_id: null,
      prompt_support: "none",
      applied_delta: 1,
      ladder_before_id: 3,
      step_before: 2,
      interval_before: MODERATE.intervals_seconds[2],
      due_before: before?.due_at,
      ladder_id: 3,
      step_after: 3,
      interval_after: interval,
      due_after: body.item.due_at,
    });
    expect(body.event.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    expect(await json<VocabItem>(await api("GET", `/api/vocab/${item.id}`))).toEqual(body.item);
    expect(await events()).toEqual([body.event]);
  });

  it("softens an English → Urdu miss: Wrong at rung 3 drops one rung, not two", async () => {
    const item = await create({ urdu: KITAB });
    await setStep(item.id, 3);
    const body = await json<ReviewResponse>(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "wrong", direction: "en_ur" }),
      201,
    );
    expect(body.item.ladder_step).toBe(2);
    expect(body.event).toMatchObject({ direction: "en_ur", applied_delta: -1 });
  });

  it.each(["ur_en", "en_ur"] as const)(
    "applies every %s grade as scheduleReview does, clamping at both ends",
    async (direction) => {
      const item = await create({ urdu: KITAB });
      const top = maxStep(MODERATE);
      const starts = [0, 1, top - 1, top];
      for (const start of starts) {
        for (const grade of GRADES) {
          await setStep(item.id, start);
          const current = await getVocab(env.DB, item.id);
          if (!current) throw new Error("item missing");
          const body = await json<ReviewResponse>(
            await api("POST", `/api/vocab/${item.id}/reviews`, { grade, direction }),
            201,
          );
          const expected = scheduleReview(current, grade, direction, 3, body.event.reviewed_at);
          expect(body.item.ladder_step, `${start} ${grade}`).toBe(expected.ladder_step);
          expect(body.item.due_at).toBe(expected.due_at);
          expect(body.event).toMatchObject({
            step_before: start,
            step_after: expected.ladder_step,
            applied_delta: expected.applied_delta,
          });
        }
      }
      expect(await events()).toHaveLength(starts.length * GRADES.length);
    },
  );

  it("brings a never-reviewed item back in three hours after a miss", async () => {
    const item = await create({ urdu: KITAB });
    const body = await json<ReviewResponse>(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "wrong", direction: "oral" }),
      201,
    );
    expect(body.item).toMatchObject({ ladder_step: 0, interval_seconds: 10800 });
    expect(body.event).toMatchObject({ due_before: null, applied_delta: -1 });
    expect(body.item.due_at).toBe(addSeconds(body.event.reviewed_at, 10800));
    const due = await json<{ items: VocabItem[] }>(await api("GET", "/api/vocab/due"));
    expect(due.items).toEqual([]);
  });

  it("returns 404 for an unknown id and writes nothing", async () => {
    const res = await api("POST", `/api/vocab/${UNKNOWN_ID}/reviews`, {
      grade: "correct",
      direction: "ur_en",
    });
    expect(res.status).toBe(404);
    expect(await events()).toHaveLength(0);
  });

  it.each([
    ["missing grade", { direction: "ur_en" }],
    ["bad grade", { grade: "great", direction: "ur_en" }],
    ["missing direction", { grade: "correct" }],
    ["bad direction", { grade: "correct", direction: "both" }],
    ["client-set source", { grade: "correct", direction: "ur_en", source: "coach" }],
    ["client-set rung", { grade: "correct", direction: "ur_en", ladder_step: 6 }],
    ["client-set prompt support", { grade: "correct", direction: "ur_en", prompt_support: "hint" }],
    ["array body", [{ grade: "correct", direction: "ur_en" }]],
  ])("rejects %s with 400 and writes nothing", async (_label, body) => {
    const item = await create({ urdu: KITAB });
    const res = await api("POST", `/api/vocab/${item.id}/reviews`, body);
    expect(await json(res, 400)).toMatchObject({ error: "invalid_request" });
    expect(await json<VocabItem>(await api("GET", `/api/vocab/${item.id}`))).toEqual(item);
    expect(await events()).toHaveLength(0);
  });

  it("requires a session", async () => {
    const res = await exports.default.fetch("http://urdu.test/api/vocab/x/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grade: "correct", direction: "ur_en" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("review service", () => {
  it("writes nothing when the row changed after it was read", async () => {
    const item = await create({ urdu: KITAB });
    const stale = await getVocab(env.DB, item.id);
    if (!stale) throw new Error("item missing");

    // A concurrent review lands first.
    const first = await recordReview(
      env.DB,
      item.id,
      { grade: "correct", direction: "ur_en", source: "pwa" },
      new Date(Date.now() + 5),
      3,
    );
    expect(first.ok).toBe(true);
    const afterFirst = await getVocab(env.DB, item.id);

    const second = await applyReview(
      env.DB,
      stale,
      { grade: "confident", direction: "ur_en", source: "pwa" },
      new Date(Date.now() + 10),
      3,
    );
    expect(second).toEqual({ ok: false, error: "stale" });
    expect(await getVocab(env.DB, item.id)).toEqual(afterFirst);
    expect(await events()).toHaveLength(1);
  });

  it("treats a same-rung edit in between (updated_at moved) as stale", async () => {
    const item = await create({ urdu: KITAB });
    const stale = await getVocab(env.DB, item.id);
    if (!stale) throw new Error("item missing");
    await env.DB.prepare("UPDATE vocab SET updated_at = '2099-01-01T00:00:00.000Z' WHERE id = ?")
      .bind(item.id)
      .run();

    const result = await applyReview(
      env.DB,
      stale,
      { grade: "hesitant", direction: "ur_en", source: "pwa" },
      new Date(),
      3,
    );
    expect(result).toEqual({ ok: false, error: "stale" });
    expect(await events()).toHaveLength(0);
  });

  it("reports not_found when the row was deleted after it was read", async () => {
    const item = await create({ urdu: KITAB });
    const stale = await getVocab(env.DB, item.id);
    if (!stale) throw new Error("item missing");
    await env.DB.prepare("DELETE FROM vocab WHERE id = ?").bind(item.id).run();

    const result = await applyReview(
      env.DB,
      stale,
      { grade: "correct", direction: "ur_en", source: "pwa" },
      new Date(),
      3,
    );
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(await events()).toHaveLength(0);
  });

  it("records coach source, handoff id and prompt support for f06", async () => {
    const item = await create({ urdu: KITAB });
    const result = await recordReview(
      env.DB,
      item.id,
      {
        grade: "correct",
        direction: "oral",
        source: "coach",
        handoffId: "handoff-1",
        promptSupport: "hint",
      },
      new Date(),
      3,
    );
    const expected = { source: "coach", handoff_id: "handoff-1", prompt_support: "hint" };
    expect(result.ok && result.event).toMatchObject(expected);
    expect(await events()).toMatchObject([expected]);
  });
});

describe("GET /api/export", () => {
  it("returns ladders, the active ladder, vocab, review events, tags and handoffs, and no sessions", async () => {
    const a = await create({ urdu: KITAB, tags: ["nouns"] });
    await create({ urdu: PANI, favourite: true });
    const review = await json<ReviewResponse>(
      await api("POST", `/api/vocab/${a.id}/reviews`, { grade: "correct", direction: "ur_en" }),
      201,
    );
    await env.DB.prepare(
      `INSERT INTO handoffs (id, imported_at, payload, status, outcome)
       VALUES ('h1', '2026-09-01T00:00:00.000Z', '{"handoff_id":"h1"}', 'imported', NULL)`,
    ).run();

    const res = await api("GET", "/api/export");
    expect(res.headers.get("Content-Disposition")).toBe(
      `attachment; filename="urdu-export-${today}.json"`,
    );
    const body = await json<ExportResponse>(res);

    expect(Object.keys(body).sort()).toEqual(
      [
        "active_ladder_id",
        "exported_at",
        "handoffs",
        "ladders",
        "review_events",
        "tags",
        "vocab",
      ].sort(),
    );
    expect(body.ladders).toEqual(JSON.parse(JSON.stringify(LADDERS)));
    expect(body.active_ladder_id).toBe(3);
    expect(body.vocab).toHaveLength(2);
    expect(body.vocab[0]).toEqual(review.item);
    expect(body.vocab[1]).toMatchObject({ urdu: PANI, favourite: true, tags: [] });
    expect(body.review_events).toEqual([review.event]);
    expect(body.tags).toEqual([{ name: "nouns", description: null }]);
    expect(body.handoffs).toEqual([
      {
        id: "h1",
        imported_at: "2026-09-01T00:00:00.000Z",
        payload: { handoff_id: "h1" },
        status: "imported",
        outcome: null,
      },
    ]);
    expect(JSON.stringify(body)).not.toContain("token_hash");
  });

  it("exports an empty vault", async () => {
    const body = await json<ExportResponse>(await api("GET", "/api/export"));
    expect(body).toMatchObject({ vocab: [], review_events: [], tags: [], handoffs: [] });
  });

  it("requires a session", async () => {
    expect((await exports.default.fetch("http://urdu.test/api/export")).status).toBe(401);
  });
});
