import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import type { ImportResponse, ImportVocabRecord, VocabItem } from "../shared/api";
import { type Api, clearTables, unlockedApi } from "./client";

// Escapes keep the exact code points visible in review.
const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب with keheh
const KITAB_ARABIC_KAF_WITH_KASRA = "\u{0643}\u{0650}\u{062A}\u{0627}\u{0628}"; // كِتاب
const BAHUT_SHUKRIYA = "\u{0628}\u{06C1}\u{062A} \u{0634}\u{06A9}\u{0631}\u{06CC}\u{06C1}"; // بہت شکریہ
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی

let api: Api;

beforeEach(async () => {
  await clearTables();
  api = await unlockedApi();
});

function record(over: Partial<ImportVocabRecord> = {}): ImportVocabRecord {
  return {
    airtable_id: "rec0000000000001",
    urdu: KITAB,
    roman: "kitaab",
    english: "book",
    mastery: 3,
    added_at: "2026-09-08",
    last_reviewed_on: "2026-09-08",
    ...over,
  };
}

async function importBatch(body: Record<string, unknown>, status = 200): Promise<ImportResponse> {
  const res = await api("POST", "/api/admin/import", body);
  expect(res.status).toBe(status);
  return res.json();
}

const one = (over: Partial<ImportVocabRecord> = {}) => importBatch({ vocab: [record(over)] });

async function vocabRows(): Promise<VocabItem[]> {
  const res = await api("GET", "/api/vocab?limit=200");
  const body = await res.json<{ items: VocabItem[] }>();
  return body.items;
}

