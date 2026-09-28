// Accuracy check (f11, FR-F9). The chat proposes corrections to existing items; this code decides.
// Copy check prompt records the batch it lists, so the corrections paste is judged against the
// items the prompt actually carried, even if the PWA was discarded in between.

import {
  type CheckBatchResponse,
  type CheckMode,
  type CheckOptions,
  type Correction,
  type CorrectionAccept,
  type CorrectionPlan,
  type CorrectionResult,
  type CorrectionsRequest,
  type CorrectionsResponse,
  FILLABLE_FIELDS,
  type FieldChange,
  type FillableField,
  type VocabItem,
} from "../../shared/api";
import { correctStep } from "../../shared/ladders";
import { urduKey } from "../../shared/normalize";
import { ulid } from "../../shared/ulid";
import { ID_CONFLICT } from "./handoff";
import { toItem, type VocabRow } from "./vocab";

type Selection = { candidates: string; unchecked: string; order: string };

// Each mode rotates on its own stamp: never stamped first, then the longest since. Field names
// come from FILLABLE_FIELDS, never from the request, so they are safe to interpolate.
function selection({ mode, fields }: CheckOptions): Selection {
  const missing = `(${fields.map((f) => `${f} IS NULL`).join(" OR ")})`;
  const present = `(${fields.map((f) => `${f} IS NOT NULL`).join(" OR ")})`;
  const tail = "added_at ASC, id ASC";
  if (mode === "correctness") {
    return {
      candidates: present,
      unchecked: "checked_at IS NULL",
      order: `checked_at ASC NULLS FIRST, ${tail}`,
    };
  }
  if (mode === "completeness") {
    return {
      candidates: missing,
      unchecked: "filled_at IS NULL",
      order: `filled_at ASC NULLS FIRST, ${tail}`,
    };
  }
  // Both: the older of the two stamps, a null counting as oldest (''). The fill stamp counts
  // only while the item is missing a field, as in the unchecked test.
  const check = "coalesce(checked_at, '')";
  const fill = `CASE WHEN ${missing} THEN coalesce(filled_at, '') ELSE ${check} END`;
  return {
    candidates: "1 = 1",
    unchecked: `(checked_at IS NULL OR (${missing} AND filled_at IS NULL))`,
    order: `min(${check}, ${fill}) ASC, ${tail}`,
  };
}

// Every call records a new `check_issued` batch holding its ids, mode and fields; one never
// pasted back is a harmless row. The outcome stays null until the corrections are applied. No
// qualifying item records nothing.
export async function issueCheckBatch(
  db: D1Database,
  options: CheckOptions,
  now: Date,
): Promise<CheckBatchResponse> {
  const { candidates, unchecked, order } = selection(options);
  const where = options.only_unchecked ? `${candidates} AND ${unchecked}` : candidates;
  const [rows, all, fresh] = await db.batch([
    db.prepare(`SELECT * FROM vocab WHERE ${where} ORDER BY ${order} LIMIT ?`).bind(options.count),
    db.prepare(`SELECT count(*) AS n FROM vocab WHERE ${candidates}`),
    db.prepare(`SELECT count(*) AS n FROM vocab WHERE ${candidates} AND ${unchecked}`),
  ]);
  const items = ((rows?.results ?? []) as VocabRow[]).map(toItem);
  const count = (r: typeof all) => (r?.results[0] as { n: number } | undefined)?.n ?? 0;
  const counts = { candidates: count(all), unchecked: count(fresh) };
  if (items.length === 0) return { handoff_id: null, items, ...counts };

  const handoff_id = ulid(now.getTime());
  const payload: BatchPayload = {
    vocab_ids: items.map((i) => i.id),
    mode: options.mode,
    fields: options.fields,
  };
  await db
    .prepare(
      "INSERT INTO handoffs (id, imported_at, payload, status, outcome) VALUES (?, ?, ?, 'check_issued', NULL)",
    )
    .bind(handoff_id, now.toISOString(), JSON.stringify(payload))
    .run();
  return { handoff_id, items, ...counts };
}

