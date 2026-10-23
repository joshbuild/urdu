// Accuracy check (f11, FR-F9). The chat proposes corrections to existing items; this code decides.
// Copy check prompt records the batch it lists, so the corrections paste is judged against the
// items the prompt actually carried, even if the PWA was discarded in between.

import {
  CHECK_FIELD_BITS,
  CHECK_FIELD_OF,
  type CheckBatchResponse,
  type CheckField,
  type CheckMode,
  type CheckOptions,
  CORRECTABLE_FIELDS,
  type CorrectableField,
  type Correction,
  type CorrectionAccept,
  type CorrectionPlan,
  type CorrectionResult,
  type CorrectionsRequest,
  type CorrectionsResponse,
  FILLABLE_FIELDS,
  type FieldChange,
  type FieldValue,
  type VocabItem,
} from "../../shared/api";
import { correctStep } from "../../shared/ladders";
import { urduKey } from "../../shared/normalize";
import { ulid } from "../../shared/ulid";
import { ID_CONFLICT } from "./handoff";
import { insertTags, toItem, type VocabRow } from "./vocab";

type Selection = { candidates: string; unchecked: string; order: string };

// mp08: when a check field has a value to judge, and when it lacks one to fill. Topic & level
// counts as present once the item has a topic, and as missing while it lacks a topic or a level;
// tags are never missing.
function presentSql(field: CheckField): string {
  return `${field} IS NOT NULL`;
}

function missingSql(field: CheckField): string {
  return field === "topic" ? "(topic IS NULL OR cefr IS NULL)" : `${field} IS NULL`;
}

// mp08: SQL for the checked_fields bits of those of these fields the row has a value in. A check
// judges only values that are there, so an empty field is neither owed a check nor marked as
// checked. f11 batches (null fields) covered every text field.
function presentMask(fields: readonly CheckField[] | null): string {
  const bits = (fields ?? FILLABLE_FIELDS).map(
    (f) => `CASE WHEN ${presentSql(f)} THEN ${CHECK_FIELD_BITS[f]} ELSE 0 END`,
  );
  return `(${bits.join(" | ")})`;
}

