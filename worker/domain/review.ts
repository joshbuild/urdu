// Review service (FR-A4). The one place a tracked review changes an item's schedule: PWA reviews
// call it with source "pwa"; the f07 voice Coach's record_review calls it with source "coach", the
// voice session id as handoff id, and its prompt support. The arithmetic is shared/ladders.ts
// scheduleReview.

import type {
  PromptSupport,
  ReviewDirection,
  ReviewEvent,
  ReviewSource,
  VocabItem,
} from "../../shared/api";
import { scheduleReview } from "../../shared/ladders";
import { GRADES, type Grade } from "../../shared/mastery";
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

// Replace a PWA grade on the most recent review of this item. The original event keeps its
// identity and review instant; its before-state remains the source for the new schedule.
export async function amendReview(
  db: D1Database,
  eventId: string,
  grade: Grade,
): Promise<ReviewResult | { ok: false; error: "invalid" }> {
  if (!GRADES.includes(grade)) return { ok: false, error: "invalid" };
  const event = await db
    .prepare("SELECT * FROM review_events WHERE id = ?")
    .bind(eventId)
    .first<ReviewEvent>();
  if (event?.source !== "pwa" || event.prompt_support !== "none") {
    return { ok: false, error: "not_found" };
  }
  const current = await getVocab(db, event.vocab_id);
  if (!current) return { ok: false, error: "not_found" };
  const newer = await db
    .prepare(
      "SELECT id FROM review_events WHERE vocab_id = ? AND id <> ? AND reviewed_at >= ? LIMIT 1",
    )
    .bind(event.vocab_id, event.id, event.reviewed_at)
    .first();
  if (
    newer ||
    current.updated_at !== event.reviewed_at ||
    current.last_reviewed_at !== event.reviewed_at ||
    current.ladder_id !== event.ladder_id ||
    current.ladder_step !== event.step_after ||
    current.interval_seconds !== event.interval_after ||
    current.due_at !== event.due_after
  )
    return { ok: false, error: "stale" };
  if (grade === event.grade) return { ok: true, item: current, event };

  const before: VocabItem = {
    ...current,
    ladder_id: event.ladder_before_id,
    ladder_step: event.step_before,
    interval_seconds: event.interval_before,
    due_at: event.due_before,
    last_reviewed_at:
      event.due_before === null
        ? null
        : new Date(Date.parse(event.due_before) - event.interval_before * 1000).toISOString(),
  };
  const next = scheduleReview(before, grade, event.direction, event.ladder_id, event.reviewed_at);
  const updatedEvent: ReviewEvent = {
    ...event,
    grade,
    applied_delta: next.applied_delta,
    ladder_id: next.ladder_id,
    step_after: next.ladder_step,
    interval_after: next.interval_seconds,
    due_after: next.due_at,
  };
  const guard = `id = ? AND updated_at = ? AND last_reviewed_at = ?
    AND ladder_id = ? AND ladder_step = ? AND interval_seconds = ? AND due_at = ?
    AND NOT EXISTS (SELECT 1 FROM review_events WHERE vocab_id = ? AND id <> ? AND reviewed_at >= ?)`;
  const binds = [
    current.id,
    current.updated_at,
    current.last_reviewed_at,
    current.ladder_id,
    current.ladder_step,
    current.interval_seconds,
    current.due_at,
    event.vocab_id,
    event.id,
    event.reviewed_at,
  ];
  const [eventUpdate, itemUpdate] = await db.batch([
    db
      .prepare(`UPDATE review_events SET grade = ?, applied_delta = ?, ladder_id = ?,
      step_after = ?, interval_after = ?, due_after = ?
      WHERE id = ? AND grade = ? AND EXISTS (SELECT 1 FROM vocab WHERE ${guard})`)
      .bind(
        grade,
        next.applied_delta,
        next.ladder_id,
        next.ladder_step,
        next.interval_seconds,
        next.due_at,
        event.id,
        event.grade,
        ...binds,
      ),
    db
      .prepare(`UPDATE vocab SET ladder_id = ?, ladder_step = ?, interval_seconds = ?,
      due_at = ? WHERE ${guard} AND EXISTS
      (SELECT 1 FROM review_events WHERE id = ? AND grade = ?)`)
      .bind(
        next.ladder_id,
        next.ladder_step,
        next.interval_seconds,
        next.due_at,
        ...binds,
        event.id,
        grade,
      ),
  ]);
  if (eventUpdate?.meta.changes !== 1 || itemUpdate?.meta.changes !== 1) {
    return { ok: false, error: "stale" };
  }
  return {
    ok: true,
    item: {
      ...current,
      ladder_id: next.ladder_id,
      ladder_step: next.ladder_step,
      interval_seconds: next.interval_seconds,
      due_at: next.due_at,
    },
    event: updatedEvent,
  };
}

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
  if ((input.promptSupport ?? "none") !== "none") return logSupported(db, current, input, now);
  const at = now.toISOString();
  const next = scheduleReview(current, input.grade, input.direction, activeLadderId, at);
  const item: VocabItem = {
    ...current,
    ladder_id: next.ladder_id,
    ladder_step: next.ladder_step,
    interval_seconds: next.interval_seconds,
    last_reviewed_at: next.last_reviewed_at,
    due_at: next.due_at,
    // f17: a tracked review releases a queued item, which would otherwise be scheduled but
    // never due. A released item keeps its release instant.
    released_at: current.released_at ?? at,
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
           last_reviewed_at = ?, due_at = ?, released_at = coalesce(released_at, ?),
           updated_at = ?
         WHERE ${unchanged}`,
      )
      .bind(
        item.ladder_id,
        item.ladder_step,
        item.interval_seconds,
        item.last_reviewed_at,
        item.due_at,
        at,
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

// Helped recall (a hint, the answer said first, repetition) is not evidence of memory
// (DECISIONS 260918b, f07): the event is logged with delta 0 and before = after, and the item's
// schedule is left exactly as it was, due time included.
async function logSupported(
  db: D1Database,
  current: VocabItem,
  input: ReviewInput,
  now: Date,
): Promise<ReviewResult> {
  const at = now.toISOString();
  const event: ReviewEvent = {
    id: ulid(now.getTime()),
    vocab_id: current.id,
    reviewed_at: at,
    grade: input.grade,
    direction: input.direction,
    source: input.source,
    handoff_id: input.handoffId ?? null,
    prompt_support: input.promptSupport ?? "none",
    applied_delta: 0,
    ladder_before_id: current.ladder_id,
    step_before: current.ladder_step,
    interval_before: current.interval_seconds,
    due_before: current.due_at,
    ladder_id: current.ladder_id,
    step_after: current.ladder_step,
    interval_after: current.interval_seconds,
    due_after: current.due_at,
  };
  const inserted = await db
    .prepare(
      `INSERT INTO review_events (id, vocab_id, reviewed_at, grade, direction, source,
         handoff_id, prompt_support, applied_delta, ladder_before_id, step_before,
         interval_before, due_before, ladder_id, step_after, interval_after, due_after)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (SELECT 1 FROM vocab WHERE id = ?)`,
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
      current.id,
    )
    .run();
  if (inserted.meta.changes === 0) return { ok: false, error: "not_found" };
  return { ok: true, item: current, event };
}
