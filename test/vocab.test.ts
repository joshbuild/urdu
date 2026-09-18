import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { VocabItem } from "../shared/api";
import { todayIn } from "../shared/dates";
import { addSeconds, ladder } from "../shared/ladders";
import { type Api, clearTables, unlockedApi } from "./client";

// Escapes keep the exact code points visible in review.
const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب with keheh
const KITAB_ARABIC_KAF_WITH_KASRA = "\u{0643}\u{0650}\u{062A}\u{0627}\u{0628}"; // كِتاب
const BAHUT_SHUKRIYA = "\u{0628}\u{06C1}\u{062A} \u{0634}\u{06A9}\u{0631}\u{06CC}\u{06C1}"; // بہت شکریہ
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const GHAR = "\u{06AF}\u{06BE}\u{0631}"; // گھر

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

// An instant `days` from now (fractions allowed), as the Worker stores it.
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

async function setReviewDates(id: string, last: string | null, due: string | null) {
  await env.DB.prepare("UPDATE vocab SET last_reviewed_at = ?, due_at = ? WHERE id = ?")
    .bind(last, due, id)
    .run();
}

async function setAddedAt(id: string, at: string) {
  await env.DB.prepare("UPDATE vocab SET added_at = ? WHERE id = ?").bind(at, id).run();
}

async function eventCount(): Promise<number> {
  const row = await env.DB.prepare("SELECT count(*) AS n FROM review_events").first<{
    n: number;
  }>();
  return row?.n ?? -1;
}

