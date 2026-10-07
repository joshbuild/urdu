// f18 s03: classify. POST /api/handoffs/classify-batch records up to 100 unclassified items; the
// thin reply comes back through POST /api/handoffs/classify, previewed then applied.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  ClassifyBatchResponse,
  ClassifyResponse,
  CoverageResponse,
  VocabItem,
} from "../shared/api";
import { type Api, clearTables, unlockedApi } from "./client";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const GHAR = "\u{06AF}\u{06BE}\u{0631}"; // گھر
const ROTI = "\u{0631}\u{0648}\u{0679}\u{06CC}"; // روٹی
const CHAI = "\u{0686}\u{0627}\u{0626}\u{06D2}"; // چائے

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
});

async function json<T>(res: Response, status = 200): Promise<T> {
  expect(res.status).toBe(status);
  return res.json();
}

async function create(body: Record<string, unknown>): Promise<VocabItem> {
  return json(await api("POST", "/api/vocab", body), 201);
}

async function item(urdu: string) {
  return env.DB.prepare("SELECT * FROM vocab WHERE urdu = ?")
    .bind(urdu)
    .first<Record<string, unknown>>();
}

const issue = async (body: unknown = {}) =>
  json<ClassifyBatchResponse>(await api("POST", "/api/handoffs/classify-batch", body));

const preview = (body: unknown) => api("POST", "/api/handoffs/classify?preview=1", body);
const apply = (body: unknown) => api("POST", "/api/handoffs/classify", body);

describe("POST /api/handoffs/classify-batch", () => {
  it("lists unclassified items oldest first, numbered from 1, and records the batch", async () => {
    await create({ urdu: KITAB, english: "book" });
    await create({ urdu: PANI, english: "water", topic: "food" }); // no level: unclassified
    await create({ urdu: GHAR, topic: "home", cefr: "A1" }); // classified
    const body = await issue();
    expect(body.items.map((i) => [i.n, i.urdu, i.english])).toEqual([
      [1, KITAB, "book"],
      [2, PANI, "water"],
    ]);
    expect(body.unclassified).toBe(2);
    const row = await env.DB.prepare("SELECT status FROM handoffs WHERE id = ?")
      .bind(body.handoff_id)
      .first<{ status: string }>();
    expect(row?.status).toBe("classify_issued");
  });

  it("takes at most count, 100 by default, and records nothing when all are classified", async () => {
    await create({ urdu: KITAB });
    await create({ urdu: PANI });
    expect((await issue({ count: 1 })).items).toHaveLength(1);
    expect((await api("POST", "/api/handoffs/classify-batch", { count: 101 })).status).toBe(400);
    expect((await api("POST", "/api/handoffs/classify-batch", { count: 0 })).status).toBe(400);
    await clearTables();
    api = await unlockedApi();
    await create({ urdu: GHAR, topic: "home", cefr: "A1" });
    const none = await issue();
    expect(none).toEqual({ handoff_id: null, items: [], unclassified: 0 });
    const count = await env.DB.prepare("SELECT count(*) AS n FROM handoffs").first<{ n: number }>();
    expect(count?.n).toBe(0);
  });
});

