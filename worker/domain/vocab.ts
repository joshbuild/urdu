// Vocab service (FR-A5..A8). D1 access for vocab lives here; routes stay thin. Reads never
// write (FR-A8): only create, update and delete touch rows.

import type { Tag, UpdateVocabRequest, VocabItem, VocabSort } from "../../shared/api";
import { correctStep, ladder } from "../../shared/ladders";
import { inferKind, urduKey } from "../../shared/normalize";
import { ulid } from "../../shared/ulid";
import type { CreateInput } from "./vocab-input";

export type VocabRow = Omit<VocabItem, "tags" | "favourite"> & {
  tags: string;
  favourite: number;
};

export type WriteResult =
  | { ok: true; item: VocabItem }
  | { ok: false; error: "duplicate"; existingId: string }
  | { ok: false; error: "empty_key" }
  | { ok: false; error: "not_found" }
  // A ladder_step edit past the active ladder's last rung.
  | { ok: false; error: "bad_step"; maxStep: number };

export function toItem(row: VocabRow): VocabItem {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    favourite: row.favourite === 1,
  };
}

// Items never reviewed (null) are due now. Instants are all toISOString() output, so text order
// is time order.
const DUE = "(due_at IS NULL OR due_at <= ?)";
const HAS_TAG = "EXISTS (SELECT 1 FROM json_each(vocab.tags) WHERE json_each.value = ?)";
const DUE_ORDER = "due_at ASC NULLS FIRST, added_at ASC, id ASC";

const SORT_ORDER: Readonly<Record<VocabSort, string>> = {
  added: "added_at DESC, id DESC",
  next_review: DUE_ORDER,
  mastery: "interval_seconds ASC, added_at ASC, id ASC",
};

export async function findIdByKey(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT id FROM vocab WHERE urdu_key = ?")
    .bind(key)
    .first<{ id: string }>();
  return row?.id ?? null;
}

function isUniqueKeyViolation(err: unknown): boolean {
  return err instanceof Error && err.message.includes("UNIQUE constraint failed: vocab.urdu_key");
}

