// f17 (FR-K) intake: queued items stay in the vault but out of due; due items come before the
// new pile (FR-A7); a tracked review releases a queued item.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ExportResponse, SettingsResponse, StatusResponse, VocabItem } from "../shared/api";
import { todayIn } from "../shared/dates";
import { claimAndRelease, releaseNext, topUpIntake } from "../worker/domain/intake";
import { applyReview } from "../worker/domain/review";
import { createVocab, getVocab } from "../worker/domain/vocab";
import { type Api, clearTables, unlockedApi } from "./client";

const WORDS = [
  "\u{06A9}\u{062A}\u{0627}\u{0628}", // کتاب
  "\u{067E}\u{0627}\u{0646}\u{06CC}", // پانی
  "\u{06AF}\u{06BE}\u{0631}", // گھر
  "\u{062F}\u{0648}\u{0633}\u{062A}", // دوست
  "\u{0634}\u{06C1}\u{0631}", // شہر
];
const DAY_MS = 86_400_000;
const inDays = (d: number) => new Date(Date.now() + d * DAY_MS).toISOString();

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
});

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

async function make(
  i: number,
  opts: { queued?: boolean; added?: string; last?: string; due?: string } = {},
): Promise<VocabItem> {
  const result = await createVocab(
    env.DB,
    { urdu: WORDS[i] as string, source: "manual" },
    new Date(),
    8,
    { queued: opts.queued },
  );
  if (!result.ok) throw new Error(result.error);
  const { id } = result.item;
  if (opts.added) {
    await env.DB.prepare("UPDATE vocab SET added_at = ? WHERE id = ?").bind(opts.added, id).run();
  }
  if (opts.last) {
    await env.DB.prepare("UPDATE vocab SET last_reviewed_at = ?, due_at = ? WHERE id = ?")
      .bind(opts.last, opts.due, id)
      .run();
  }
  return (await getVocab(env.DB, id)) as VocabItem;
}

describe("createVocab", () => {
  it("releases a new item at creation unless it is queued", async () => {
    const released = await make(0);
    expect(released.released_at).toBe(released.added_at);
    expect(released.harvest_id).toBeNull();
    const queued = await make(1, { queued: true });
    expect(queued.released_at).toBeNull();
  });

  it("releases a PWA-created item", async () => {
    const item = await json<VocabItem>(await api("POST", "/api/vocab", { urdu: WORDS[0] }), 201);
    expect(item.released_at).toBe(item.added_at);
    expect((await getVocab(env.DB, item.id))?.released_at).toBe(item.added_at);
  });
});

describe("due (FR-A7, f17)", () => {
  // Today's top-up has run, so the reads below release nothing.
  beforeEach(async () => {
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('intake_topup', ?)")
      .bind(`${todayIn(env.HOME_TZ)}:claimed`)
      .run();
  });

  it("excludes queued items and puts the new pile after due items, FIFO", async () => {
    const newOld = await make(0, { added: "2026-01-01T00:00:00.000Z" });
    const newLate = await make(1, { added: "2026-02-01T00:00:00.000Z" });
    const overdue = await make(2, { last: inDays(-10), due: inDays(-5) });
    const dueNow = await make(3, { last: inDays(-1), due: inDays(-0.01) });
    await make(4, { queued: true, added: "2025-01-01T00:00:00.000Z" });

    const due = await json<{ items: VocabItem[] }>(await api("GET", "/api/vocab/due"));
    expect(due.items.map((i) => i.id)).toEqual([overdue.id, dueNow.id, newOld.id, newLate.id]);

    const status = await json<StatusResponse>(await api("GET", "/api/status"));
    expect(status).toMatchObject({ total: 5, due: 4 });

    const listed = await json<{ items: VocabItem[]; total: number }>(
      await api("GET", "/api/vocab?due=1"),
    );
    expect(listed.total).toBe(4);
  });

  it("sorts queued items last by next review, after the new pile", async () => {
    const queued = await make(0, { queued: true, added: "2025-01-01T00:00:00.000Z" });
    const fresh = await make(1);
    const later = await make(2, { last: inDays(-1), due: inDays(3) });
    const order = (
      await json<{ items: VocabItem[] }>(await api("GET", "/api/vocab?sort=next_review"))
    ).items.map((i) => i.id);
    expect(order).toEqual([later.id, fresh.id, queued.id]);
  });
});