// Tags are compared as lists, everything else as text.
function same(a: FieldValue | undefined, b: FieldValue | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Each mode rotates on its own stamp: never stamped first, then the longest since. A correctness
// stamp counts only once every chosen field the item has has been checked (mp08): an item checked
// for other fields is still unchecked for these, and sorts with the never-checked. Field names and
// bits come from CHECK_FIELDS, never from the request, so they are safe to interpolate.
function selection({ mode, fields, suss }: CheckOptions): Selection {
  // mp07: the flagged cards, oldest flag first.
  if (suss) {
    const flagged = "suss_at IS NOT NULL";
    return { candidates: flagged, unchecked: flagged, order: "suss_at ASC, added_at ASC, id ASC" };
  }
  const missing = `(${fields.map(missingSql).join(" OR ")})`;
  const present = `(${fields.map(presentSql).join(" OR ")})`;
  const tail = "added_at ASC, id ASC";
  const owed = presentMask(fields);
  const notChecked = `(checked_fields & ${owed}) != ${owed}`;
  const check = `CASE WHEN ${notChecked} THEN '' ELSE coalesce(checked_at, '') END`;
  if (mode === "correctness") {
    return { candidates: present, unchecked: notChecked, order: `${check} ASC, ${tail}` };
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
  const fill = `CASE WHEN ${missing} THEN coalesce(filled_at, '') ELSE ${check} END`;
  return {
    candidates: "1 = 1",
    unchecked: `(${notChecked} OR (${missing} AND filled_at IS NULL))`,
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
    // mp07: applying clears the flags set up to now; a card flagged again later keeps its flag.
    ...(options.suss ? { suss_before: now.toISOString() } : {}),
  };
  await db
    .prepare(
      "INSERT INTO handoffs (id, imported_at, payload, status, outcome) VALUES (?, ?, ?, 'check_issued', NULL)",
    )
    .bind(handoff_id, now.toISOString(), JSON.stringify(payload))
    .run();
  return { handoff_id, items, ...counts };
}

// A batch issued by f11, before modes, has no mode or fields. A suss batch (mp07) carries the
// instant it was issued.
type BatchPayload = {
  vocab_ids: string[];
  mode?: CheckMode;
  fields?: CheckField[];
  suss_before?: string;
};

// The handoff_id names no batch this app issued.
export const NOT_ISSUED = "not_issued";

// What a batch may change. `fields` null is a batch issued by f11, before modes: every text
// field, no mode rule, stamped as a correctness check. `suss_before` marks a suss batch (mp07).
export type Scope = { mode: CheckMode; fields: CheckField[] | null; suss_before?: string };

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
  const { vocab_ids, mode, fields, suss_before } = JSON.parse(row.payload) as BatchPayload;
  const scope: Scope = {
    mode: mode ?? "correctness",
    fields: fields ?? null,
    ...(suss_before !== undefined ? { suss_before } : {}),
  };
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
// proposes; this decides, whatever the prompt asked. Tags are never null, so a correctness check
// may change them and a completeness check never does.
function allowed(scope: Scope, change: FieldChange): boolean {
  if (scope.fields === null) return (FILLABLE_FIELDS as readonly string[]).includes(change.field);
  if (!scope.fields.includes(CHECK_FIELD_OF[change.field])) return false;
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
  const ignored: CorrectableField[] = [];
  // mp08: tags never repeat the topic the item will have (the paste already dropped a repeat of a
  // proposed topic).
  const topic = correction.topic !== undefined ? correction.topic : item.topic;
  for (const field of CORRECTABLE_FIELDS) {
    let proposed: FieldValue | undefined = correction[field];
    if (field === "tags" && proposed !== undefined) {
      proposed = (proposed as string[]).filter((t) => t !== topic);
    }
    if (proposed === undefined || same(proposed, item[field])) continue;
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
    ...(correction.dropped !== undefined ? { dropped: correction.dropped } : {}),
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
  const kept: CorrectableField[] = [];
  // mp08: tags never hold the topic (f18). Written tags leave out the topic the item will have,
  // which depends on whether its topic change was ticked; a topic write takes its slug out of
  // tags left as they were. Tags go first, so that strip never trips the tags write's guard.
  const topicChange = plan.changes.find((c) => c.field === "topic");
  const topic =
    topicChange && "topic" in fields && same(item.topic, fields.topic ?? null)
      ? topicChange.new
      : item.topic;
  const tagsFirst = (c: FieldChange) => (c.field === "tags" ? 0 : 1);
  for (const proposed of [...plan.changes].sort((a, b) => tagsFirst(a) - tagsFirst(b))) {
    if (!(proposed.field in fields)) continue;
    const old = fields[proposed.field] ?? (proposed.field === "tags" ? [] : null);
    if (!same(item[proposed.field], old)) {
      kept.push(proposed.field);
      continue;
    }
    const change =
      proposed.field === "tags"
        ? { ...proposed, new: (proposed.new as string[]).filter((t) => t !== topic) }
        : proposed;
    written.push(change);
    statements.push(fieldWrite(db, handoffId, item.id, change, old, at));
  }
  // Accepted, but the stored value now equals the proposal: it was edited since the preview.
  for (const field of Object.keys(fields) as CorrectableField[]) {
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

// One statement per field, conditioned on the old value: a field edited since the preview is
// never clobbered, and the other fields still land. Tags are stored as JSON text. mp08: a topic
// write takes its slug out of the tags (f18).
function fieldWrite(
  db: D1Database,
  handoffId: string,
  id: string,
  change: FieldChange,
  old: FieldValue,
  at: string,
): D1PreparedStatement {
  const { field } = change;
  const stored = (v: FieldValue) => (Array.isArray(v) ? JSON.stringify(v) : v);
  if (field === "topic") {
    return db
      .prepare(
        `UPDATE vocab SET topic = ?1, updated_at = ?2,
             tags = (SELECT json_group_array(value) FROM json_each(vocab.tags) WHERE value IS NOT ?1)
         WHERE id = ?3 AND topic IS ?4 AND ${OPEN.replace("?", "?5")}`,
      )
      .bind(change.new, at, id, old, handoffId);
  }
  return db
    .prepare(
      `UPDATE vocab SET ${field} = ?, updated_at = ?
       WHERE id = ? AND ${field} IS ? AND ${OPEN}`,
    )
    .bind(stored(change.new), at, id, stored(old), handoffId);
}

// Which stamps an applied batch writes: a correctness check is checked_at with its fields ORed
// into checked_fields (mp08; a bit is never cleared), a completeness check filled_at. The stamp
// runs after the batch's writes, so a field the check filled counts as checked, and one it
// removed does not.
function stamps(mode: CheckMode, fields: readonly CheckField[] | null): string {
  const checked = `checked_at = ?1, checked_fields = checked_fields | ${presentMask(fields)}`;
  if (mode === "correctness") return checked;
  if (mode === "completeness") return "filled_at = ?1";
  return `${checked}, filled_at = ?1`;
}

// mp07: a suss batch clears the flag and comment of its cards flagged before it was issued. Like
// the stamps it is not an edit, so updated_at is left alone.
function sussClear(
  db: D1Database,
  ids: readonly string[],
  before: string | undefined,
  handoffId: string,
): D1PreparedStatement[] {
  if (before === undefined) return [];
  return [
    db
      .prepare(
        `UPDATE vocab SET suss_at = NULL, suss_note = NULL
         WHERE id IN (${ids.map(() => "?").join(", ")}) AND suss_at <= ? AND ${OPEN}`,
      )
      .bind(...ids, before, handoffId),
  ];
}

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
    ...(batch.suss_before !== undefined ? { suss_before: batch.suss_before } : {}),
    corrections: request.corrections,
    accept: request.accept,
  };
  const writes = planned.flatMap((p) => p.statements);

  const outcomes = await db.batch([
    ...writes,
    // A stamp is not an edit: updated_at is left alone. Ids deleted since the copy match no row.
    db
      .prepare(
        `UPDATE vocab SET ${stamps(mode, batch.fields)}
         WHERE id IN (${vocabIds.map((_, i) => `?${i + 2}`).join(", ")})
           AND ${OPEN.replace("?", `?${vocabIds.length + 2}`)}`,
      )
      .bind(at, ...vocabIds, handoff_id),
    ...sussClear(db, vocabIds, batch.suss_before, handoff_id),
    // Name rows for any tag written, as every tags write adds them (f04 tag list).
    ...insertTags(db, [...new Set(results.flatMap(writtenTags))]),
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

function writtenTags(result: CorrectionResult): string[] {
  if (result.outcome !== "checked") return [];
  return result.written.flatMap((c) => (c.field === "tags" ? (c.new as string[]) : []));
}
