import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { urduKey } from "../shared/normalize";
import { ulid } from "../shared/ulid";

const NOW = "2026-09-14T17:00:00.000Z";
type Row = Record<string, string | number | null>;

async function insert(table: string, row: Row): Promise<void> {
  const cols = Object.keys(row);
  await env.DB.prepare(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
  )
    .bind(...Object.values(row))
    .run();
}

let counter = 0;

function vocabRow(overrides: Row = {}): Row {
  counter += 1;
  const urdu = `\u{06A9}\u{062A}\u{0627}\u{0628} ${counter}`;
  return {
    id: ulid(),
    urdu,
    urdu_key: urduKey(urdu),
    kind: "phrase",
    ladder_id: 3,
    ladder_step: 0,
    interval_seconds: 10800,
    added_at: NOW,
    source: "manual",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function eventRow(vocabId: string, overrides: Row = {}): Row {
  return {
    id: ulid(),
    vocab_id: vocabId,
    reviewed_at: NOW,
    grade: "correct",
    direction: "ur_en",
    source: "pwa",
    ladder_before_id: 3,
    step_before: 0,
    interval_before: 10800,
    ladder_id: 3,
    step_after: 1,
    interval_after: 25687,
    ...overrides,
  };
}

async function count(table: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? -1;
}

beforeEach(async () => {
  await env.DB.batch(
    ["review_events", "vocab", "handoffs", "tags", "sessions"].map((t) =>
      env.DB.prepare(`DELETE FROM ${t}`),
    ),
  );
});

describe("migrations", () => {
  it("create all Appendix A tables", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT IN ('d1_migrations', 'sqlite_sequence') AND name NOT LIKE '\\_cf%' ESCAPE '\\' ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "handoffs",
      "review_events",
      "sessions",
      "settings",
      "tags",
      "vocab",
      "voice_sessions",
    ]);
  });

  it("use the due index for due selection", async () => {
    const { results } = await env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT id FROM vocab WHERE due_at IS NULL OR due_at <= ? ORDER BY due_at, added_at LIMIT 20",
    )
      .bind(NOW)
      .all<{ detail: string }>();
    expect(results.map((r) => r.detail).join("\n")).toContain("vocab_due");
  });
});

describe("vocab", () => {
  it("accepts a minimal row and applies defaults", async () => {
    const row = vocabRow();
    await insert("vocab", row);
    const saved = await env.DB.prepare("SELECT * FROM vocab WHERE id = ?").bind(row.id).first();
    expect(saved).toMatchObject({
      tags: "[]",
      favourite: 0,
      roman: null,
      last_reviewed_at: null,
      due_at: null,
      airtable_id: null,
    });
  });

  it("rejects a duplicate urdu_key", async () => {
    const first = vocabRow();
    await insert("vocab", first);
    await expect(insert("vocab", vocabRow({ urdu_key: String(first.urdu_key) }))).rejects.toThrow(
      /UNIQUE constraint failed: vocab\.urdu_key/,
    );
  });

  it("rejects a duplicate airtable_id but allows many nulls", async () => {
    await insert("vocab", vocabRow({ airtable_id: "rec123" }));
    await expect(insert("vocab", vocabRow({ airtable_id: "rec123" }))).rejects.toThrow(
      /UNIQUE constraint failed: vocab\.airtable_id/,
    );
    await insert("vocab", vocabRow());
    await insert("vocab", vocabRow());
    expect(await count("vocab")).toBe(3);
  });

  // STRICT rejects 2.5 as a datatype error (it would coerce "3" losslessly, so no string case).
  it.each([
    ["ladder_id", 0],
    ["ladder_step", -1],
    ["ladder_step", 2.5],
    ["interval_seconds", -1],
  ])("rejects %s = %s", async (column, value) => {
    await expect(insert("vocab", vocabRow({ [column]: value }))).rejects.toThrow(/constraint/i);
  });

  it.each([0, 15])(
    "accepts ladder_step %i (the bound is the ladder's, checked in code)",
    async (ladder_step) => {
      await insert("vocab", vocabRow({ ladder_step }));
      expect(await count("vocab")).toBe(1);
    },
  );

  it.each([
    ["kind", "sentence"],
    ["source", "chatgpt"],
    ["favourite", 2],
    ["tags", "food"],
    ["tags", '{"a":1}'],
    ["urdu_key", ""],
    ["id", "not-a-ulid"],
  ])("rejects %s = %j", async (column, value) => {
    const row = vocabRow({ [column]: value });
    await expect(insert("vocab", row)).rejects.toThrow(/constraint failed/);
  });

  it("requires review instants to be both null or both set", async () => {
    await expect(insert("vocab", vocabRow({ last_reviewed_at: NOW }))).rejects.toThrow(
      /CHECK constraint failed/,
    );
    await expect(insert("vocab", vocabRow({ due_at: NOW }))).rejects.toThrow(
      /CHECK constraint failed/,
    );
    await insert(
      "vocab",
      vocabRow({ ladder_step: 1, last_reviewed_at: NOW, due_at: "2026-09-15T00:08:07.000Z" }),
    );
    expect(await count("vocab")).toBe(1);
  });
});

