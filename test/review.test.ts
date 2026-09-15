import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ExportResponse, ReviewResponse, VocabItem } from "../shared/api";
import { addDays, todayIn } from "../shared/dates";
import { applyGrade, GRADES, type Mastery } from "../shared/mastery";
import { applyReview, recordReview } from "../worker/domain/review";
import { getVocab } from "../worker/domain/vocab";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const UNKNOWN_ID = "01JZZZZZZZZZZZZZZZZZZZZZZZ";

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

async function setMastery(id: string, mastery: number, last: string | null, next: string | null) {
  await env.DB.prepare(
    "UPDATE vocab SET mastery = ?, last_reviewed_on = ?, next_review_on = ? WHERE id = ?",
  )
    .bind(mastery, last, next, id)
    .run();
}

async function events() {
  const { results } = await env.DB.prepare(
    "SELECT * FROM review_events ORDER BY reviewed_at, id",
  ).all();
  return results;
}

describe("POST /api/vocab/:id/reviews", () => {
  it("records a review: new mastery, today's dates, one event with before and after", async () => {
    const item = await create({ urdu: KITAB });
    await setMastery(item.id, 2, addDays(today, -10), addDays(today, -5));

    const before = Date.now();
    const body = await json<ReviewResponse>(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "correct", direction: "en_ur" }),
      201,
    );

    expect(body.item).toMatchObject({
      id: item.id,
      mastery: 3,
      last_reviewed_on: today,
      next_review_on: addDays(today, 25),
    });
    expect(Date.parse(body.item.updated_at)).toBeGreaterThanOrEqual(before - 1000);
    expect(body.event).toMatchObject({
      vocab_id: item.id,
      grade: "correct",
      mastery_before: 2,
      mastery_after: 3,
      direction: "en_ur",
      source: "pwa",
      handoff_id: null,
    });
    expect(body.event.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(body.event.reviewed_at).toBe(body.item.updated_at);

    expect(await json<VocabItem>(await api("GET", `/api/vocab/${item.id}`))).toEqual(body.item);
    expect(await events()).toEqual([body.event]);
  });

  it("applies every grade's delta with clamping at 0 and 6", async () => {
    const item = await create({ urdu: KITAB });
    for (const start of [0, 1, 5, 6] as Mastery[]) {
      for (const grade of GRADES) {
        await setMastery(item.id, start, null, null);
        const body = await json<ReviewResponse>(
          await api("POST", `/api/vocab/${item.id}/reviews`, { grade, direction: "ur_en" }),
          201,
        );
        const expected = applyGrade(start, grade);
        expect(body.item.mastery, `${start} ${grade}`).toBe(expected);
        expect(body.event.mastery_before).toBe(start);
        expect(body.event.mastery_after).toBe(expected);
      }
    }
    expect(await events()).toHaveLength(4 * GRADES.length);
  });

  it("makes a never-reviewed item due again today at mastery 0", async () => {
    const item = await create({ urdu: KITAB });
    const body = await json<ReviewResponse>(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "wrong", direction: "oral" }),
      201,
    );
    expect(body.item).toMatchObject({ mastery: 0, last_reviewed_on: today, next_review_on: today });
    const due = await json<{ items: VocabItem[] }>(await api("GET", "/api/vocab/due"));
    expect(due.items.map((i) => i.id)).toEqual([item.id]);
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
    ["client-set mastery", { grade: "correct", direction: "ur_en", mastery: 6 }],
    ["array body", [{ grade: "correct", direction: "ur_en" }]],
  ])("rejects %s with 400 and writes nothing", async (_label, body) => {
    const item = await create({ urdu: KITAB });
    const res = await api("POST", `/api/vocab/${item.id}/reviews`, body);
    expect(res.status).toBe(400);
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
      today,
    );
    expect(first.ok).toBe(true);
    const afterFirst = await getVocab(env.DB, item.id);

    const second = await applyReview(
      env.DB,
      stale,
      { grade: "confident", direction: "ur_en", source: "pwa" },
      new Date(Date.now() + 10),
      today,
    );
    expect(second).toEqual({ ok: false, error: "stale" });
    expect(await getVocab(env.DB, item.id)).toEqual(afterFirst);
    expect(await events()).toHaveLength(1);
  });

  it("treats a same-mastery edit in between (updated_at moved) as stale", async () => {
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
      today,
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
      today,
    );
    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(await events()).toHaveLength(0);
  });

  it("records coach source and handoff id for f06", async () => {
    const item = await create({ urdu: KITAB });
    const result = await recordReview(
      env.DB,
      item.id,
      { grade: "correct", direction: "oral", source: "coach", handoffId: "handoff-1" },
      new Date(),
      today,
    );
    expect(result.ok && result.event).toMatchObject({ source: "coach", handoff_id: "handoff-1" });
    expect(await events()).toMatchObject([{ source: "coach", handoff_id: "handoff-1" }]);
  });
});

describe("GET /api/export", () => {
  it("returns vocab, review events, tags and handoffs, and no sessions", async () => {
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
      ["exported_at", "handoffs", "review_events", "tags", "vocab"].sort(),
    );
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
