// Admin import service (FR-H). Upserts vocabulary keyed on airtable_id so a failed or wrong
// run can be corrected and re-run without wiping the vault. This is a one-time migration
// mechanism, not a sync: nothing here deletes rows the batch does not mention, and the import
// writes no review_events — Airtable carries no per-review history to import.
//
// next_review_on is always recomputed from last_reviewed_on + interval(mastery) (FR-H2). The
// caller's airtable_next_review_on is compared, never stored, and any disagreement is reported.

import type {
  ImportOutcome,
  ImportResponse,
  ImportResult,
  ImportTagRecord,
  ImportVocabRecord,
} from "../../shared/api";
import { nextReviewOn } from "../../shared/dates";
import { inferKind, urduKey } from "../../shared/normalize";
import { ulid } from "../../shared/ulid";
import { parseImportVocab } from "./import-input";

type KeyOwner = { id: string; airtable_id: string | null };

async function findByAirtableId(db: D1Database, airtableId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT id FROM vocab WHERE airtable_id = ?")
    .bind(airtableId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

async function findKeyOwner(db: D1Database, key: string): Promise<KeyOwner | null> {
  return await db
    .prepare("SELECT id, airtable_id FROM vocab WHERE urdu_key = ?")
    .bind(key)
    .first<KeyOwner>();
}

// Tags named by vocab rows get a name-only row; tags from the Airtable Tags table also carry a
// description. A later batch's description overwrites an earlier one, but a name-only mention
// never clears a description that is already there.
function tagStatements(
  db: D1Database,
  names: readonly string[],
  described: readonly ImportTagRecord[],
): D1PreparedStatement[] {
  const statements = names.map((name) =>
    db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)").bind(name),
  );
  for (const tag of described) {
    statements.push(
      db
        .prepare(
          `INSERT INTO tags (name, description) VALUES (?, ?)
           ON CONFLICT (name) DO UPDATE SET description = coalesce(excluded.description, description)`,
        )
        .bind(tag.name, tag.description ?? null),
    );
  }
  return statements;
}

function rejection(airtableId: string, reason: string, field?: string): ImportResult {
  return { airtable_id: airtableId, outcome: "rejected", reason, field };
}

async function importOne(
  db: D1Database,
  raw: unknown,
  now: Date,
): Promise<{ result: ImportResult; tags: readonly string[] }> {
  const parsed = parseImportVocab(raw);
  if (!parsed.ok) {
    const id =
      typeof (raw as ImportVocabRecord)?.airtable_id === "string"
        ? (raw as ImportVocabRecord).airtable_id
        : "";
    return {
      result: rejection(id, parsed.error.message, parsed.error.field),
      tags: [],
    };
  }
  const record = parsed.value;
  const key = urduKey(record.urdu);
  if (key === "") {
    return {
      result: rejection(
        record.airtable_id,
        "must contain Urdu letters, not only punctuation",
        "urdu",
      ),
      tags: [],
    };
  }

  const existingId = await findByAirtableId(db, record.airtable_id);
  const keyOwner = await findKeyOwner(db, key);
  // Two different Airtable records normalizing to the same urdu_key is a judgement call about
  // the sponsor's own data, so it is reported for a merge in Airtable rather than merged here.
  if (keyOwner && keyOwner.id !== existingId) {
    const held = keyOwner.airtable_id ? ` (airtable ${keyOwner.airtable_id})` : "";
    return {
      result: rejection(
        record.airtable_id,
        `urdu_key already held by vocab ${keyOwner.id}${held}`,
        "urdu",
      ),
      tags: [],
    };
  }

  const at = now.toISOString();
  const tags = record.tags ?? [];
  const recomputed = nextReviewOn(record.last_reviewed_on, record.mastery);
  const outcome: ImportOutcome = existingId ? "updated" : "created";
  const id = existingId ?? ulid(now.getTime());

  const columns = [
    record.urdu,
    key,
    record.kind ?? inferKind(record.urdu),
    record.roman ?? null,
    record.english ?? null,
    record.notes ?? null,
    record.example_urdu ?? null,
    record.example_english ?? null,
    JSON.stringify(tags),
    record.favourite ? 1 : 0,
    record.mastery,
    record.added_at,
    record.last_reviewed_on,
    recomputed,
  ];

  const write = existingId
    ? db
        .prepare(
          `UPDATE vocab SET urdu = ?, urdu_key = ?, kind = ?, roman = ?, english = ?, notes = ?,
             example_urdu = ?, example_english = ?, tags = ?, favourite = ?, mastery = ?,
             added_at = ?, last_reviewed_on = ?, next_review_on = ?, source = 'airtable',
             updated_at = ?
           WHERE id = ?`,
        )
        .bind(...columns, at, id)
    : db
        .prepare(
          `INSERT INTO vocab (id, urdu, urdu_key, kind, roman, english, notes, example_urdu,
             example_english, tags, favourite, mastery, added_at, last_reviewed_on,
             next_review_on, source, airtable_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'airtable', ?, ?, ?)`,
        )
        .bind(id, ...columns, record.airtable_id, at, at);

  await db.batch([...tagStatements(db, tags, []), write]);

  const result: ImportResult = {
    airtable_id: record.airtable_id,
    outcome,
    id,
    next_review_on: recomputed,
  };
  const claimed = record.airtable_next_review_on;
  // Only a value the caller actually supplied can disagree; an absent one is not a mismatch.
  if (claimed !== undefined && claimed !== recomputed) {
    result.next_review_mismatch = { airtable: claimed, recomputed };
  }
  return { result, tags };
}

export async function importVocab(
  db: D1Database,
  request: { vocab: unknown[]; tags: ImportTagRecord[] },
  now: Date,
): Promise<ImportResponse> {
  const results: ImportResult[] = [];
  // Rows are written one at a time, not in one batch, because each needs its own duplicate
  // lookup against the rows written before it — two records in the same batch can collide.
  for (const raw of request.vocab) {
    const { result } = await importOne(db, raw, now);
    results.push(result);
  }

  if (request.tags.length > 0) {
    await db.batch(tagStatements(db, [], request.tags));
  }

  const counts = { created: 0, updated: 0, rejected: 0 };
  let mismatches = 0;
  for (const result of results) {
    counts[result.outcome] += 1;
    if (result.next_review_mismatch) mismatches += 1;
  }

  return { results, counts, mismatches, tags_upserted: request.tags.length };
}
