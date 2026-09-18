// Review service (FR-A4). The one place a tracked review changes mastery: PWA reviews call it
// with source "pwa"; f06's POST /coach/reviews calls it with source "coach" and a handoff id.

import type { ReviewDirection, ReviewEvent, ReviewSource, VocabItem } from "../../shared/api";
import { nextReviewOn } from "../../shared/dates";
import { applyGrade, type Grade } from "../../shared/mastery";
import { ulid } from "../../shared/ulid";
import { getVocab } from "./vocab";

export type ReviewInput = {
  grade: Grade;
  direction: ReviewDirection;
  source: ReviewSource;
  handoffId?: string | null;
};

export type ReviewResult =
  | { ok: true; item: VocabItem; event: ReviewEvent }
  | { ok: false; error: "not_found" }
  // The row changed between read and write; nothing was written.
  | { ok: false; error: "stale" };

export async function recordReview(
  db: D1Database,
  id: string,
  input: ReviewInput,
  now: Date,
  today: string,
): Promise<ReviewResult> {
  const current = await getVocab(db, id);
  if (!current) return { ok: false, error: "not_found" };
  return applyReview(db, current, input, now, today);
}

// Applies a review to a row as it was read. The event insert and the vocab update are one
// batch (one transaction), and both are conditioned on the row's mastery and updated_at
// still matching `current`, so a concurrent write makes both no-ops instead of the review
// being applied on top of a value it never saw.
export async function applyReview(
  db: D1Database,
  current: VocabItem,
  input: ReviewInput,
  now: Date,
  today: string,
): Promise<ReviewResult> {
  const at = now.toISOString();
  const mastery = applyGrade(current.mastery, input.grade, input.direction);
  const item: VocabItem = {
    ...current,
    mastery,
    last_reviewed_on: today,
    next_review_on: nextReviewOn(today, mastery),
    updated_at: at,
  };
  const event: ReviewEvent = {
    id: ulid(now.getTime()),
    vocab_id: current.id,
    reviewed_at: at,
    grade: input.grade,
    mastery_before: current.mastery,
    mastery_after: mastery,
    direction: input.direction,
    source: input.source,
    handoff_id: input.handoffId ?? null,
  };

  const unchanged = "id = ? AND mastery = ? AND updated_at = ?";
  const guard = [current.id, current.mastery, current.updated_at];

  const [, update] = await db.batch([
    db
      .prepare(
        `INSERT INTO review_events (id, vocab_id, reviewed_at, grade, mastery_before,
           mastery_after, direction, source, handoff_id)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM vocab WHERE ${unchanged})`,
      )
      .bind(
        event.id,
        event.vocab_id,
        event.reviewed_at,
        event.grade,
        event.mastery_before,
        event.mastery_after,
        event.direction,
        event.source,
        event.handoff_id,
        ...guard,
      ),
    db
      .prepare(
        `UPDATE vocab SET mastery = ?, last_reviewed_on = ?, next_review_on = ?, updated_at = ?
         WHERE ${unchanged}`,
      )
      .bind(item.mastery, item.last_reviewed_on, item.next_review_on, item.updated_at, ...guard),
  ]);

  if (!update || update.meta.changes === 0) {
    // Deleted in between reads as not found; anything else is a stale read.
    return (await getVocab(db, current.id))
      ? { ok: false, error: "stale" }
      : { ok: false, error: "not_found" };
  }
  return { ok: true, item, event };
}