describe("a review on a queued item", () => {
  it("a tracked review releases it, at the review instant", async () => {
    const item = await make(0, { queued: true });
    const now = new Date();
    const result = await applyReview(
      env.DB,
      item,
      { grade: "correct", direction: "ur_en", source: "coach" },
      now,
      8,
    );
    expect(result.ok).toBe(true);
    const stored = await getVocab(env.DB, item.id);
    expect(stored?.released_at).toBe(now.toISOString());
    if (result.ok) expect(result.item.released_at).toBe(now.toISOString());
  });

  it("a supported (logged-only) event leaves it queued", async () => {
    const item = await make(0, { queued: true });
    const result = await applyReview(
      env.DB,
      item,
      { grade: "correct", direction: "ur_en", source: "coach", promptSupport: "hint" },
      new Date(),
      8,
    );
    expect(result.ok).toBe(true);
    expect((await getVocab(env.DB, item.id))?.released_at).toBeNull();
  });

  it("a review on a released item keeps its released_at", async () => {
    const item = await make(0);
    await applyReview(
      env.DB,
      item,
      { grade: "correct", direction: "ur_en", source: "pwa" },
      new Date(Date.now() + 1000),
      8,
    );
    expect((await getVocab(env.DB, item.id))?.released_at).toBe(item.released_at);
  });
});

describe("export", () => {
  it("carries released_at, harvest_id, and the sources and harvests", async () => {
    const at = "2026-09-30T10:00:00.000Z";
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO sources (id, name, url, notes, created_at, updated_at) VALUES ('01J00000000000000000000S01', 'Story', 'https://x.test/a', NULL, ?, ?)",
      ).bind(at, at),
      env.DB.prepare(
        "INSERT INTO harvests (id, source_id, filter, created_at) VALUES ('01J00000000000000000000H01', '01J00000000000000000000S01', 'CEFR A2+', ?)",
      ).bind(at),
    ]);
    const result = await createVocab(
      env.DB,
      { urdu: WORDS[0] as string, source: "coach" },
      new Date(),
      8,
      { queued: true, harvestId: "01J00000000000000000000H01" },
    );
    expect(result.ok).toBe(true);

    const vault = await json<ExportResponse>(await api("GET", "/api/export"));
    expect(vault.vocab[0]).toMatchObject({
      harvest_id: "01J00000000000000000000H01",
      released_at: null,
    });
    expect(vault.sources).toEqual([
      {
        id: "01J00000000000000000000S01",
        name: "Story",
        url: "https://x.test/a",
        notes: null,
        created_at: at,
        updated_at: at,
      },
    ]);
    expect(vault.harvests).toEqual([
      {
        id: "01J00000000000000000000H01",
        source_id: "01J00000000000000000000S01",
        filter: "CEFR A2+",
        created_at: at,
      },
    ]);
  });
});

// Queued items 0..n-1, added a minute apart from 2026-01-01, so FIFO order is index order. Their
// updated_at is backdated too, so a release that bumped it would show.
async function queue(n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const result = await createVocab(
      env.DB,
      { urdu: `\u{06A9}${"\u{0627}".repeat(i + 1)}`, source: "coach" },
      new Date(),
      8,
      { queued: true },
    );
    if (!result.ok) throw new Error(result.error);
    const added = new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();
    await env.DB.prepare("UPDATE vocab SET added_at = ?1, updated_at = ?1 WHERE id = ?2")
      .bind(added, result.item.id)
      .run();
    ids.push(result.item.id);
  }
  return ids;
}