// A batch issued by f11, before modes, has no mode or fields.
type BatchPayload = { vocab_ids: string[]; mode?: CheckMode; fields?: FillableField[] };

// The handoff_id names no batch this app issued.
export const NOT_ISSUED = "not_issued";

// What a batch may change. `fields` null is a batch issued by f11, before modes: every field,
// no mode rule, stamped as a correctness check.
export type Scope = { mode: CheckMode; fields: FillableField[] | null };

type Batch = Scope &
  (
    | { status: "check_issued"; vocab_ids: string[] }
    | { status: "checked"; vocab_ids: string[]; results: CorrectionResult[] }
  );

async function readBatch(
  db: D1Database,
  id: string,
): Promise<Batch | typeof ID_CONFLICT | typeof NOT_ISSUED> {
  const row = await db
    .prepare("SELECT status, payload, outcome FROM handoffs WHERE id = ?")
    .bind(id)
    .first<{ status: string; payload: string; outcome: string | null }>();
  if (!row) return NOT_ISSUED;
  if (row.status !== "check_issued" && row.status !== "checked") return ID_CONFLICT;
  const { vocab_ids, mode, fields } = JSON.parse(row.payload) as BatchPayload;
  const scope: Scope = { mode: mode ?? "correctness", fields: fields ?? null };
  return row.status === "checked"
    ? { ...scope, status: "checked", vocab_ids, results: JSON.parse(row.outcome ?? "[]") }
    : { ...scope, status: "check_issued", vocab_ids };
}

export async function readItems(db: D1Database, ids: string[]): Promise<Map<string, VocabItem>> {
  const { results } = await db
    .prepare(`SELECT * FROM vocab WHERE id IN (${ids.map(() => "?").join(", ")})`)
    .bind(...ids)
    .all<VocabRow>();
  return new Map(results.map((row) => [row.id, toItem(row)]));
}

// f13: whether the batch's mode and fields let a proposal change this field. The chat only
// proposes; this decides, whatever the prompt asked.
function allowed(scope: Scope, change: FieldChange): boolean {
  if (scope.fields === null) return true;
  if (!scope.fields.includes(change.field)) return false;
  if (scope.mode === "correctness") return change.old !== null;
  if (scope.mode === "completeness") return change.old === null;
  return true;
}

// Judges one correction against the stored item. A proposed value equal to the stored one, and a
// suggestion with the item's own key, are dropped; a change the scope doesn't allow is ignored.
export function planCorrection(
  correction: Correction,
  batch: ReadonlySet<string>,
  item: VocabItem | undefined,
  scope: Scope,
): CorrectionPlan {
  const { vocab_id, urdu, reason } = correction;
  if (!batch.has(vocab_id)) {
    return { vocab_id, urdu, outcome: "rejected", reason: "not in this check batch" };
  }
  if (!item) return { vocab_id, urdu, outcome: "rejected", reason: "no item has this id" };
  // Compared by key, so a reply that drops or adds tashkeel still matches its item.
  if (urduKey(urdu) !== item.urdu_key) {
    return {
      vocab_id,
      urdu,
      outcome: "rejected",
      reason: `urdu does not match the stored item (${item.urdu})`,
    };
  }
  const changes: FieldChange[] = [];
  const ignored: FillableField[] = [];
  for (const field of FILLABLE_FIELDS) {
    const proposed = correction[field];
    if (proposed === undefined || proposed === item[field]) continue;
    const change = { field, old: item[field], new: proposed };
    if (allowed(scope, change)) changes.push(change);
    else ignored.push(field);
  }
  const suggestion = correction.urdu_suggestion;
  return {
    vocab_id,
    urdu,
    outcome: changes.length > 0 ? "correct" : "nothing",
    changes,
    ignored,
    reason,
    ...(suggestion !== undefined && urduKey(suggestion) !== item.urdu_key
      ? { urdu_suggestion: suggestion }
      : {}),
  };
}

