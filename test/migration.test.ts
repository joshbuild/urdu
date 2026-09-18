// 0001 → 0002 on a scratch D1 holding legacy rows (f09): the ladder migration must keep every
// row and event, put them on the legacy ladder, and leave due times where they were.
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
    "vocab_new",
    "handoffs",
    "tags",
    "sessions",
    "settings",
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
