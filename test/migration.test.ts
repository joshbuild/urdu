// Migrations on a scratch D1 holding rows. 0001 → 0002 (f09): the ladder migration must keep
// every row and event, put them on the legacy ladder, and leave due times where they were.
// 0003 → 0004 (f11): checked_at arrives null on every row, the rows otherwise untouched.
// 0004 → 0005 (f12): the setting moves to its day-anchored successor and untouched new items to
// its entry rung; nothing else changes.
// 0005 → 0006 (f13): filled_at arrives null on every row, the rows otherwise untouched.
// 0006 → 0007 (f17): every existing row is released at its added_at and unlinked; nothing is
// queued.
// 0007 → 0008 (f18): topic and cefr arrive null on every row, the rows otherwise untouched.
import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

const db = env.MIGRATION_DB;
const DAY = 86_400;
const NOW = "2026-09-14T17:00:00.000Z";

function migration(prefix: string) {
  const found = env.TEST_MIGRATIONS.find((m) => m.name.startsWith(prefix));
  if (!found) throw new Error(`no migration ${prefix}`);
  return found;
}

async function apply(prefix: string) {
  await db.batch(migration(prefix).queries.map((q) => db.prepare(q)));
}

beforeEach(async () => {
  // Children first, so no drop cascades into a table still to be checked.
  const tables = [
    "review_events",
    "review_events_new",
    "vocab",
    "harvests",
    "sources",
    "vocab_new",
    "handoffs",
    "tags",
    "sessions",
    "settings",
    "voice_sessions",
  ];
  await db.batch(tables.map((t) => db.prepare(`DROP TABLE IF EXISTS ${t}`)));
  await apply("0001");
});

type Legacy = { id: string; mastery: number; last: string | null; next: string | null };

const ROWS: Legacy[] = [
  { id: "01J00000000000000000000001", mastery: 0, last: null, next: null },
  { id: "01J00000000000000000000002", mastery: 0, last: "2026-09-10", next: "2026-09-10" },
  { id: "01J00000000000000000000003", mastery: 3, last: "2026-09-08", next: "2026-10-03" },
  { id: "01J00000000000000000000004", mastery: 6, last: "2026-01-01", next: "2034-07-24" },
];

async function seed() {
  await db.batch([
    ...ROWS.map((r, i) =>
      db
        .prepare(
          `INSERT INTO vocab (id, urdu, urdu_key, kind, mastery, added_at, last_reviewed_on,
             next_review_on, source, created_at, updated_at)
           VALUES (?, ?, ?, 'word', ?, ?, ?, ?, 'airtable', ?, ?)`,
        )
        .bind(r.id, `w${i}`, `w${i}`, r.mastery, NOW, r.last, r.next, NOW, NOW),
    ),
    db
      .prepare(
        `INSERT INTO review_events (id, vocab_id, reviewed_at, grade, mastery_before, mastery_after,
           direction, source, handoff_id)
         VALUES ('01J0000000000000000000000A', ?, ?, 'correct', 2, 3, 'ur_en', 'pwa', NULL),
                ('01J0000000000000000000000B', ?, ?, 'confident', 5, 6, 'en_ur', 'coach', 'h1')`,
      )
      .bind(ROWS[2]?.id, NOW, ROWS[3]?.id, NOW),
  ]);
}

const LEGACY_DAYS = [0, 1, 5, 25, 125, 625, 3125];

