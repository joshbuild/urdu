// Vocab intake (f17, PRD FR-K). Queued items (released_at null) wait in the vault; the release
// rules here move them into review. Release sets released_at and nothing else: it is not an edit,
// so updated_at stays put and no review or check apply sees the item as stale.
//
// - Top-up: once per HOME_TZ day, the queue tops the new pile (released, never reviewed) up to the
//   batch size, first in first out. Lazy: the first qualifying read of the day runs it.
// - Intake: releases the next batch on demand, ignoring the day's claim.
// - Release one: a single queued item, from the Vocab tab.

import type { IntakeCounts, VocabItem } from "../../shared/api";
import { todayIn } from "../../shared/dates";
import { ulid } from "../../shared/ulid";
import { getVocab } from "./vocab";

export const DEFAULT_BATCH_SIZE = 10;
export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 50;

const QUEUED = "released_at IS NULL";
const NEW_PILE = "released_at IS NOT NULL AND last_reviewed_at IS NULL";
const QUEUE_ORDER = "added_at ASC, id ASC";

export function isBatchSize(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= MIN_BATCH_SIZE &&
    (value as number) <= MAX_BATCH_SIZE
  );
}

export async function intakeBatchSize(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'intake_batch_size'")
    .first<{ value: string }>();
  const n = Number(row?.value);
  return isBatchSize(n) ? n : DEFAULT_BATCH_SIZE;
}

// Applies from the next top-up or Intake; releases and hides nothing now.
export async function setIntakeBatchSize(db: D1Database, n: number): Promise<void> {
  if (!isBatchSize(n)) throw new RangeError(`Batch size ${n} is out of range`);
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('intake_batch_size', ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    )
    .bind(String(n))
    .run();
}

// The day's top-up. Returns how many items it released (0 when today's has already run).
//
// The claim is `<today>:<ulid>`, written only where the stored date is before today (or absent).
// The release runs in the same batch (one transaction), guarded on the stored claim equalling this
// call's, so of two concurrent first calls only the one whose claim landed releases anything.
export async function topUpIntake(db: D1Database, now: Date, timeZone: string): Promise<number> {
  const today = todayIn(timeZone, now);
  const stored = await db
    .prepare("SELECT value FROM settings WHERE key = 'intake_topup'")
    .first<{ value: string }>();
  // Most reads of the day stop here, with no write.
  if (stored && stored.value.slice(0, 10) >= today) return 0;
  return claimAndRelease(db, now, today);
}

// The write half of topUpIntake, exported so tests can reach the claim guard past the pre-check.
export async function claimAndRelease(db: D1Database, now: Date, today: string): Promise<number> {
  const claim = `${today}:${ulid(now.getTime())}`;
  const batchSize = await intakeBatchSize(db);
  const [, release] = await db.batch([
    db
      .prepare(
        `INSERT INTO settings (key, value) VALUES ('intake_topup', ?1)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value
         WHERE substr(settings.value, 1, 10) < substr(excluded.value, 1, 10)`,
      )
      .bind(claim),
    // max(0, …): a negative LIMIT means no limit in SQLite.
    db
      .prepare(
        `UPDATE vocab SET released_at = ?1
         WHERE id IN (
           SELECT id FROM vocab WHERE ${QUEUED} ORDER BY ${QUEUE_ORDER}
           LIMIT max(0, ?2 - (SELECT count(*) FROM vocab WHERE ${NEW_PILE}))
         )
         AND (SELECT value FROM settings WHERE key = 'intake_topup') = ?3`,
      )
      .bind(now.toISOString(), batchSize, claim),
  ]);
  return release?.meta.changes ?? 0;
}

// The top-up runs before a read; a failure is logged and the read still answers.
export async function safeTopUp(db: D1Database, now: Date, timeZone: string): Promise<void> {
  try {
    await topUpIntake(db, now, timeZone);
  } catch (err) {
    console.error("intake top-up failed", err);
  }
}

// Intake: the next `count` queued items, first in first out.
export async function releaseNext(
  db: D1Database,
  count: number,
  now: Date,
): Promise<{ released: number; queued: number }> {
  const [release, left] = await db.batch([
    db
      .prepare(
        `UPDATE vocab SET released_at = ?1
         WHERE id IN (SELECT id FROM vocab WHERE ${QUEUED} ORDER BY ${QUEUE_ORDER} LIMIT ?2)`,
      )
      .bind(now.toISOString(), count),
    db.prepare(`SELECT count(*) AS n FROM vocab WHERE ${QUEUED}`),
  ]);
  return {
    released: release?.meta.changes ?? 0,
    queued: (left?.results[0] as { n: number } | undefined)?.n ?? 0,
  };
}

// Release now: a no-op on an item already released; null when the id is unknown.
export async function releaseOne(db: D1Database, id: string, now: Date): Promise<VocabItem | null> {
  await db
    .prepare(`UPDATE vocab SET released_at = ? WHERE id = ? AND ${QUEUED}`)
    .bind(now.toISOString(), id)
    .run();
  return getVocab(db, id);
}

export async function intakeCounts(db: D1Database): Promise<IntakeCounts> {
  const [row, batch_size] = await Promise.all([
    db
      .prepare(
        `SELECT count(*) FILTER (WHERE ${QUEUED}) AS queued,
           count(*) FILTER (WHERE ${NEW_PILE}) AS new FROM vocab`,
      )
      .first<{ queued: number; new: number }>(),
    intakeBatchSize(db),
  ]);
  return { queued: row?.queued ?? 0, new: row?.new ?? 0, batch_size };
}