describe("review_events", () => {
  it("requires an existing vocab row", async () => {
    await expect(insert("review_events", eventRow(ulid()))).rejects.toThrow(/FOREIGN KEY/);
  });

  it.each([
    ["grade", "right"],
    ["direction", "ur_ur"],
    ["source", "airtable"],
    ["step_before", -1],
    ["interval_after", -1],
    ["ladder_id", 0],
    ["prompt_support", "coached"],
  ])("rejects %s = %j", async (column, value) => {
    const vocab = vocabRow();
    await insert("vocab", vocab);
    await expect(
      insert("review_events", eventRow(String(vocab.id), { [column]: value })),
    ).rejects.toThrow(/constraint failed/);
  });

  it("are deleted with their vocab row (Q2 cascade)", async () => {
    const keep = vocabRow();
    const drop = vocabRow();
    await insert("vocab", keep);
    await insert("vocab", drop);
    await insert("review_events", eventRow(String(keep.id)));
    await insert("review_events", eventRow(String(drop.id)));
    await insert("review_events", eventRow(String(drop.id), { source: "coach", handoff_id: "h1" }));

    await env.DB.prepare("DELETE FROM vocab WHERE id = ?").bind(drop.id).run();

    const { results } = await env.DB.prepare("SELECT vocab_id FROM review_events").all();
    expect(results).toEqual([{ vocab_id: keep.id }]);
  });
});

describe("handoffs, tags, sessions", () => {
  it("handoffs require a unique id and JSON payload/outcome", async () => {
    const handoff = { id: "h1", imported_at: NOW, payload: '{"results":[]}', status: "applied" };
    await insert("handoffs", handoff);
    await expect(insert("handoffs", handoff)).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(insert("handoffs", { ...handoff, id: "h2", payload: "nope" })).rejects.toThrow(
      /CHECK constraint failed/,
    );
    await expect(insert("handoffs", { ...handoff, id: "h3", outcome: "{bad" })).rejects.toThrow(
      /CHECK constraint failed/,
    );
  });

  it("tags are unique by non-empty name", async () => {
    await insert("tags", { name: "food" });
    await expect(insert("tags", { name: "food" })).rejects.toThrow(/UNIQUE constraint failed/);
    await expect(insert("tags", { name: "" })).rejects.toThrow(/CHECK constraint failed/);
  });

  it("sessions store a unique 64-char token hash", async () => {
    const session = {
      id: ulid(),
      token_hash: "a".repeat(64),
      created_at: NOW,
      last_seen_at: NOW,
    };
    await insert("sessions", session);
    await expect(insert("sessions", { ...session, id: ulid() })).rejects.toThrow(
      /UNIQUE constraint failed: sessions\.token_hash/,
    );
    await expect(
      insert("sessions", { ...session, id: ulid(), token_hash: "short" }),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});
