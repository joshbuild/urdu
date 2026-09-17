// Validation for admin import records (FR-H). Stricter than vocab-input: the import is a
// migration, so a malformed row is rejected and reported rather than coerced. Unlike a PWA
// create, mastery and dates ARE caller-supplied here — that is the whole point of the import.

import type { ImportTagRecord, ImportVocabRecord } from "../../shared/api";
import { isIsoDate } from "../../shared/dates";
import { isMastery } from "../../shared/mastery";
import { VOCAB_KINDS, type VocabKind } from "../../shared/normalize";
import {
  MAX_TAG_LENGTH,
  MAX_TAGS,
  MAX_TEXT_LENGTH,
  MAX_URDU_LENGTH,
  type Parsed,
} from "./vocab-input";

export const MAX_AIRTABLE_ID_LENGTH = 64;

const OPTIONAL_TEXT = ["roman", "english", "notes", "example_urdu", "example_english"] as const;

const KNOWN = new Set<string>([
  "airtable_id",
  "urdu",
  "kind",
  ...OPTIONAL_TEXT,
  "tags",
  "favourite",
  "mastery",
  "added_at",
  "last_reviewed_on",
  "airtable_next_review_on",
]);

const fail = (field: string | undefined, message: string) =>
  ({ ok: false, error: { field, message } }) as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(field: string, value: unknown): Parsed<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return fail(field, "must be a string or null");
  const text = value.trim();
  if (text.length > MAX_TEXT_LENGTH)
    return fail(field, `must be at most ${MAX_TEXT_LENGTH} characters`);
  return { ok: true, value: text === "" ? null : text };
}

function tagList(value: unknown): Parsed<string[]> {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value)) return fail("tags", "must be an array of strings");
  const tags: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      return fail("tags", "entries must be non-empty strings");
    }
    const tag = entry.trim();
    if (tag.length > MAX_TAG_LENGTH)
      return fail("tags", `entries must be at most ${MAX_TAG_LENGTH} characters`);
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > MAX_TAGS) return fail("tags", `must have at most ${MAX_TAGS} entries`);
  return { ok: true, value: tags };
}

// Airtable exports `Added` as a bare date. A date is read as midnight UTC so added_at stays
// a single comparable instant format across imported and app-created rows.
function instant(field: string, value: unknown): Parsed<string> {
  if (typeof value !== "string" || value.trim() === "") {
    return fail(field, "is required and must be an ISO date or datetime");
  }
  const text = value.trim();
  if (isIsoDate(text)) return { ok: true, value: `${text}T00:00:00.000Z` };
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fail(field, "must be an ISO date or datetime");
  return { ok: true, value: parsed.toISOString() };
}

function nullableDate(field: string, value: unknown): Parsed<string | null> {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (!isIsoDate(value)) return fail(field, "must be a YYYY-MM-DD date or null");
  return { ok: true, value };
}

export function parseImportVocab(body: unknown): Parsed<ImportVocabRecord> {
  if (!isRecord(body)) return fail(undefined, "record must be a JSON object");
  for (const key of Object.keys(body)) {
    if (!KNOWN.has(key)) return fail(key, "is not a recognised field");
  }

  if (typeof body.airtable_id !== "string" || body.airtable_id.trim() === "") {
    return fail("airtable_id", "is required and must be a non-empty string");
  }
  const airtableId = body.airtable_id.trim();
  if (airtableId.length > MAX_AIRTABLE_ID_LENGTH) {
    return fail("airtable_id", `must be at most ${MAX_AIRTABLE_ID_LENGTH} characters`);
  }

  if (typeof body.urdu !== "string" || body.urdu.trim() === "") {
    return fail("urdu", "is required and must be a non-empty string");
  }
  const urdu = body.urdu.trim();
  if (urdu.length > MAX_URDU_LENGTH)
    return fail("urdu", `must be at most ${MAX_URDU_LENGTH} characters`);

  if (!isMastery(body.mastery)) return fail("mastery", "must be an integer from 0 to 6");

  let kind: VocabKind | undefined;
  if (body.kind !== undefined) {
    if (!(VOCAB_KINDS as readonly unknown[]).includes(body.kind)) {
      return fail("kind", `must be one of ${VOCAB_KINDS.join(", ")}`);
    }
    kind = body.kind as VocabKind;
  }

  const record = {
    airtable_id: airtableId,
    urdu,
    kind,
    mastery: body.mastery,
  } as ImportVocabRecord;

  for (const field of OPTIONAL_TEXT) {
    const r = optionalText(field, body[field]);
    if (!r.ok) return r;
    record[field] = r.value;
  }

  const tags = tagList(body.tags);
  if (!tags.ok) return tags;
  record.tags = tags.value;

  if (body.favourite !== undefined) {
    if (typeof body.favourite !== "boolean") return fail("favourite", "must be a boolean");
    record.favourite = body.favourite;
  }

  const addedAt = instant("added_at", body.added_at);
  if (!addedAt.ok) return addedAt;
  record.added_at = addedAt.value;

  const lastReviewed = nullableDate("last_reviewed_on", body.last_reviewed_on);
  if (!lastReviewed.ok) return lastReviewed;
  record.last_reviewed_on = lastReviewed.value;

  const airtableNext = nullableDate("airtable_next_review_on", body.airtable_next_review_on);
  if (!airtableNext.ok) return airtableNext;
  record.airtable_next_review_on = airtableNext.value;

  return { ok: true, value: record };
}

function parseImportTag(body: unknown): Parsed<ImportTagRecord> {
  if (!isRecord(body)) return fail(undefined, "tag must be a JSON object");
  for (const key of Object.keys(body)) {
    if (key !== "name" && key !== "description") return fail(key, "is not a recognised field");
  }
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return fail("name", "is required and must be a non-empty string");
  }
  const name = body.name.trim();
  if (name.length > MAX_TAG_LENGTH)
    return fail("name", `must be at most ${MAX_TAG_LENGTH} characters`);
  const description = optionalText("description", body.description);
  if (!description.ok) return description;
  return { ok: true, value: { name, description: description.value } };
}

// The envelope only; each vocab record is parsed per-row by the service so one bad row is
// reported as rejected instead of failing the whole batch.
export function parseImportEnvelope(
  body: unknown,
  maxBatch: number,
): Parsed<{ vocab: unknown[]; tags: ImportTagRecord[] }> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  for (const key of Object.keys(body)) {
    if (key !== "vocab" && key !== "tags") return fail(key, "is not a recognised field");
  }
  if (!Array.isArray(body.vocab)) return fail("vocab", "is required and must be an array");
  if (body.vocab.length > maxBatch) {
    return fail("vocab", `must have at most ${maxBatch} records per batch`);
  }

  const tags: ImportTagRecord[] = [];
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return fail("tags", "must be an array of objects");
    for (const entry of body.tags) {
      const parsed = parseImportTag(entry);
      if (!parsed.ok) return parsed;
      tags.push(parsed.value);
    }
  }

  return { ok: true, value: { vocab: body.vocab as unknown[], tags } };
}
