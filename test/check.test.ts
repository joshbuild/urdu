// f11 accuracy check (FR-F9): batch rotation and recording (s01); f13 modes and options.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type CheckBatchResponse,
  type ExportResponse,
  FILLABLE_FIELDS,
  type InvalidRequestResponse,
  type VocabItem,
} from "../shared/api";
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

type Seed = {
  n: number;
  added_at?: string;
  checked_at?: string | null;
  filled_at?: string | null;
  // Present fields; every other fillable field is null. Default: English only.
  has?: string[];
};

// Rows written straight to D1, so added_at, the stamps, the fields and id order are set exactly.
async function seed(rows: Seed[]): Promise<void> {
  await env.DB.batch(
    rows.map(({ n, added_at = ADDED, checked_at = null, filled_at = null, has = ["english"] }) =>
      env.DB.prepare(
        `INSERT INTO vocab (id, urdu, urdu_key, kind, roman, english, notes, example_urdu,
           example_english, ladder_id, ladder_step, interval_seconds, added_at, source,
           checked_at, filled_at, created_at, updated_at)
         VALUES (?, ?, ?, 'word', ?, ?, ?, ?, ?, 3, 0, 10800, ?, 'manual', ?, ?, ?, ?)`,
      ).bind(
        vocabId(n),
        `w${n}`,
        `w${n}`,
        ...FILLABLE_FIELDS.map((f) => (has.includes(f) ? `${f} ${n}` : null)),
        added_at,
        checked_at,
        filled_at,
        added_at,
        added_at,
      ),
    ),
  );
}

const checkBatch = async (options: object = {}) =>
  json<CheckBatchResponse>(await api("POST", "/api/handoffs/check-batch", options));

const ids = (body: CheckBatchResponse) => body.items.map((i) => i.id);
const OLD = "2026-09-10T00:00:00.000Z";
const NEW = "2026-09-20T00:00:00.000Z";

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
    expect(body.unchecked).toBe(4);
    expect(body.candidates).toBe(7);
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
    expect(body.unchecked).toBe(22);
    expect(body.candidates).toBe(25);
    expect(body.items.every((i) => i.checked_at === null)).toBe(true);
  });

  it("takes up to the count asked for, at most 50", async () => {
    await seed(Array.from({ length: 55 }, (_, n) => ({ n })));
    expect((await checkBatch({ count: 3 })).items).toHaveLength(3);
    expect((await checkBatch({ count: 50 })).items).toHaveLength(50);
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
        payload: JSON.stringify({
          vocab_ids: [vocabId(1), vocabId(2)],
          mode: "correctness",
          fields: [...FILLABLE_FIELDS],
        }),
        status: "check_issued",
        outcome: null,
      })),
    );
    // Issuing a batch is not a check: nothing is stamped until the corrections are applied (s02).
    expect(await checkedAt(vocabId(1))).toBeNull();
  });

  it("returns no batch and records nothing for an empty vault", async () => {
    expect(await checkBatch()).toEqual({
      handoff_id: null,
      items: [],
      candidates: 0,
      unchecked: 0,
    });
    const row = await env.DB.prepare("SELECT count(*) AS n FROM handoffs").first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});

