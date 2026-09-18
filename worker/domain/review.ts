// Review service (FR-A4). The one place a tracked review changes an item's schedule: PWA reviews
// call it with source "pwa"; f06's POST /coach/reviews calls it with source "coach" and a
// handoff id. The arithmetic is shared/ladders.ts scheduleReview.

import type {
  PromptSupport,
  ReviewDirection,
  ReviewEvent,
  ReviewSource,
  VocabItem,
} from "../../shared/api";
import { scheduleReview } from "../../shared/ladders";
import type { Grade } from "../../shared/mastery";
import { ulid } from "../../shared/ulid";
import { getVocab } from "./vocab";

export type ReviewInput = {
  grade: Grade;
  direction: ReviewDirection;
  source: ReviewSource;
  handoffId?: string | null;
  promptSupport?: PromptSupport;
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
  activeLadderId: number,
): Promise<ReviewResult> {
  const current = await getVocab(db, id);
  if (!current) return { ok: false, error: "not_found" };
  return applyReview(db, current, input, now, activeLadderId);
}

// Applies a review to a row as it was read. The event insert and the vocab update are one
// batch (one transaction), and both are conditioned on the row's rung and updated_at
// still matching `current`, so a concurrent write makes both no-ops instead of the review
// being applied on top of a value it never saw.
export async function applyReview(
  db: D1Database,
  current: VocabItem,
  input: ReviewInput,
  now: Date,
  activeLadderId: number,
): Promise<ReviewResult> {
  const at = now.toISOString();
  const next = scheduleReview(current, input.grade, input.direction, activeLadderId, at);
  const item: VocabItem = {
    ...current,
    ladder_id: next.ladder_id,
    ladder_step: next.ladder_step,
    interval_seconds: next.interval_seconds,
    last_reviewed_at: next.last_reviewed_at,
    due_at: next.due_at,
    updated_at: at,
  };
  const event: ReviewEvent = {
    id: ulid(now.getTime()),
    vocab_id: current.id,
    reviewed_at: at,
    grade: input.grade,
    direction: input.direction,
    source: input.source,
    handoff_id: input.handoffId ?? null,
    prompt_support: input.promptSupport ?? "none",
    applied_delta: next.applied_delta,
    ladder_before_id: current.ladder_id,
    step_before: current.ladder_step,
    interval_before: current.interval_seconds,
    due_before: current.due_at,
    ladder_id: next.ladder_id,
    step_after: next.ladder_step,
    interval_after: next.interval_seconds,
    due_after: next.due_at,
  };

  const unchanged = "id = ? AND ladder_id = ? AND ladder_step = ? AND updated_at = ?";
  const guard = [current.id, current.ladder_id, current.ladder_step, current.updated_at];

  const [, update] = await db.batch([
    db
      .prepare(
        `INSERT INTO review_events (id, vocab_id, reviewed_at, grade, direction, source,
           handoff_id, prompt_support, applied_delta, ladder_before_id, step_before,
           interval_before, due_before, ladder_id, step_after, interval_after, due_after)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM vocab WHERE ${unchanged})`,
      )
      .bind(
        event.id,
        event.vocab_id,
        event.reviewed_at,
        event.grade,
        event.direction,
        event.source,
        event.handoff_id,
        event.prompt_support,
        event.applied_delta,
        event.ladder_before_id,
        event.step_before,
        event.interval_before,
        event.due_before,
        event.ladder_id,
        event.step_after,
        event.interval_after,
        event.due_after,
        ...guard,
      ),
    db
      .prepare(
        `UPDATE vocab SET ladder_id = ?, ladder_step = ?, interval_seconds = ?,
           last_reviewed_at = ?, due_at = ?, updated_at = ?
         WHERE ${unchanged}`,
      )
      .bind(
        item.ladder_id,
        item.ladder_step,
        item.interval_seconds,
        item.last_reviewed_at,
        item.due_at,
        item.updated_at,
        ...guard,
      ),
  ]);

  if (!update || update.meta.changes === 0) {
    // Deleted in between reads as not found; anything else is a stale read.
    return (await getVocab(db, current.id))
      ? { ok: false, error: "stale" }
      : { ok: false, error: "not_found" };
  }
  return { ok: true, item, event };
}