describe("POST /api/vocab", () => {
  it("creates an item on the active ladder's first rung, never reviewed", async () => {
    const before = Date.now();
    const item = await create({
      urdu: `  ${KITAB} `,
      roman: "kitaab",
      english: "book",
      tags: ["nouns", " nouns ", "reading"],
      source: "reading",
    });

    expect(item.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(item).toMatchObject({
      urdu: KITAB,
      urdu_key: KITAB,
      kind: "word",
      roman: "kitaab",
      english: "book",
      notes: null,
      tags: ["nouns", "reading"],
      favourite: false,
      ladder_id: 3,
      ladder_step: 0,
      interval_seconds: 10800,
      last_reviewed_at: null,
      due_at: null,
      source: "reading",
      airtable_id: null,
    });
    expect(Date.parse(item.added_at)).toBeGreaterThanOrEqual(before - 1000);
    expect(item.created_at).toBe(item.added_at);
    expect(item.updated_at).toBe(item.added_at);

    expect(await json<VocabItem>(await api("GET", `/api/vocab/${item.id}`))).toEqual(item);
  });

  it("infers phrase for multi-word Urdu and defaults source to manual", async () => {
    const item = await create({ urdu: `${BAHUT_SHUKRIYA}\u{06D4}` });
    expect(item.kind).toBe("phrase");
    expect(item.source).toBe("manual");
  });

  it("accepts an explicit kind", async () => {
    expect((await create({ urdu: GHAR, kind: "phrase" })).kind).toBe("phrase");
  });

  it("auto-inserts unknown tags without touching existing ones", async () => {
    await env.DB.prepare("INSERT INTO tags (name, description) VALUES ('nouns', 'kept')").run();
    await create({ urdu: KITAB, tags: ["nouns", "home"] });
    const { results } = await env.DB.prepare("SELECT * FROM tags ORDER BY name").all();
    expect(results).toEqual([
      { name: "home", description: null },
      { name: "nouns", description: "kept" },
    ]);
  });

  it("rejects a duplicate, including a tashkeel and kaf variant, with the existing id", async () => {
    const original = await create({ urdu: KITAB });
    for (const urdu of [KITAB, KITAB_ARABIC_KAF_WITH_KASRA]) {
      const res = await api("POST", "/api/vocab", { urdu, english: "a book" });
      expect(await json(res, 409)).toEqual({ error: "duplicate", existing_id: original.id });
    }
    const row = await env.DB.prepare("SELECT count(*) AS n FROM vocab").first<{ n: number }>();
    expect(row?.n).toBe(1);
  });

  it.each([
    ["missing urdu", { english: "book" }, "urdu"],
    ["blank urdu", { urdu: "   " }, "urdu"],
    ["punctuation-only urdu", { urdu: "\u{06D4}\u{060C}?" }, "urdu"],
    ["non-string roman", { urdu: KITAB, roman: 5 }, "roman"],
    ["bad kind", { urdu: KITAB, kind: "sentence" }, "kind"],
    ["tags not an array", { urdu: KITAB, tags: "nouns" }, "tags"],
    ["blank tag", { urdu: KITAB, tags: ["ok", ""] }, "tags"],
    ["ladder_step on create", { urdu: KITAB, ladder_step: 3 }, "ladder_step"],
    ["legacy mastery", { urdu: KITAB, mastery: 3 }, "mastery"],
    ["coach source", { urdu: KITAB, source: "coach" }, "source"],
    ["unknown field", { urdu: KITAB, due_at: "2026-01-01" }, "due_at"],
    ["non-boolean favourite", { urdu: KITAB, favourite: 1 }, "favourite"],
    ["over-long urdu", { urdu: "\u{0628}".repeat(501) }, "urdu"],
  ])("rejects %s with 400", async (_label, body, field) => {
    const res = await api("POST", "/api/vocab", body);
    expect(await json(res, 400)).toMatchObject({ error: "invalid_request", field });
    expect(await eventCount()).toBe(0);
  });

  it("rejects a non-object body with 400", async () => {
    expect((await api("POST", "/api/vocab", [KITAB])).status).toBe(400);
  });
});

describe("GET /api/vocab/:id", () => {
  it("returns 404 for an unknown id", async () => {
    expect(await json(await api("GET", "/api/vocab/01JZZZZZZZZZZZZZZZZZZZZZZZ"), 404)).toEqual({
      error: "not_found",
    });
  });
});

describe("GET /api/vocab", () => {
  it("searches Urdu by normalized key, and Roman and English case-insensitively", async () => {
    const kitab = await create({ urdu: KITAB, roman: "kitaab", english: "Book" });
    const pani = await create({ urdu: PANI, roman: "paani", english: "water" });
    const shukriya = await create({
      urdu: BAHUT_SHUKRIYA,
      roman: "bohat shukriya",
      english: "thanks a lot",
    });

    const ids = async (q: string) =>
      (
        await json<{ items: VocabItem[] }>(
          await api("GET", `/api/vocab?q=${encodeURIComponent(q)}`),
        )
      ).items
        .map((i) => i.id)
        .sort();

    expect(await ids(KITAB_ARABIC_KAF_WITH_KASRA)).toEqual([kitab.id]);
    expect(await ids("\u{0634}\u{06A9}\u{0631}")).toEqual([shukriya.id]); // شکر substring
    expect(await ids("PAAN")).toEqual([pani.id]);
    expect(await ids("book")).toEqual([kitab.id]);
    expect(await ids("a")).toEqual([kitab.id, pani.id, shukriya.id].sort());
    expect(await ids("%")).toEqual([]);
  });

  it("filters by tag and due, and reports the filtered total", async () => {
    const a = await create({ urdu: KITAB, tags: ["nouns"] });
    const b = await create({ urdu: PANI, tags: ["nouns", "drinks"] });
    await create({ urdu: GHAR, tags: ["places"] });
    await setReviewDates(b.id, inDays(-5), inDays(20));

    const nouns = await json<{ items: VocabItem[]; total: number }>(
      await api("GET", "/api/vocab?tag=nouns"),
    );
    expect(nouns.total).toBe(2);
    expect(nouns.items.map((i) => i.id).sort()).toEqual([a.id, b.id].sort());

    const dueNouns = await json<{ items: VocabItem[]; total: number }>(
      await api("GET", "/api/vocab?tag=nouns&due=true"),
    );
    expect(dueNouns.items.map((i) => i.id)).toEqual([a.id]);
    expect(dueNouns.total).toBe(1);

    const noTag = await json<{ total: number }>(await api("GET", "/api/vocab?tag=nou"));
    expect(noTag.total).toBe(0);
  });

  it("sorts by added (newest first), next review, and mastery; pages with limit and offset", async () => {
    const a = await create({ urdu: KITAB });
    const b = await create({ urdu: PANI });
    const c = await create({ urdu: GHAR });
    await setAddedAt(a.id, "2026-01-01T00:00:00.000Z");
    await setAddedAt(b.id, "2026-02-01T00:00:00.000Z");
    await setAddedAt(c.id, "2026-03-01T00:00:00.000Z");
    await setReviewDates(a.id, "2026-01-01T08:00:00.000Z", "2026-06-01T08:00:00.000Z");
    await setReviewDates(c.id, "2026-01-01T08:00:00.000Z", "2026-02-01T08:00:00.000Z");
    // sort=mastery orders by the scheduled interval.
    const setInterval = (id: string, s: number) =>
      env.DB.prepare("UPDATE vocab SET interval_seconds = ? WHERE id = ?").bind(s, id).run();
    await setInterval(a.id, 125 * 86_400);
    await setInterval(c.id, 5 * 86_400);

    const order = async (qs: string) =>
      (await json<{ items: VocabItem[] }>(await api("GET", `/api/vocab?${qs}`))).items.map(
        (i) => i.id,
      );

    expect(await order("")).toEqual([c.id, b.id, a.id]);
    expect(await order("sort=added")).toEqual([c.id, b.id, a.id]);
    expect(await order("sort=next_review")).toEqual([b.id, c.id, a.id]);
    expect(await order("sort=mastery")).toEqual([b.id, c.id, a.id]);
    expect(await order("limit=2")).toEqual([c.id, b.id]);
    expect(await order("limit=2&offset=2")).toEqual([a.id]);

    const page = await json<{ total: number }>(await api("GET", "/api/vocab?limit=1"));
    expect(page.total).toBe(3);
  });

  it.each(["sort=random", "limit=0", "limit=201", "limit=abc", "offset=-1", "due=maybe"])(
    "rejects %s with 400",
    async (qs) => {
      expect((await api("GET", `/api/vocab?${qs}`)).status).toBe(400);
    },
  );
});

describe("PATCH /api/vocab/:id", () => {
  it("updates text fields, clears with null or empty string, and bumps updated_at", async () => {
    const item = await create({ urdu: KITAB, roman: "kitab", notes: "old" });
    await env.DB.prepare("UPDATE vocab SET updated_at = '2026-01-01T00:00:00.000Z' WHERE id = ?")
      .bind(item.id)
      .run();

    const updated = await json<VocabItem>(
      await api("PATCH", `/api/vocab/${item.id}`, {
        roman: "kitaab",
        notes: null,
        english: "",
        favourite: true,
        tags: ["new-tag"],
      }),
    );
    expect(updated).toMatchObject({
      roman: "kitaab",
      notes: null,
      english: null,
      favourite: true,
      tags: ["new-tag"],
    });
    expect(updated.updated_at > "2026-01-01T00:00:00.000Z").toBe(true);
    expect(await json<VocabItem>(await api("GET", `/api/vocab/${item.id}`))).toEqual(updated);

    const tag = await env.DB.prepare("SELECT name FROM tags WHERE name = 'new-tag'").first();
    expect(tag).not.toBeNull();
  });

  it("recomputes key and kind when urdu changes, and re-checks duplicates", async () => {
    const kitab = await create({ urdu: KITAB });
    const pani = await create({ urdu: PANI });

    const res = await api("PATCH", `/api/vocab/${pani.id}`, { urdu: KITAB_ARABIC_KAF_WITH_KASRA });
    expect(await json(res, 409)).toEqual({ error: "duplicate", existing_id: kitab.id });

    const phrase = await json<VocabItem>(
      await api("PATCH", `/api/vocab/${pani.id}`, { urdu: BAHUT_SHUKRIYA }),
    );
    expect(phrase).toMatchObject({
      urdu: BAHUT_SHUKRIYA,
      urdu_key: BAHUT_SHUKRIYA,
      kind: "phrase",
    });

    // Same key on itself (added tashkeel) is not a duplicate; explicit kind wins over inference.
    const self = await json<VocabItem>(
      await api("PATCH", `/api/vocab/${kitab.id}`, {
        urdu: KITAB_ARABIC_KAF_WITH_KASRA,
        kind: "phrase",
      }),
    );
    expect(self).toMatchObject({ urdu_key: KITAB, kind: "phrase" });
  });

  it("a ladder_step edit moves onto the active ladder and recomputes due, with no event", async () => {
    const reviewed = await create({ urdu: KITAB });
    const last = "2026-09-01T08:00:00.000Z";
    await env.DB.prepare(
      "UPDATE vocab SET ladder_id = 1, ladder_step = 1, interval_seconds = 86400, last_reviewed_at = ?, due_at = ? WHERE id = ?",
    )
      .bind(last, "2026-09-02T08:00:00.000Z", reviewed.id)
      .run();
    const updated = await json<VocabItem>(
      await api("PATCH", `/api/vocab/${reviewed.id}`, { ladder_step: 6 }),
    );
    const rung = ladder(3).intervals_seconds[6] as number;
    expect(updated).toMatchObject({
      ladder_id: 3,
      ladder_step: 6,
      interval_seconds: rung,
      last_reviewed_at: last,
      due_at: addSeconds(last, rung),
    });

    const fresh = await create({ urdu: PANI });
    const stillDue = await json<VocabItem>(
      await api("PATCH", `/api/vocab/${fresh.id}`, { ladder_step: 12 }),
    );
    expect(stillDue).toMatchObject({ ladder_step: 12, last_reviewed_at: null, due_at: null });

    expect(await eventCount()).toBe(0);
  });

  it.each([
    ["empty body", {}],
    ["rung past the active ladder", { ladder_step: 13 }],
    ["negative rung", { ladder_step: -1 }],
    ["fractional rung", { ladder_step: 2.5 }],
    ["legacy mastery field", { mastery: 3 }],
    ["non-editable field", { source: "coach" }],
    ["review instant", { last_reviewed_at: "2026-09-01T00:00:00.000Z" }],
    ["punctuation-only urdu", { urdu: "\u{061F}" }],
  ])("rejects %s with 400", async (_label, body) => {
    const item = await create({ urdu: KITAB });
    expect((await api("PATCH", `/api/vocab/${item.id}`, body)).status).toBe(400);
    expect(await json<VocabItem>(await api("GET", `/api/vocab/${item.id}`))).toEqual(item);
  });

  it("returns 404 for an unknown id", async () => {
    expect(
      (await api("PATCH", "/api/vocab/01JZZZZZZZZZZZZZZZZZZZZZZZ", { roman: "x" })).status,
    ).toBe(404);
  });
});

describe("DELETE /api/vocab/:id", () => {
  it("removes the item and its review events", async () => {
    const item = await create({ urdu: KITAB });
    const other = await create({ urdu: PANI });
    const insertEvent = (id: string, vocabId: string) =>
      env.DB.prepare(
        `INSERT INTO review_events (id, vocab_id, reviewed_at, grade, direction, source,
           ladder_before_id, step_before, interval_before, ladder_id, step_after, interval_after)
         VALUES (?, ?, '2026-09-01T00:00:00.000Z', 'correct', 'ur_en', 'pwa', 3, 0, 10800, 3, 1, 25687)`,
      ).bind(id, vocabId);
    await env.DB.batch([
      insertEvent("01J00000000000000000000001", item.id),
      insertEvent("01J00000000000000000000002", other.id),
    ]);

    expect(await json(await api("DELETE", `/api/vocab/${item.id}`))).toEqual({ ok: true });
    expect((await api("GET", `/api/vocab/${item.id}`)).status).toBe(404);
    expect(await eventCount()).toBe(1);
    expect((await api("DELETE", `/api/vocab/${item.id}`)).status).toBe(404);
  });
});

describe("GET /api/vocab/due", () => {
  it("returns never-reviewed and past-due items in due order, excluding future ones", async () => {
    const neverOld = await create({ urdu: KITAB });
    const neverNew = await create({ urdu: PANI });
    const dueToday = await create({ urdu: GHAR });
    const overdue = await create({ urdu: BAHUT_SHUKRIYA });
    const future = await create({ urdu: "\u{062F}\u{0648}\u{0633}\u{062A}" }); // دوست
    await setAddedAt(neverOld.id, "2026-01-01T00:00:00.000Z");
    await setAddedAt(neverNew.id, "2026-02-01T00:00:00.000Z");
    await setReviewDates(dueToday.id, inDays(-1), inDays(-0.01));
    await setReviewDates(overdue.id, inDays(-10), inDays(-5));
    // Due later today is not due yet: scheduling is by instant, not by date.
    await setReviewDates(future.id, inDays(-0.1), inDays(0.05));

    const body = await json<{ items: VocabItem[]; today: string }>(
      await api("GET", "/api/vocab/due"),
    );
    expect(body.today).toBe(today);
    expect(body.items.map((i) => i.id)).toEqual([
      neverOld.id,
      neverNew.id,
      overdue.id,
      dueToday.id,
    ]);
  });

  it("honors limit and tag", async () => {
    const a = await create({ urdu: KITAB, tags: ["t"] });
    await create({ urdu: PANI });
    const c = await create({ urdu: GHAR, tags: ["t"] });
    await setAddedAt(a.id, "2026-01-01T00:00:00.000Z");
    await setAddedAt(c.id, "2026-01-02T00:00:00.000Z");

    const tagged = await json<{ items: VocabItem[] }>(await api("GET", "/api/vocab/due?tag=t"));
    expect(tagged.items.map((i) => i.id)).toEqual([a.id, c.id]);
    const limited = await json<{ items: VocabItem[] }>(
      await api("GET", "/api/vocab/due?tag=t&limit=1"),
    );
    expect(limited.items.map((i) => i.id)).toEqual([a.id]);
    expect((await api("GET", "/api/vocab/due?limit=0")).status).toBe(400);
  });

  it("reviews ahead: includes items due within the next N days, still in due order", async () => {
    const now = await create({ urdu: KITAB });
    const inTwo = await create({ urdu: PANI });
    const inFive = await create({ urdu: GHAR });
    await setReviewDates(now.id, inDays(-1), inDays(-0.01));
    await setReviewDates(inTwo.id, inDays(-0.1), inDays(1.9));
    await setReviewDates(inFive.id, inDays(-0.1), inDays(4.9));

    const ids = async (query: string) =>
      (await json<{ items: VocabItem[] }>(await api("GET", `/api/vocab/due${query}`))).items.map(
        (i) => i.id,
      );
    expect(await ids("")).toEqual([now.id]);
    expect(await ids("?ahead=2")).toEqual([now.id, inTwo.id]);
    expect(await ids("?ahead=5")).toEqual([now.id, inTwo.id, inFive.id]);
    for (const bad of ["-1", "366", "abc"]) {
      expect((await api("GET", `/api/vocab/due?ahead=${bad}`)).status).toBe(400);
    }
  });
});

describe("GET /api/status", () => {
  it("counts total and due items", async () => {
    await create({ urdu: KITAB });
    const b = await create({ urdu: PANI });
    const c = await create({ urdu: GHAR });
    await setReviewDates(b.id, inDays(-3), inDays(0.1));
    await setReviewDates(c.id, inDays(-3), inDays(-1));

    expect(await json(await api("GET", "/api/status"))).toEqual({
      total: 3,
      due: 2,
      today,
      active_ladder_id: 3,
    });
  });

  it("reports zeros for an empty vault", async () => {
    expect(await json(await api("GET", "/api/status"))).toEqual({
      total: 0,
      due: 0,
      today,
      active_ladder_id: 3,
    });
  });
});

describe("GET /api/tags", () => {
  it("lists every tag used on create and update, in name order", async () => {
    const item = await create({ urdu: KITAB, tags: ["verbs", "nouns"] });
    await json(await api("PATCH", `/api/vocab/${item.id}`, { tags: ["adjectives"] }));

    expect(await json(await api("GET", "/api/tags"))).toEqual({
      tags: [
        { name: "adjectives", description: null },
        { name: "nouns", description: null },
        { name: "verbs", description: null },
      ],
    });
  });

  it("is empty for an empty vault", async () => {
    expect(await json(await api("GET", "/api/tags"))).toEqual({ tags: [] });
  });
});

describe("FR-A8: reads never write", () => {
  it("leaves updated_at, schedule and review instants unchanged", async () => {
    const item = await create({ urdu: KITAB, tags: ["t"] });
    await setReviewDates(item.id, inDays(-30), inDays(-5));
    await env.DB.prepare(
      "UPDATE vocab SET ladder_step = 2, updated_at = '2026-01-01T00:00:00.000Z' WHERE id = ?",
    )
      .bind(item.id)
      .run();
    const snapshot = () => env.DB.prepare("SELECT * FROM vocab").all();
    const before = await snapshot();

    for (const path of [
      `/api/vocab/${item.id}`,
      "/api/vocab",
      `/api/vocab?q=${encodeURIComponent(KITAB)}&due=true&tag=t&sort=mastery`,
      "/api/vocab/due",
      "/api/status",
      "/api/tags",
      "/api/export",
    ]) {
      expect((await api("GET", path)).status).toBe(200);
    }
    expect((await snapshot()).results).toEqual(before.results);
    expect(await eventCount()).toBe(0);
  });
});

describe("auth", () => {
  it("protects every vocab route", async () => {
    for (const [method, path] of [
      ["GET", "/api/status"],
      ["GET", "/api/tags"],
      ["GET", "/api/vocab"],
      ["GET", "/api/vocab/due"],
      ["GET", "/api/vocab/x"],
      ["POST", "/api/vocab"],
      ["PATCH", "/api/vocab/x"],
      ["DELETE", "/api/vocab/x"],
    ] as const) {
      const res = await exports.default.fetch(`http://urdu.test${path}`, {
        method,
        headers: method === "GET" ? {} : { "Content-Type": "application/json" },
        body: method === "POST" || method === "PATCH" ? JSON.stringify({ urdu: KITAB }) : undefined,
      });
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });
});