async function releasedIds(): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "SELECT id FROM vocab WHERE released_at IS NOT NULL ORDER BY added_at, id",
  ).all<{ id: string }>();
  return results.map((r) => r.id);
}

async function setBatch(n: number) {
  await env.DB.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('intake_batch_size', ?)",
  )
    .bind(String(n))
    .run();
}

// Puts every released item out of the new pile: reviewed now, due tomorrow.
async function drainNewPile() {
  await env.DB.prepare(
    "UPDATE vocab SET last_reviewed_at = ?, due_at = ? WHERE released_at IS NOT NULL",
  )
    .bind(new Date().toISOString(), inDays(1))
    .run();
}

const TZ = env.HOME_TZ;

describe("topUpIntake", () => {
  it("tops the new pile up to the batch size, first in first out", async () => {
    const ids = await queue(15);
    await make(0); // already in the new pile: counts towards the batch
    expect(await topUpIntake(env.DB, new Date(), TZ)).toBe(9);
    const released = await releasedIds();
    expect(released.filter((id) => ids.includes(id))).toEqual(ids.slice(0, 9));
  });

  it("releases nothing while the new pile is full", async () => {
    await setBatch(2);
    await queue(3);
    await make(0);
    await make(1);
    expect(await topUpIntake(env.DB, new Date(), TZ)).toBe(0);
    expect(await releasedIds()).toHaveLength(2);
  });

  it("release leaves updated_at alone", async () => {
    const [a] = await queue(1);
    const before = (await getVocab(env.DB, a as string))?.updated_at;
    expect(await topUpIntake(env.DB, new Date(), TZ)).toBe(1);
    const after = await getVocab(env.DB, a as string);
    expect(after?.released_at).not.toBeNull();
    expect(after?.updated_at).toBe(before);
  });

  it("runs once per HOME_TZ day, and again the next day", async () => {
    await setBatch(2);
    await queue(6);
    const now = new Date();
    expect(await topUpIntake(env.DB, now, TZ)).toBe(2);
    await drainNewPile();
    expect(await topUpIntake(env.DB, new Date(now.getTime() + 1000), TZ)).toBe(0);
    expect(await topUpIntake(env.DB, new Date(now.getTime() + DAY_MS), TZ)).toBe(2);
    expect(await releasedIds()).toHaveLength(4);
  });

  it("concurrent first calls of the day release one batch", async () => {
    await setBatch(3);
    await queue(10);
    const now = new Date();
    const results = await Promise.all([
      topUpIntake(env.DB, now, TZ),
      topUpIntake(env.DB, now, TZ),
      topUpIntake(env.DB, now, TZ),
    ]);
    expect(results.reduce((a, b) => a + b, 0)).toBe(3);
    expect(await releasedIds()).toHaveLength(3);
  });

  it("releases 0 from an empty queue", async () => {
    expect(await topUpIntake(env.DB, new Date(), TZ)).toBe(0);
  });

  it("a call whose claim lost releases nothing, even with the new pile empty", async () => {
    await queue(4);
    const today = todayIn(TZ);
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('intake_topup', ?)")
      .bind(`${today}:someone-else`)
      .run();
    expect(await claimAndRelease(env.DB, new Date(), today)).toBe(0);
    expect(await releasedIds()).toHaveLength(0);
    // Yesterday's claim gives way.
    await env.DB.prepare(
      "UPDATE settings SET value = '2000-01-01:old' WHERE key = 'intake_topup'",
    ).run();
    expect(await claimAndRelease(env.DB, new Date(), today)).toBe(4);
  });

  it("runs on the voice Coach's due tool", async () => {
    await setBatch(1);
    await queue(2);
    const res = await api("POST", "/api/voice/tools/get_vocab", {
      session_id: "s-1",
      call_id: "c-1",
      arguments: { scope: "due" },
    });
    const body = await json<{ items: { id: string }[] }>(res);
    expect(body.items).toHaveLength(1);
    expect(await releasedIds()).toHaveLength(1);
  });

  it("runs on GET /api/status, /api/vocab/due and /api/dash", async () => {
    await setBatch(1);
    await queue(5);
    const status = await json<StatusResponse>(await api("GET", "/api/status"));
    expect(status.intake).toEqual({ queued: 4, new: 1, batch_size: 1 });
    expect(status.due).toBe(1);
    for (const path of ["/api/vocab/due", "/api/dash"]) {
      await env.DB.prepare("DELETE FROM settings WHERE key = 'intake_topup'").run();
      await drainNewPile();
      const before = (await releasedIds()).length;
      expect((await api("GET", path)).status).toBe(200);
      expect(await releasedIds()).toHaveLength(before + 1);
    }
  });
});

