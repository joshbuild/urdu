// The Dash read (f16, FR-J). Two full-table reads, then shared/dash.ts derives every block: the
// derivations stay pure and tested in shared/, and the scan is cheap at a personal vault's size
// (f16 Decisions). Read-only: nothing is written, and no schedule moves.

import type { DashResponse } from "../../shared/api";
import { buildDash, type DashEvent, type DashVocab } from "../../shared/dash";
import { activeLadderId } from "./settings";

export async function readDash(db: D1Database, now: Date, timeZone: string): Promise<DashResponse> {
  const [vocab, events] = await db.batch([
    db.prepare(
      `SELECT id, urdu, english, added_at, released_at, interval_seconds, last_reviewed_at, due_at
         FROM vocab`,
    ),
    db.prepare(
      `SELECT vocab_id, reviewed_at, grade, direction, prompt_support, interval_before, due_before,
         interval_after FROM review_events`,
    ),
  ]);
  const dash = buildDash(
    (vocab?.results ?? []) as DashVocab[],
    (events?.results ?? []) as DashEvent[],
    now,
    timeZone,
  );
  return { ...dash, active_ladder_id: await activeLadderId(db), generated_at: now.toISOString() };
}
