// Vault settings (f09). One row per key in the settings table; today only the active ladder.

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
