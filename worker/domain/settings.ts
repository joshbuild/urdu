// Vault settings (f09). One row per key in the settings table: the active ladder, and the Next
// batch size (f18).

import { DEFAULT_NEXT_BATCH_SIZE, isNextBatchSize } from "../../shared/coverage";
import { DEFAULT_LADDER_ID, isSelectableLadderId } from "../../shared/ladders";

export async function activeLadderId(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'active_ladder_id'")
    .first<{ value: string }>();
  const id = Number(row?.value);
  return isSelectableLadderId(id) ? id : DEFAULT_LADDER_ID;
}

// Rewrites no schedule: items on the old ladder move to the new one at their next review.
export async function setActiveLadderId(db: D1Database, id: number): Promise<void> {
  if (!isSelectableLadderId(id)) throw new RangeError(`Ladder ${id} is not selectable`);
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('active_ladder_id', ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    )
    .bind(String(id))
    .run();
}

// f18: how many words one Next batch asks for in all.
export async function nextBatchSize(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = 'next_batch_size'")
    .first<{ value: string }>();
  const n = Number(row?.value);
  return isNextBatchSize(n) ? n : DEFAULT_NEXT_BATCH_SIZE;
}

// Applies from the next batch; a batch already issued keeps its cells.
export async function setNextBatchSize(db: D1Database, n: number): Promise<void> {
  if (!isNextBatchSize(n)) throw new RangeError(`Next batch size ${n} is out of range`);
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('next_batch_size', ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    )
    .bind(String(n))
    .run();
}
