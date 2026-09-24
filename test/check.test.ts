// f11 accuracy check (FR-F9): batch rotation and recording (s01).
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { CheckBatchResponse, ExportResponse, VocabItem } from "../shared/api";
import { type Api, clearTables, unlockedApi } from "./client";

const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const ADDED = "2026-09-01T00:00:00.000Z";

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
});

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

const vocabId = (n: number) => `01K${String(n).padStart(23, "0")}`;

type Seed = { n: number; added_at?: string; checked_at?: string | null };

// Rows written straight to D1, so added_at, checked_at and id order are set exactly.
async function seed(rows: Seed[]): Promise<void> {
  await env.DB.batch(
    rows.map(({ n, added_at = ADDED, checked_at = null }) =>
      env.DB.prepare(
        `INSERT INTO vocab (id, urdu, urdu_key, kind, ladder_id, ladder_step, interval_seconds,
           added_at, source, checked_at, created_at, updated_at)
         VALUES (?, ?, ?, 'word', 3, 0, 10800, ?, 'manual', ?, ?, ?)`,
      ).bind(vocabId(n), `w${n}`, `w${n}`, added_at, checked_at, added_at, added_at),
    ),
  );
}

const checkBatch = async () =>
  json<CheckBatchResponse>(await api("POST", "/api/handoffs/check-batch", {}));

async function checkedAt(id: string): Promise<string | null | undefined> {
  const row = await env.DB.prepare("SELECT checked_at FROM vocab WHERE id = ?")
    .bind(id)
    .first<{ checked_at: string | null }>();
  return row?.checked_at;
}

describe("POST /api/handoffs/check-batch", () => {
  it("lists never-checked first, then the oldest check, then added_at, then id", async () => {
    await seed([
      { n: 1, checked_at: "2026-09-20T00:00:00.000Z" },
      { n: 2, checked_at: "2026-09-10T00:00:00.000Z" },
      { n: 3, added_at: "2026-09-05T00:00:00.000Z" },
      { n: 4, added_at: "2026-09-02T00:00:00.000Z" },
      // Same added_at as each other: id decides.
      { n: 6, added_at: "2026-09-03T00:00:00.000Z" },
      { n: 5, added_at: "2026-09-03T00:00:00.000Z" },
      // An older check outranks an older added_at.
      { n: 7, added_at: "2026-08-01T00:00:00.000Z", checked_at: "2026-09-15T00:00:00.000Z" },
    ]);
    const body = await checkBatch();
    expect(body.items.map((i) => i.id)).toEqual([4, 5, 6, 3, 2, 7, 1].map(vocabId));
    expect(body.never_checked).toBe(4);
  });

  it("takes at most 20 and counts never-checked items across the whole vault", async () => {
    await seed(
      Array.from({ length: 25 }, (_, n) => ({
        n,
        checked_at: n < 3 ? "2026-09-10T00:00:00.000Z" : null,
      })),
    );
    const body = await checkBatch();
    expect(body.items).toHaveLength(20);
    expect(body.never_checked).toBe(22);
    expect(body.items.every((i) => i.checked_at === null)).toBe(true);
  });

  it("records each copy as a check_issued handoff holding the batch ids", async () => {
    await seed([{ n: 1 }, { n: 2 }]);
    const first = await checkBatch();
    const second = await checkBatch();

    expect(first.handoff_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(second.handoff_id).not.toBe(first.handoff_id);
    const { results } = await env.DB.prepare(
      "SELECT id, payload, status, outcome FROM handoffs ORDER BY id",
    ).all();
    expect(results).toEqual(
      [first, second].map((b) => ({
        id: b.handoff_id,
        payload: JSON.stringify({ vocab_ids: [vocabId(1), vocabId(2)] }),
        status: "check_issued",
        outcome: null,
      })),
    );
    // Issuing a batch is not a check: nothing is stamped until the corrections are applied (s02).
    expect(await checkedAt(vocabId(1))).toBeNull();
  });

  it("returns no batch and records nothing for an empty vault", async () => {
    expect(await checkBatch()).toEqual({ handoff_id: null, items: [], never_checked: 0 });
    const row = await env.DB.prepare("SELECT count(*) AS n FROM handoffs").first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});

describe("checked_at", () => {
  const STAMP = "2026-09-20T12:00:00.000Z";

  const stamp = (id: string) =>
    env.DB.prepare("UPDATE vocab SET checked_at = ? WHERE id = ?").bind(STAMP, id).run();

  it("starts null and survives an edit and a review, and the export carries it", async () => {
    const item = await json<VocabItem>(await api("POST", "/api/vocab", { urdu: PANI }), 201);
    expect(item.checked_at).toBeNull();
    expect(await checkedAt(item.id)).toBeNull();
    await stamp(item.id);

    await json(await api("PATCH", `/api/vocab/${item.id}`, { english: "water", ladder_step: 2 }));
    await json(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "correct", direction: "ur_en" }),
      201,
    );
    expect(await checkedAt(item.id)).toBe(STAMP);

    const vault = await json<ExportResponse>(await api("GET", "/api/export"));
    expect(vault.vocab[0]?.checked_at).toBe(STAMP);
  });

  it("survives an Airtable re-import of the same record", async () => {
    const record = {
      airtable_id: "rec0000000000001",
      urdu: PANI,
      english: "water",
      mastery: 2,
      added_at: "2026-09-08",
      last_reviewed_on: "2026-09-08",
    };
    await json(await api("POST", "/api/admin/import", { vocab: [record] }));
    const row = await env.DB.prepare("SELECT id FROM vocab").first<{ id: string }>();
    if (!row) throw new Error("import wrote no row");
    await stamp(row.id);

    await json(
      await api("POST", "/api/admin/import", { vocab: [{ ...record, english: "water (n.)" }] }),
    );
    expect(await checkedAt(row.id)).toBe(STAMP);
  });
});