describe("POST /api/intake/release", () => {
  it("releases the next batch, ignoring the day's claim, and reports what is left", async () => {
    await setBatch(4);
    const ids = await queue(6);
    expect(await topUpIntake(env.DB, new Date(), TZ)).toBe(4);
    const body = await json<{ released: number; queued: number }>(
      await api("POST", "/api/intake/release", {}),
    );
    expect(body).toEqual({ released: 2, queued: 0 });
    expect(await releasedIds()).toEqual(ids);
  });

  it("takes a count, and releases 0 from an empty queue", async () => {
    const ids = await queue(5);
    expect(
      await json<{ released: number; queued: number }>(
        await api("POST", "/api/intake/release", { count: 2 }),
      ),
    ).toEqual({ released: 2, queued: 3 });
    expect(await releasedIds()).toEqual(ids.slice(0, 2));
    await releaseNext(env.DB, 50, new Date());
    expect(
      await json<{ released: number; queued: number }>(
        await api("POST", "/api/intake/release", {}),
      ),
    ).toEqual({ released: 0, queued: 0 });
  });

  it.each([{ count: 0 }, { count: 51 }, { count: 1.5 }, { count: "3" }, { count: null }, { n: 3 }])(
    "rejects %j with 400",
    async (body) => {
      expect((await api("POST", "/api/intake/release", body)).status).toBe(400);
    },
  );
});

describe("POST /api/vocab/:id/release", () => {
  it("releases a queued item, is a no-op on a released one, and 404s an unknown id", async () => {
    const [id] = await queue(1);
    const before = (await getVocab(env.DB, id as string))?.updated_at;
    const item = await json<VocabItem>(await api("POST", `/api/vocab/${id}/release`));
    expect(item.released_at).not.toBeNull();
    expect(item.updated_at).toBe(before);
    const again = await json<VocabItem>(await api("POST", `/api/vocab/${id}/release`));
    expect(again.released_at).toBe(item.released_at);
    expect((await api("POST", "/api/vocab/01JZZZZZZZZZZZZZZZZZZZZZZZ/release")).status).toBe(404);
  });
});

describe("intake_batch_size setting", () => {
  it("defaults to 10, takes 1 to 50, and rejects anything else", async () => {
    const initial = await json<SettingsResponse>(await api("GET", "/api/settings"));
    expect(initial.intake_batch_size).toBe(10);
    for (const n of [1, 50]) {
      const body = await json<SettingsResponse>(
        await api("PATCH", "/api/settings", { intake_batch_size: n }),
      );
      expect(body.intake_batch_size).toBe(n);
    }
    for (const bad of [0, 51, 2.5, "10", null]) {
      expect((await api("PATCH", "/api/settings", { intake_batch_size: bad })).status).toBe(400);
    }
  });

  it("releases and hides nothing when changed", async () => {
    await queue(3);
    await make(0);
    await api("PATCH", "/api/settings", { intake_batch_size: 2 });
    expect(await releasedIds()).toHaveLength(1);
  });
});