describe("check-batch modes (f13)", () => {
  it("correctness lists only items with a chosen field to check", async () => {
    await seed([
      { n: 1, has: ["english"] },
      { n: 2, has: ["notes"] },
      { n: 3, has: [] },
    ]);
    const body = await checkBatch({ fields: ["notes", "roman"] });
    expect(ids(body)).toEqual([vocabId(2)]);
    expect(body).toMatchObject({ candidates: 1, unchecked: 1 });
  });

  it("completeness lists items missing a chosen field, rotating on filled_at", async () => {
    await seed([
      { n: 1, has: ["english", "example_urdu"] }, // has it: not a candidate
      { n: 2, filled_at: NEW },
      { n: 3, filled_at: OLD },
      { n: 4 },
      { n: 5, checked_at: OLD }, // checked_at plays no part
    ]);
    const body = await checkBatch({ mode: "completeness", fields: ["example_urdu"] });
    expect(ids(body)).toEqual([4, 5, 3, 2].map(vocabId));
    expect(body).toMatchObject({ candidates: 4, unchecked: 2 });

    const row = await env.DB.prepare("SELECT payload FROM handoffs WHERE id = ?")
      .bind(body.handoff_id)
      .first<{ payload: string }>();
    expect(JSON.parse(row?.payload ?? "")).toEqual({
      vocab_ids: [4, 5, 3, 2].map(vocabId),
      mode: "completeness",
      fields: ["example_urdu"],
    });
  });

  it("only_unchecked keeps the items never stamped in the mode", async () => {
    await seed([{ n: 1, checked_at: OLD }, { n: 2, filled_at: OLD }, { n: 3 }]);
    expect(ids(await checkBatch({ only_unchecked: true }))).toEqual([2, 3].map(vocabId));
    expect(
      ids(await checkBatch({ mode: "completeness", fields: ["notes"], only_unchecked: true })),
    ).toEqual([1, 3].map(vocabId));
  });

  it("both orders by the older stamp; the fill stamp counts only while a field is missing", async () => {
    const ALL = [...FILLABLE_FIELDS];
    await seed([
      { n: 1, checked_at: NEW, filled_at: OLD }, // missing fields: OLD
      { n: 2, checked_at: NEW, has: ALL }, // complete: its null filled_at doesn't count
      { n: 3, checked_at: "2026-09-15T00:00:00.000Z", filled_at: NEW },
      { n: 4, checked_at: NEW, filled_at: NEW, added_at: "2026-08-01T00:00:00.000Z" },
      { n: 5, filled_at: NEW }, // never checked
    ]);
    const body = await checkBatch({ mode: "both" });
    expect(ids(body)).toEqual([5, 1, 3, 4, 2].map(vocabId));
    expect(body).toMatchObject({ candidates: 5, unchecked: 1 });
    expect(ids(await checkBatch({ mode: "both", only_unchecked: true }))).toEqual([vocabId(5)]);
  });

  it("records nothing when no item qualifies, and still counts", async () => {
    await seed([{ n: 1, checked_at: OLD }]);
    expect(await checkBatch({ only_unchecked: true })).toEqual({
      handoff_id: null,
      items: [],
      candidates: 1,
      unchecked: 0,
    });
    const row = await env.DB.prepare("SELECT count(*) AS n FROM handoffs").first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it.each([
    [[], undefined],
    [{ extra: 1 }, "extra"],
    [{ mode: "speed" }, "mode"],
    [{ fields: [] }, "fields"],
    [{ fields: "english" }, "fields"],
    [{ fields: ["urdu"] }, "fields[0]"],
    [{ fields: ["english", "english"] }, "fields[1]"],
    [{ count: 0 }, "count"],
    [{ count: 51 }, "count"],
    [{ count: 1.5 }, "count"],
    [{ count: "20" }, "count"],
    [{ only_unchecked: "yes" }, "only_unchecked"],
  ])("rejects options %j on %s", async (options, field) => {
    const res = await api("POST", "/api/handoffs/check-batch", options);
    const body = await json<InvalidRequestResponse>(res, 400);
    expect(body.field).toBe(field);
  });
});

describe("checked_at and filled_at", () => {
  const STAMP = "2026-09-20T12:00:00.000Z";

  const stamp = (id: string) =>
    env.DB.prepare("UPDATE vocab SET checked_at = ?, filled_at = ? WHERE id = ?")
      .bind(STAMP, STAMP, id)
      .run();

  const filledAt = async (id: string) =>
    (
      await env.DB.prepare("SELECT filled_at FROM vocab WHERE id = ?")
        .bind(id)
        .first<{ filled_at: string | null }>()
    )?.filled_at;

  it("starts null and survives an edit and a review, and the export carries it", async () => {
    const item = await json<VocabItem>(await api("POST", "/api/vocab", { urdu: PANI }), 201);
    expect(item.checked_at).toBeNull();
    expect(item.filled_at).toBeNull();
    expect(await checkedAt(item.id)).toBeNull();
    await stamp(item.id);

    await json(await api("PATCH", `/api/vocab/${item.id}`, { english: "water", ladder_step: 2 }));
    await json(
      await api("POST", `/api/vocab/${item.id}/reviews`, { grade: "correct", direction: "ur_en" }),
      201,
    );
    expect(await checkedAt(item.id)).toBe(STAMP);
    expect(await filledAt(item.id)).toBe(STAMP);

    const vault = await json<ExportResponse>(await api("GET", "/api/export"));
    expect(vault.vocab[0]?.checked_at).toBe(STAMP);
    expect(vault.vocab[0]?.filled_at).toBe(STAMP);
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
    expect(await filledAt(row.id)).toBe(STAMP);
  });
});