// noUncheckedIndexedAccess: narrow once here rather than at every assertion.
function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no element at ${index}`);
  return item;
}

async function onlyRow(): Promise<VocabItem> {
  const items = await vocabRows();
  expect(items).toHaveLength(1);
  return at(items, 0);
}

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

describe("POST /api/admin/import", () => {
  it("requires a session", async () => {
    const res = await (await import("cloudflare:workers")).exports.default.fetch(
      "http://urdu.test/api/admin/import",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vocab: [] }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("creates a row with the mapped fields, source airtable and a recomputed next review", async () => {
    const body = await one();
    expect(body.counts).toEqual({ created: 1, updated: 0, rejected: 0 });

    const item = await onlyRow();
    expect(item.urdu).toBe(KITAB);
    expect(item.roman).toBe("kitaab");
    expect(item.english).toBe("book");
    expect(item.mastery).toBe(3);
    expect(item.source).toBe("airtable");
    expect(item.airtable_id).toBe("rec0000000000001");
    expect(item.kind).toBe("word");
    expect(item.last_reviewed_on).toBe("2026-09-08");
    // mastery 3 = Firm, interval 25 days.
    expect(item.next_review_on).toBe("2026-10-03");
    expect(item.added_at).toBe("2026-09-08T00:00:00.000Z");
    expect(at(body.results, 0)).toMatchObject({ outcome: "created", next_review_on: "2026-10-03" });
  });

  it("infers phrase for a multi-word term", async () => {
    await one({ urdu: BAHUT_SHUKRIYA });
    const item = await onlyRow();
    expect(item.kind).toBe("phrase");
  });

  it("leaves a never-reviewed row due now", async () => {
    await one({ last_reviewed_on: null, mastery: 0 });
    const item = await onlyRow();
    expect(item.last_reviewed_on).toBeNull();
    expect(item.next_review_on).toBeNull();
  });

  it("is idempotent: re-running updates in place and adds no rows or events", async () => {
    await one();
    const first = await onlyRow();

    const again = await importBatch({ vocab: [record({ english: "book (corrected)" })] });
    expect(again.counts).toEqual({ created: 0, updated: 1, rejected: 0 });

    const items = await vocabRows();
    expect(items).toHaveLength(1);
    expect(at(items, 0).id).toBe(first.id);
    expect(at(items, 0).english).toBe("book (corrected)");
    expect(await count("review_events")).toBe(0);
  });

  it("reports a mismatch only when the caller's next review disagrees", async () => {
    const agreeing = await one({ airtable_next_review_on: "2026-10-03" });
    expect(agreeing.mismatches).toBe(0);
    expect(at(agreeing.results, 0).next_review_mismatch).toBeUndefined();

    const disagreeing = await one({ airtable_next_review_on: "2026-11-01" });
    expect(disagreeing.mismatches).toBe(1);
    expect(at(disagreeing.results, 0).next_review_mismatch).toEqual({
      airtable: "2026-11-01",
      recomputed: "2026-10-03",
    });
  });

  it("rejects a row whose urdu_key is held by a different airtable record", async () => {
    await one();
    const body = await importBatch({
      vocab: [record({ airtable_id: "rec0000000000002", urdu: KITAB_ARABIC_KAF_WITH_KASRA })],
    });
    expect(body.counts).toEqual({ created: 0, updated: 0, rejected: 1 });
    expect(at(body.results, 0).reason).toContain("urdu_key already held");
    expect(await vocabRows()).toHaveLength(1);
  });

  it("rejects a collision between two records in the same batch", async () => {
    const body = await importBatch({
      vocab: [
        record(),
        record({ airtable_id: "rec0000000000002", urdu: KITAB_ARABIC_KAF_WITH_KASRA }),
      ],
    });
    expect(body.counts).toEqual({ created: 1, updated: 0, rejected: 1 });
  });

  it("rejects bad rows individually without failing the batch", async () => {
    const body = await importBatch({
      vocab: [
        record(),
        record({ airtable_id: "rec2", mastery: 9 as never }),
        record({ airtable_id: "rec3", urdu: "!!!" }),
        record({ airtable_id: "rec4", last_reviewed_on: "8 Sep 2026" }),
        { urdu: PANI, mastery: 0, added_at: "2026-09-08", last_reviewed_on: null },
      ],
    });
    expect(body.counts).toEqual({ created: 1, updated: 0, rejected: 4 });
    expect(at(body.results, 1).field).toBe("mastery");
    expect(at(body.results, 2).field).toBe("urdu");
    expect(at(body.results, 3).field).toBe("last_reviewed_on");
    expect(at(body.results, 4).field).toBe("airtable_id");
    expect(await vocabRows()).toHaveLength(1);
  });

  it("upserts tags from vocab rows and from the tags table", async () => {
    await importBatch({
      vocab: [record({ tags: ["nouns", "spirituality"] })],
      tags: [
        { name: "nouns", description: "Concrete objects, people, places or things." },
        { name: "unused-tag", description: "Imported but not yet applied." },
      ],
    });

    const rows = await env.DB.prepare("SELECT name, description FROM tags ORDER BY name").all<{
      name: string;
      description: string | null;
    }>();
    expect(rows.results).toEqual([
      { name: "nouns", description: "Concrete objects, people, places or things." },
      { name: "spirituality", description: null },
      { name: "unused-tag", description: "Imported but not yet applied." },
    ]);
  });

  it("does not clear an existing description when a vocab row names the tag again", async () => {
    await importBatch({ vocab: [], tags: [{ name: "nouns", description: "kept" }] });
    await one({ tags: ["nouns"] });
    const row = await env.DB.prepare("SELECT description FROM tags WHERE name = ?")
      .bind("nouns")
      .first<{ description: string | null }>();
    expect(row?.description).toBe("kept");
  });

  it("rejects an unknown field, a missing vocab array and an oversized batch", async () => {
    await importBatch({ vocab: [], extra: 1 }, 400);
    await importBatch({ tags: [] }, 400);
    await importBatch({ vocab: new Array(201).fill(record()) }, 400);
  });

  it("never deletes rows the batch does not mention", async () => {
    await one();
    await importBatch({ vocab: [record({ airtable_id: "rec0000000000002", urdu: PANI })] });
    expect(await vocabRows()).toHaveLength(2);
  });
});