// Unknown tags get a name-only row so tag filters and a later tag list see them.
function insertTags(db: D1Database, tags: readonly string[]): D1PreparedStatement[] {
  return tags.map((name) => db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").bind(name));
}

// A concurrent write can take the key between our check and our write; the unique index
// catches it, and we report the same duplicate outcome.
async function duplicateAfterRace(db: D1Database, key: string, err: unknown): Promise<WriteResult> {
  if (!isUniqueKeyViolation(err)) throw err;
  const existingId = await findIdByKey(db, key);
  if (!existingId) throw err;
  return { ok: false, error: "duplicate", existingId };
}

export async function getVocab(db: D1Database, id: string): Promise<VocabItem | null> {
  const row = await db.prepare("SELECT * FROM vocab WHERE id = ?").bind(id).first<VocabRow>();
  return row ? toItem(row) : null;
}

// New items start on the first rung of the active ladder, never reviewed, so due now.
export async function createVocab(
  db: D1Database,
  input: CreateInput,
  now: Date,
  activeLadderId: number,
): Promise<WriteResult> {
  const key = urduKey(input.urdu);
  if (key === "") return { ok: false, error: "empty_key" };

  const existingId = await findIdByKey(db, key);
  if (existingId) return { ok: false, error: "duplicate", existingId };

  const at = now.toISOString();
  const tags = input.tags ?? [];
  const item: VocabItem = {
    id: ulid(now.getTime()),
    urdu: input.urdu,
    urdu_key: key,
    kind: input.kind ?? inferKind(input.urdu),
    roman: input.roman ?? null,
    english: input.english ?? null,
    notes: input.notes ?? null,
    example_urdu: input.example_urdu ?? null,
    example_english: input.example_english ?? null,
    tags,
    favourite: input.favourite ?? false,
    ladder_id: activeLadderId,
    ladder_step: 0,
    interval_seconds: ladder(activeLadderId).intervals_seconds[0] as number,
    added_at: at,
    last_reviewed_at: null,
    due_at: null,
    source: input.source,
    airtable_id: null,
    created_at: at,
    updated_at: at,
  };

  try {
    await db.batch([
      ...insertTags(db, tags),
      db
        .prepare(
          `INSERT INTO vocab (id, urdu, urdu_key, kind, roman, english, notes, example_urdu,
             example_english, tags, favourite, ladder_id, ladder_step, interval_seconds,
             added_at, last_reviewed_at, due_at, source, airtable_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          item.id,
          item.urdu,
          item.urdu_key,
          item.kind,
          item.roman,
          item.english,
          item.notes,
          item.example_urdu,
          item.example_english,
          JSON.stringify(item.tags),
          item.favourite ? 1 : 0,
          item.ladder_id,
          item.ladder_step,
          item.interval_seconds,
          item.added_at,
          item.last_reviewed_at,
          item.due_at,
          item.source,
          item.airtable_id,
          item.created_at,
          item.updated_at,
        ),
    ]);
  } catch (err) {
    return duplicateAfterRace(db, key, err);
  }
  return { ok: true, item };
}

// Manual edits are corrections, not reviews: a ladder_step change puts the item on the active
// ladder at that rung, recomputes due_at from the existing last_reviewed_at, leaves
// last_reviewed_at alone, and writes no event.
export async function updateVocab(
  db: D1Database,
  id: string,
  changes: UpdateVocabRequest,
  now: Date,
  activeLadderId: number,
): Promise<WriteResult> {
  const current = await getVocab(db, id);
  if (!current) return { ok: false, error: "not_found" };

  const next: VocabItem = { ...current, ...changes, updated_at: now.toISOString() };

  if (changes.urdu !== undefined) {
    next.urdu_key = urduKey(changes.urdu);
    if (next.urdu_key === "") return { ok: false, error: "empty_key" };
    if (changes.kind === undefined) next.kind = inferKind(changes.urdu);
    if (next.urdu_key !== current.urdu_key) {
      const existingId = await findIdByKey(db, next.urdu_key);
      if (existingId && existingId !== id) return { ok: false, error: "duplicate", existingId };
    }
  }
  if (changes.ladder_step !== undefined) {
    const last = ladder(activeLadderId).intervals_seconds.length - 1;
    if (changes.ladder_step > last) return { ok: false, error: "bad_step", maxStep: last };
    Object.assign(next, correctStep(changes.ladder_step, activeLadderId, current.last_reviewed_at));
  }

  try {
    await db.batch([
      ...insertTags(db, changes.tags ?? []),
      db
        .prepare(
          `UPDATE vocab SET urdu = ?, urdu_key = ?, kind = ?, roman = ?, english = ?, notes = ?,
             example_urdu = ?, example_english = ?, tags = ?, favourite = ?, ladder_id = ?,
             ladder_step = ?, interval_seconds = ?, due_at = ?, updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          next.urdu,
          next.urdu_key,
          next.kind,
          next.roman,
          next.english,
          next.notes,
          next.example_urdu,
          next.example_english,
          JSON.stringify(next.tags),
          next.favourite ? 1 : 0,
          next.ladder_id,
          next.ladder_step,
          next.interval_seconds,
          next.due_at,
          next.updated_at,
          id,
        ),
    ]);
  } catch (err) {
    return duplicateAfterRace(db, next.urdu_key, err);
  }
  return { ok: true, item: next };
}

// Review events go with the item (ON DELETE CASCADE, f01 Q2).
export async function deleteVocab(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM vocab WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

export type ListQuery = {
  q?: string;
  tag?: string;
  due?: boolean;
  sort: VocabSort;
  limit: number;
  offset: number;
};

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listVocab(
  db: D1Database,
  query: ListQuery,
  now: string,
): Promise<{ items: VocabItem[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  const q = query.q?.trim();
  if (q) {
    // Urdu matches on the normalized key, so tashkeel and letter variants don't defeat search.
    // SQLite LIKE is case-insensitive for ASCII, which covers Roman and English.
    const text = `%${escapeLike(q)}%`;
    const key = urduKey(q);
    const clauses = ["roman LIKE ? ESCAPE '\\'", "english LIKE ? ESCAPE '\\'"];
    params.push(text, text);
    if (key !== "") {
      clauses.unshift("urdu_key LIKE ? ESCAPE '\\'");
      params.unshift(`%${escapeLike(key)}%`);
    }
    where.push(`(${clauses.join(" OR ")})`);
  }
  if (query.tag !== undefined) {
    where.push(HAS_TAG);
    params.push(query.tag);
  }
  if (query.due) {
    where.push(DUE);
    params.push(now);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const [rows, count] = await db.batch([
    db
      .prepare(
        `SELECT * FROM vocab ${whereSql} ORDER BY ${SORT_ORDER[query.sort]} LIMIT ? OFFSET ?`,
      )
      .bind(...params, query.limit, query.offset),
    db.prepare(`SELECT count(*) AS n FROM vocab ${whereSql}`).bind(...params),
  ]);
  const items = (rows?.results ?? []) as VocabRow[];
  const total = (count?.results[0] as { n: number } | undefined)?.n ?? 0;
  return { items: items.map(toItem), total };
}

// `cutoff` is now, or a later instant when reviewing ahead.
export async function dueVocab(
  db: D1Database,
  cutoff: string,
  limit: number,
  tag?: string,
): Promise<VocabItem[]> {
  const where = [DUE];
  const params: unknown[] = [cutoff];
  if (tag !== undefined) {
    where.push(HAS_TAG);
    params.push(tag);
  }
  const { results } = await db
    .prepare(`SELECT * FROM vocab WHERE ${where.join(" AND ")} ORDER BY ${DUE_ORDER} LIMIT ?`)
    .bind(...params, limit)
    .all<VocabRow>();
  return results.map(toItem);
}

export async function vocabCounts(
  db: D1Database,
  now: string,
): Promise<{ total: number; due: number }> {
  const row = await db
    .prepare(`SELECT count(*) AS total, count(*) FILTER (WHERE ${DUE}) AS due FROM vocab`)
    .bind(now)
    .first<{ total: number; due: number }>();
  return { total: row?.total ?? 0, due: row?.due ?? 0 };
}

// Every tag ever used, name order (f04 tag filter). The tags table is kept in step by insertTags.
export async function listTags(db: D1Database): Promise<Tag[]> {
  const { results } = await db
    .prepare("SELECT name, description FROM tags ORDER BY name ASC")
    .all<Tag>();
  return results;
}
