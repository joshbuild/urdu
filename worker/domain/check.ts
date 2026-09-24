// Accuracy check (f11, FR-F9). The chat proposes corrections to existing items; this code decides.
// Copy check prompt records the batch it lists, so the corrections paste is judged against the
// items the prompt actually carried, even if the PWA was discarded in between.

import { type CheckBatchResponse, MAX_CHECK_BATCH } from "../../shared/api";
import { ulid } from "../../shared/ulid";
import { toItem, type VocabRow } from "./vocab";

// Rotation through the whole vault: never checked first, then the longest since a check.
const CHECK_ORDER = "checked_at ASC NULLS FIRST, added_at ASC, id ASC";

// Every call records a new `check_issued` batch; one never pasted back is a harmless row. The
// outcome stays null until the corrections are applied. An empty vault records nothing.
export async function issueCheckBatch(db: D1Database, now: Date): Promise<CheckBatchResponse> {
  const [rows, count] = await db.batch([
    db.prepare(`SELECT * FROM vocab ORDER BY ${CHECK_ORDER} LIMIT ?`).bind(MAX_CHECK_BATCH),
    db.prepare("SELECT count(*) AS n FROM vocab WHERE checked_at IS NULL"),
  ]);
  const items = ((rows?.results ?? []) as VocabRow[]).map(toItem);
  const never_checked = (count?.results[0] as { n: number } | undefined)?.n ?? 0;
  if (items.length === 0) return { handoff_id: null, items, never_checked };

  const handoff_id = ulid(now.getTime());
  await db
    .prepare(
      "INSERT INTO handoffs (id, imported_at, payload, status, outcome) VALUES (?, ?, ?, 'check_issued', NULL)",
    )
    .bind(handoff_id, now.toISOString(), JSON.stringify({ vocab_ids: items.map((i) => i.id) }))
    .run();
  return { handoff_id, items, never_checked };
}