describe("POST /api/handoffs/classify", () => {
  async function batchOf(...words: string[]) {
    for (const urdu of words) await create({ urdu });
    return issue();
  }

  it("previews each row, rejecting bad ones and listing omitted items, writing nothing", async () => {
    const { handoff_id } = await batchOf(KITAB, PANI, GHAR, CHAI);
    const body = await json<ClassifyResponse>(
      await preview({
        handoff_id,
        rows: [
          [1, KITAB, "School", "a1", ["home", "objects", "school"]],
          [2, ROTI, "food", "A1", []],
          [9, GHAR, "home", "A1"],
          [3, GHAR, "objects", "A1"],
          "nonsense",
        ],
      }),
    );
    expect(body.preview).toBe(true);
    expect(body.results).toEqual([
      {
        n: 1,
        vocab_id: expect.any(String),
        urdu: KITAB,
        outcome: "classify",
        topic: "school",
        cefr: "A1",
        tags: ["home"],
        dropped: ["tag objects", "tag school"],
      },
      { n: 2, urdu: ROTI, outcome: "rejected", reason: expect.stringContaining("Urdu") },
      { n: 9, urdu: GHAR, outcome: "rejected", reason: expect.stringContaining("9") },
      { n: 3, urdu: GHAR, outcome: "rejected", reason: expect.stringContaining("objects") },
      { n: null, urdu: "", outcome: "rejected", reason: expect.stringContaining("row 5") },
      // A row answered but rejected still counts as answered; only CHAI was left out.
      { n: 4, vocab_id: expect.any(String), urdu: CHAI, outcome: "missing" },
    ]);
    expect((await item(KITAB))?.topic).toBeNull();
  });

  it("applies the ticked rows only, leaving the schedule alone, and repeats from storage", async () => {
    const { handoff_id } = await batchOf(KITAB, PANI);
    const before = await item(KITAB);
    const rows = [
      [1, KITAB, "school", "A1", ["home"]],
      [2, PANI, "food", "A1"],
    ];
    const body = await json<ClassifyResponse>(await apply({ handoff_id, rows, accept: [1] }));
    expect(body.preview).toBe(false);
    expect(body.results.map((r) => [r.n, r.outcome])).toEqual([
      [1, "classified"],
      [2, "declined"],
    ]);
    const after = await item(KITAB);
    expect(after).toMatchObject({ topic: "school", cefr: "A1", tags: '["home"]' });
    for (const key of ["ladder_step", "interval_seconds", "due_at", "last_reviewed_at"]) {
      expect(after?.[key]).toEqual(before?.[key]);
    }
    expect(after?.updated_at).not.toBe(before?.updated_at);
    expect((await item(PANI))?.topic).toBeNull();

    const again = await json<ClassifyResponse>(await apply({ handoff_id, rows, accept: [1, 2] }));
    expect(again).toEqual({ ...body, repeat: true });
    expect((await item(PANI))?.topic).toBeNull();
    const coverage = await json<CoverageResponse>(await api("GET", "/api/coverage"));
    expect(coverage.unclassified).toBe(1);
  });

  it("leaves an item whose topic or level changed since the batch was issued", async () => {
    const { handoff_id } = await batchOf(KITAB);
    const kitab = await item(KITAB);
    await json(await api("PATCH", `/api/vocab/${kitab?.id}`, { cefr: "A2" }));
    const body = await json<ClassifyResponse>(
      await apply({ handoff_id, rows: [[1, KITAB, "school", "A1"]], accept: [1] }),
    );
    expect(body.results[0]?.outcome).toBe("stale");
    expect(await item(KITAB)).toMatchObject({ topic: null, cefr: "A2" });
    const again = await json<ClassifyResponse>(
      await apply({ handoff_id, rows: [[1, KITAB, "school", "A1"]], accept: [1] }),
    );
    expect(again.repeat).toBe(true);
    expect(again.results[0]?.outcome).toBe("stale");
  });

  it("rejects a row for a deleted item, and lets a good row follow a bad one for the same n", async () => {
    const { handoff_id } = await batchOf(KITAB, PANI);
    const pani = await item(PANI);
    expect((await api("DELETE", `/api/vocab/${pani?.id}`)).ok).toBe(true);
    const body = await json<ClassifyResponse>(
      await preview({
        handoff_id,
        rows: [
          [1, KITAB, "objects", "A1"],
          [1, KITAB, "school", "A1"],
          [2, PANI, "food", "A1"],
        ],
      }),
    );
    expect(body.results.map((r) => [r.n, r.outcome])).toEqual([
      [1, "rejected"],
      [1, "classify"],
      [2, "rejected"],
    ]);
    expect(body.results[2]).toMatchObject({ reason: expect.stringContaining("deleted") });
  });

  it("refuses an id that is not a classify batch, and a top-level bad shape", async () => {
    expect((await preview({ handoff_id: "nope", rows: [] })).status).toBe(400);
    const { handoff_id } = await batchOf(KITAB);
    expect((await preview({ handoff_id, rows: "x" })).status).toBe(400);
    expect((await apply({ handoff_id, rows: [] })).status).toBe(400); // apply needs accept
    const check = await json<{ handoff_id: string }>(
      await api("POST", "/api/handoffs/check-batch", { mode: "completeness" }),
    );
    expect((await preview({ handoff_id: check.handoff_id, rows: [] })).status).toBe(409);
    expect(
      (await api("POST", "/api/handoffs/corrections?preview=1", { handoff_id, corrections: [] }))
        .status,
    ).toBe(409);
  });
});
