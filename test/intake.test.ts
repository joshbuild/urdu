// f17 (FR-K) intake: queued items stay in the vault but out of due; due items come before the
// new pile (FR-A7); a tracked review releases a queued item.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ExportResponse, StatusResponse, VocabItem } from "../shared/api";
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