// f11 (FR-F9). A preview plans and writes nothing. Apply writes the accepted fields, each only if
// it still holds the old value the preview showed, runs any ticked reset, stamps every batch item
// checked and moves the batch to `checked`, in one D1 batch. A batch already applied is a repeat.
export async function correctVocab(
  db: D1Database,
  request: CorrectionsRequest,
  now: Date,
  activeLadderId: number,
): Promise<CorrectionsResponse | typeof ID_CONFLICT | typeof NOT_ISSUED> {
  const { handoff_id } = request;
  const batch = await readBatch(db, handoff_id);
  if (batch === ID_CONFLICT || batch === NOT_ISSUED) return batch;
  const { mode } = batch;
  const batch_size = batch.vocab_ids.length;
  if (batch.status === "checked") {
    return { handoff_id, preview: false, repeat: true, mode, batch_size, results: batch.results };
  }
  const items = await readItems(db, batch.vocab_ids);
  if (request.accept === undefined) {
    const ids = new Set(batch.vocab_ids);
    const results = request.corrections.map((c) =>
      planCorrection(c, ids, items.get(c.vocab_id), batch),
    );
    return { handoff_id, preview: true, repeat: false, mode, batch_size, results };
  }
  return applyCorrections(db, request, batch, items, now, activeLadderId);
}

// Every write also requires the batch to be unapplied, so when two applies of one batch race,
// the loser's D1 batch writes nothing.
const OPEN = "EXISTS (SELECT 1 FROM handoffs WHERE id = ? AND status = 'check_issued')";

type Planned = { result: CorrectionResult; statements: D1PreparedStatement[] };

function planApply(
  db: D1Database,
  handoffId: string,
  plan: Extract<CorrectionPlan, { outcome: "correct" | "nothing" }>,
  item: VocabItem,
  accept: CorrectionAccept | undefined,
  at: string,
  activeLadderId: number,
): Planned {
  const fields = accept?.fields ?? {};
  const statements: D1PreparedStatement[] = [];
  const written: FieldChange[] = [];
  const kept: FillableField[] = [];
  for (const change of plan.changes) {
    if (!(change.field in fields)) continue;
    const old = fields[change.field] ?? null;
    if (item[change.field] !== old) {
      kept.push(change.field);
      continue;
    }
    written.push(change);
    // One statement per field, conditioned on the old value: a field edited since the preview is
    // never clobbered, and the other fields still land.
    statements.push(
      db
        .prepare(
          `UPDATE vocab SET ${change.field} = ?, updated_at = ?
           WHERE id = ? AND ${change.field} IS ? AND ${OPEN}`,
        )
        .bind(change.new, at, item.id, old, handoffId),
    );
  }
  // Accepted, but the stored value now equals the proposal: it was edited since the preview.
  for (const field of Object.keys(fields) as FillableField[]) {
    if (!plan.changes.some((c) => c.field === field)) kept.push(field);
  }
  if (accept?.reset) {
    // FR-F8 semantics, as an FR-D2 rung edit to 0: no review event, due from the last review.
    // Guarded like review.ts, so a review landing in between skips the reset.
    const next = correctStep(0, activeLadderId, item.last_reviewed_at);
    statements.push(
      db
        .prepare(
          `UPDATE vocab SET ladder_id = ?, ladder_step = ?, interval_seconds = ?, due_at = ?,
             updated_at = ?
           WHERE id = ? AND ladder_id = ? AND ladder_step = ? AND last_reviewed_at IS ?
             AND ${OPEN}`,
        )
        .bind(
          next.ladder_id,
          next.ladder_step,
          next.interval_seconds,
          next.due_at,
          at,
          item.id,
          item.ladder_id,
          item.ladder_step,
          item.last_reviewed_at,
          handoffId,
        ),
    );
  }
  const result: CorrectionResult = {
    vocab_id: plan.vocab_id,
    urdu: plan.urdu,
    outcome: "checked",
    written,
    kept,
    declined: plan.changes.filter((c) => !(c.field in fields)).map((c) => c.field),
    reset: accept?.reset ? "applied" : "not_asked",
    reason: plan.reason,
    ...(plan.urdu_suggestion !== undefined ? { urdu_suggestion: plan.urdu_suggestion } : {}),
  };
  return { result, statements };
}