describe("migration 0002_srs_ladder", () => {
  it("moves every row onto the legacy ladder with due times unchanged", async () => {
    await seed();
    await apply("0002");

    const { results } = await db
      .prepare(
        "SELECT id, ladder_id, ladder_step, interval_seconds, last_reviewed_at, due_at FROM vocab ORDER BY id",
      )
      .all();
    expect(results).toEqual(
      ROWS.map((r) => ({
        id: r.id,
        ladder_id: 1,
        ladder_step: r.mastery,
        interval_seconds: (LEGACY_DAYS[r.mastery] as number) * DAY,
        last_reviewed_at: r.last === null ? null : `${r.last}T08:00:00.000Z`,
        due_at: r.next === null ? null : `${r.next}T08:00:00.000Z`,
      })),
    );

    const columns = (await db.prepare("PRAGMA table_info(vocab)").all<{ name: string }>()).results;
    const names = columns.map((c) => c.name);
    for (const gone of ["mastery", "last_reviewed_on", "next_review_on"]) {
      expect(names).not.toContain(gone);
    }
  });

  it("migrates review events with legacy steps and intervals, and unknowns as null", async () => {
    await seed();
    await apply("0002");

    const { results } = await db.prepare("SELECT * FROM review_events ORDER BY id").all();
    expect(results).toEqual([
      {
        id: "01J0000000000000000000000A",
        vocab_id: ROWS[2]?.id,
        reviewed_at: NOW,
        grade: "correct",
        direction: "ur_en",
        source: "pwa",
        handoff_id: null,
        prompt_support: "none",
        applied_delta: null,
        ladder_before_id: 1,
        step_before: 2,
        interval_before: 5 * DAY,
        due_before: null,
        ladder_id: 1,
        step_after: 3,
        interval_after: 25 * DAY,
        due_after: null,
      },
      {
        id: "01J0000000000000000000000B",
        vocab_id: ROWS[3]?.id,
        reviewed_at: NOW,
        grade: "confident",
        direction: "en_ur",
        source: "coach",
        handoff_id: "h1",
        prompt_support: "none",
        applied_delta: null,
        ladder_before_id: 1,
        step_before: 5,
        interval_before: 625 * DAY,
        due_before: null,
        ladder_id: 1,
        step_after: 6,
        interval_after: 3125 * DAY,
        due_after: null,
      },
    ]);
  });

  it("keeps the cascade from vocab to review events, and seeds the Moderate setting", async () => {
    await seed();
    await apply("0002");

    await db.prepare("DELETE FROM vocab WHERE id = ?").bind(ROWS[3]?.id).run();
    const { results } = await db.prepare("SELECT id FROM review_events").all();
    expect(results).toEqual([{ id: "01J0000000000000000000000A" }]);

    const setting = await db
      .prepare("SELECT value FROM settings WHERE key = 'active_ladder_id'")
      .first();
    expect(setting).toEqual({ value: "3" });

    const leftovers = await db
      .prepare("SELECT name FROM sqlite_master WHERE name LIKE '%\\_new' ESCAPE '\\'")
      .all();
    expect(leftovers.results).toEqual([]);
  });

  it("migrates an empty vault", async () => {
    await apply("0002");
    const row = await db.prepare("SELECT count(*) AS n FROM vocab").first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});

describe("migration 0004_vocab_check", () => {
  const IDS = ["01J00000000000000000000001", "01J00000000000000000000002"];

  it("adds checked_at as null on every row, keeps the rows, and indexes the rotation", async () => {
    await apply("0002");
    await apply("0003");
    await db.batch(
      IDS.map((id, i) =>
        db
          .prepare(
            `INSERT INTO vocab (id, urdu, urdu_key, kind, english, ladder_id, ladder_step,
               interval_seconds, added_at, last_reviewed_at, due_at, source, created_at, updated_at)
             VALUES (?, ?, ?, 'word', 'x', 3, 2, 25000, ?, ?, ?, 'manual', ?, ?)`,
          )
          .bind(id, `w${i}`, `w${i}`, NOW, NOW, NOW, NOW, NOW),
      ),
    );
    const before = (await db.prepare("SELECT * FROM vocab ORDER BY id").all()).results;

    await apply("0004");

    const after = (await db.prepare("SELECT * FROM vocab ORDER BY id").all()).results;
    expect(after).toEqual(before.map((row) => ({ ...row, checked_at: null })));

    const index = await db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'vocab_check'")
      .first<{ sql: string }>();
    expect(index?.sql).toContain("(checked_at, added_at)");
  });
});

describe("migration 0005_day_anchored_ladders", () => {
  const T = "2026-09-20T10:00:00.000Z";
  // [id, ladder_id, ladder_step, interval_seconds, last_reviewed_at, due_at]
  type Row = [string, number, number, number, string | null, string | null];
  const ROWS5: Row[] = [
    ["01J00000000000000000000001", 3, 0, 10800, null, null], // new on Moderate v1: moves
    ["01J00000000000000000000002", 1, 0, 0, null, null], // legacy level-0 import: moves
    ["01J00000000000000000000003", 3, 0, 10800, T, T], // reviewed, missed: stays
    ["01J00000000000000000000004", 3, 4, 345600, null, null], // new, rung set by hand: stays
    ["01J00000000000000000000005", 1, 3, 25 * DAY, T, T], // reviewed legacy: stays
  ];

  async function seed5(active: string) {
    await apply("0002");
    await apply("0003");
    await apply("0004");
    await db.batch([
      db.prepare("UPDATE settings SET value = ? WHERE key = 'active_ladder_id'").bind(active),
      ...ROWS5.map(([id, ladderId, step, interval, last, due], i) =>
        db
          .prepare(
            `INSERT INTO vocab (id, urdu, urdu_key, kind, ladder_id, ladder_step, interval_seconds,
               added_at, last_reviewed_at, due_at, source, created_at, updated_at)
             VALUES (?, ?, ?, 'word', ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
          )
          .bind(id, `w${i}`, `w${i}`, ladderId, step, interval, NOW, last, due, NOW, NOW),
      ),
    ]);
    return (await db.prepare("SELECT * FROM vocab ORDER BY id").all()).results;
  }

  async function active() {
    return (
      await db.prepare("SELECT value FROM settings WHERE key = 'active_ladder_id'").first<{
        value: string;
      }>()
    )?.value;
  }

  it.each([
    ["2", "7"],
    ["3", "8"],
    ["4", "9"],
    ["5", "10"],
    ["6", "11"],
  ])("maps retired setting %s to its successor %s", async (from, to) => {
    await seed5(from);
    await apply("0005");
    expect(await active()).toBe(to);
  });

  it("moves only untouched new items, to the active ladder's entry rung", async () => {
    const before = await seed5("5");
    await apply("0005");
    const after = (await db.prepare("SELECT * FROM vocab ORDER BY id").all()).results;

    const wide = { ladder_id: 10, ladder_step: 1, interval_seconds: 25687 };
    expect(after).toEqual([
      { ...before[0], ...wide },
      { ...before[1], ...wide },
      before[2],
      before[3],
      before[4],
    ]);
  });

  it("uses Dense's entry rung for an unknown setting, and leaves the setting alone", async () => {
    const before = await seed5("99");
    await apply("0005");
    expect(await active()).toBe("99");
    const first = await db.prepare("SELECT * FROM vocab ORDER BY id").first();
    expect(first).toEqual({ ...before[0], ladder_id: 8, ladder_step: 2, interval_seconds: 36327 });
  });
});

describe("migration 0006_vocab_fill", () => {
  it("adds filled_at as null on every row, keeps the rows, and indexes the rotation", async () => {
    for (const prefix of ["0002", "0003", "0004", "0005"]) await apply(prefix);
    await db.batch(
      ["01J00000000000000000000001", "01J00000000000000000000002"].map((id, i) =>
        db
          .prepare(
            `INSERT INTO vocab (id, urdu, urdu_key, kind, english, ladder_id, ladder_step,
               interval_seconds, added_at, last_reviewed_at, due_at, source, checked_at,
               created_at, updated_at)
             VALUES (?, ?, ?, 'word', 'x', 8, 2, 36327, ?, ?, ?, 'manual', ?, ?, ?)`,
          )
          .bind(id, `w${i}`, `w${i}`, NOW, NOW, NOW, i === 0 ? NOW : null, NOW, NOW),
      ),
    );
    const before = (await db.prepare("SELECT * FROM vocab ORDER BY id").all()).results;

    await apply("0006");

    const after = (await db.prepare("SELECT * FROM vocab ORDER BY id").all()).results;
    expect(after).toEqual(before.map((row) => ({ ...row, filled_at: null })));
    const index = await db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'vocab_fill'")
      .first<{ sql: string }>();
    expect(index?.sql).toContain("(filled_at, added_at)");
  });
});

describe("migration 0007_vocab_intake", () => {
  it("releases every existing row at its added_at, links none, and adds the tables", async () => {
    for (const prefix of ["0002", "0003", "0004", "0005", "0006"]) await apply(prefix);
    const added = ["2026-08-01T09:00:00.000Z", "2026-09-01T09:00:00.000Z"];
    await db.batch(
      ["01J00000000000000000000001", "01J00000000000000000000002"].map((id, i) =>
        db
          .prepare(
            `INSERT INTO vocab (id, urdu, urdu_key, kind, ladder_id, ladder_step,
               interval_seconds, added_at, last_reviewed_at, due_at, source, created_at, updated_at)
             VALUES (?, ?, ?, 'word', 8, 2, 36327, ?, ?, ?, 'manual', ?, ?)`,
          )
          .bind(
            id,
            `w${i}`,
            `w${i}`,
            added[i],
            i === 0 ? NOW : null,
            i === 0 ? NOW : null,
            NOW,
            NOW,
          ),
      ),
    );
    const before = (await db.prepare("SELECT * FROM vocab ORDER BY id").all()).results;

    await apply("0007");

    const after = (await db.prepare("SELECT * FROM vocab ORDER BY id").all()).results;
    expect(after).toEqual(
      before.map((row, i) => ({ ...row, harvest_id: null, released_at: added[i] })),
    );
    const queued = await db
      .prepare("SELECT count(*) AS n FROM vocab WHERE released_at IS NULL")
      .first<{ n: number }>();
    expect(queued?.n).toBe(0);
    const names = (
      await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name IN ('sources', 'harvests', 'sources_url', 'vocab_queue') ORDER BY name",
        )
        .all<{ name: string }>()
    ).results.map((r) => r.name);
    expect(names).toEqual(["harvests", "sources", "sources_url", "vocab_queue"]);
  });

  it("refuses a second source with the same URL", async () => {
    for (const prefix of ["0002", "0003", "0004", "0005", "0006", "0007"]) await apply(prefix);
    const insert = (id: string) =>
      db
        .prepare(
          "INSERT INTO sources (id, name, url, created_at, updated_at) VALUES (?, 'a', 'https://x.test/s', ?, ?)",
        )
        .bind(id, NOW, NOW)
        .run();
    await insert("01J00000000000000000000001");
    await expect(insert("01J00000000000000000000002")).rejects.toThrow(/UNIQUE/);
  });
});

describe("migration 0008_topic_coverage", () => {
  it("adds topic and cefr as null on every row, keeps the rows, and indexes them", async () => {
    for (const prefix of ["0002", "0003", "0004", "0005", "0006", "0007"]) await apply(prefix);
    await db
      .prepare(
        `INSERT INTO vocab (id, urdu, urdu_key, kind, tags, ladder_id, ladder_step,
           interval_seconds, added_at, source, released_at, created_at, updated_at)
         VALUES ('01J00000000000000000000001', 'w', 'w', 'word', '["objects"]', 8, 2, 36327, ?,
           'manual', ?, ?, ?)`,
      )
      .bind(NOW, NOW, NOW, NOW)
      .run();
    const before = (await db.prepare("SELECT * FROM vocab").all()).results;

    await apply("0008");

    const after = (await db.prepare("SELECT * FROM vocab").all()).results;
    expect(after).toEqual(before.map((row) => ({ ...row, topic: null, cefr: null })));
    const index = await db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'vocab_topic'")
      .first<{ name: string }>();
    expect(index?.name).toBe("vocab_topic");
  });

  it("refuses a level outside A1–C2 and an empty topic", async () => {
    for (const prefix of ["0002", "0003", "0004", "0005", "0006", "0007", "0008"]) {
      await apply(prefix);
    }
    const insert = (topic: string | null, cefr: string | null) =>
      db
        .prepare(
          `INSERT INTO vocab (id, urdu, urdu_key, kind, ladder_id, ladder_step, interval_seconds,
             added_at, source, created_at, updated_at, topic, cefr)
           VALUES ('01J00000000000000000000001', 'w', 'w', 'word', 8, 2, 36327, ?, 'manual', ?, ?,
             ?, ?)`,
        )
        .bind(NOW, NOW, NOW, topic, cefr)
        .run();
    await expect(insert("food", "A2+")).rejects.toThrow(/CHECK/);
    await expect(insert("", "A1")).rejects.toThrow(/CHECK/);
    await insert("food", "B2");
  });
});