// Which stamps an applied batch writes: a correctness check is checked_at, a completeness check
// filled_at.
const STAMPS: Readonly<Record<CheckMode, string>> = {
  correctness: "checked_at = ?1",
  completeness: "filled_at = ?1",
  both: "checked_at = ?1, filled_at = ?1",
};

// The plan is made from `items`, a read taken just before the write; the SQL guards are the
// backstop. Exported so a test can pass a read that has gone stale.
export async function applyCorrections(
  db: D1Database,
  request: CorrectionsRequest,
  batch: Scope & { vocab_ids: string[] },
  items: ReadonlyMap<string, VocabItem>,
  now: Date,
  activeLadderId: number,
): Promise<CorrectionsResponse | typeof ID_CONFLICT> {
  const { handoff_id } = request;
  const { mode, vocab_ids: vocabIds } = batch;
  const at = now.toISOString();
  const ids = new Set(vocabIds);
  const accepts = new Map((request.accept ?? []).map((a) => [a.vocab_id, a]));

  const planned = request.corrections.map((c): Planned => {
    const item = items.get(c.vocab_id);
    const plan = planCorrection(c, ids, item, batch);
    if (plan.outcome === "rejected") return { result: plan, statements: [] };
    if (!item) throw new Error("a planned correction has no item");
    return planApply(db, handoff_id, plan, item, accepts.get(c.vocab_id), at, activeLadderId);
  });
  const results = planned.map((p) => p.result);
  // Mode and fields stay in the payload, so a repeat still knows its mode.
  const payload = {
    vocab_ids: vocabIds,
    ...(batch.fields !== null ? { mode, fields: batch.fields } : {}),
    corrections: request.corrections,
    accept: request.accept,
  };
  const writes = planned.flatMap((p) => p.statements);

  const outcomes = await db.batch([
    ...writes,
    // A stamp is not an edit: updated_at is left alone. Ids deleted since the copy match no row.
    db
      .prepare(
        `UPDATE vocab SET ${STAMPS[mode]}
         WHERE id IN (${vocabIds.map((_, i) => `?${i + 2}`).join(", ")})
           AND ${OPEN.replace("?", `?${vocabIds.length + 2}`)}`,
      )
      .bind(at, ...vocabIds, handoff_id),
    db
      .prepare(
        `UPDATE handoffs SET status = 'checked', imported_at = ?, payload = ?, outcome = ?
         WHERE id = ? AND status = 'check_issued'`,
      )
      .bind(at, JSON.stringify(payload), JSON.stringify(results), handoff_id),
  ]);

  if (outcomes.at(-1)?.meta.changes === 0) {
    // Another apply of this batch got there first; nothing of ours was written.
    const stored = await readBatch(db, handoff_id);
    if (stored === ID_CONFLICT || stored === NOT_ISSUED || stored.status !== "checked") {
      return ID_CONFLICT;
    }
    return {
      handoff_id,
      preview: false,
      repeat: true,
      mode,
      batch_size: vocabIds.length,
      results: stored.results,
    };
  }

  // A write that matched no row lost a race with an edit or a review after the read. Report what
  // actually happened, and store that.
  let raced = false;
  let index = 0;
  for (const r of results) {
    if (r.outcome !== "checked") continue;
    for (const change of [...r.written]) {
      if (outcomes[index++]?.meta.changes !== 0) continue;
      raced = true;
      r.written = r.written.filter((w) => w !== change);
      r.kept.push(change.field);
    }
    if (r.reset === "applied" && outcomes[index++]?.meta.changes === 0) {
      raced = true;
      r.reset = "skipped";
    }
  }
  if (raced) {
    await db
      .prepare("UPDATE handoffs SET outcome = ? WHERE id = ?")
      .bind(JSON.stringify(results), handoff_id)
      .run();
  }
  return {
    handoff_id,
    preview: false,
    repeat: false,
    mode,
    batch_size: vocabIds.length,
    results,
  };
}
