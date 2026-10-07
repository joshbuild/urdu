// Validation for vocab writes. Shared by the PWA routes now and the Coach routes (f06)
// later, so a bad field is rejected the same way whichever client sent it.

import {
  MAX_MATCH_WORDS,
  type MatchRequest,
  PWA_VOCAB_SOURCES,
  type UpdateVocabRequest,
  type VocabFields,
  type VocabSource,
} from "../../shared/api";
import { urduKey, VOCAB_KINDS, type VocabKind } from "../../shared/normalize";
import { type CefrLevel, cefrLevel, topicSlug } from "../../shared/topics";

export const MAX_URDU_LENGTH = 500;
export const MAX_TEXT_LENGTH = 2000;
// f18: tags are 0–2 secondary topic slugs.
export const MAX_TAGS = 2;
export const MAX_TAG_LENGTH = 50;

const OPTIONAL_TEXT = ["roman", "english", "notes", "example_urdu", "example_english"] as const;

const EDITABLE = new Set<string>([
  "urdu",
  "kind",
  ...OPTIONAL_TEXT,
  "topic",
  "cefr",
  "tags",
  "favourite",
  "ladder_step",
]);

export type InputError = { field?: string; message: string };
export type Parsed<T> = { ok: true; value: T } | { ok: false; error: InputError };

const fail = (field: string | undefined, message: string) =>
  ({ ok: false, error: { field, message } }) as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Trimmed; "" and null both mean "no value".
export function optionalText(field: string, value: unknown): Parsed<string | null> {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return fail(field, "must be a string or null");
  const text = value.trim();
  if (text.length > MAX_TEXT_LENGTH)
    return fail(field, `must be at most ${MAX_TEXT_LENGTH} characters`);
  return { ok: true, value: text === "" ? null : text };
}

export function urduText(value: unknown): Parsed<string> {
  if (typeof value !== "string") return fail("urdu", "is required and must be a string");
  const text = value.trim();
  if (text === "") return fail("urdu", "must not be empty");
  if (text.length > MAX_URDU_LENGTH)
    return fail("urdu", `must be at most ${MAX_URDU_LENGTH} characters`);
  return { ok: true, value: text };
}

// f18, strict (direct writes): known topic slugs, trimmed and case-folded, duplicates dropped,
// order kept, at most two.
function tagList(value: unknown): Parsed<string[]> {
  if (!Array.isArray(value)) return fail("tags", "must be an array of topic slugs");
  const tags: string[] = [];
  for (const entry of value) {
    const slug = topicSlug(entry);
    if (slug === null) return fail("tags", `${JSON.stringify(entry)} is not a known topic`);
    if (!tags.includes(slug)) tags.push(slug);
  }
  if (tags.length > MAX_TAGS) return fail("tags", `must have at most ${MAX_TAGS} entries`);
  return { ok: true, value: tags };
}

function topicValue(value: unknown): Parsed<string | null> {
  if (value === null) return { ok: true, value: null };
  const slug = topicSlug(value);
  return slug === null
    ? fail("topic", `${JSON.stringify(value)} is not a known topic`)
    : { ok: true, value: slug };
}

function cefrValue(value: unknown): Parsed<CefrLevel | null> {
  if (value === null) return { ok: true, value: null };
  const level = cefrLevel(value);
  return level === null
    ? fail("cefr", "must be one of A1, A2, B1, B2, C1, C2 or null")
    : { ok: true, value: level };
}

export type Classification = {
  topic?: string | null;
  cefr?: CefrLevel | null;
  tags?: string[];
};

// f18, lenient (pastes and other proposals): keeps what is valid and notes the rest, so a chat
// that has not learnt the slug list never fails a paste. Only keys present are returned.
export function lenientClassification(body: Record<string, unknown>): {
  value: Classification;
  dropped: string[];
} {
  const value: Classification = {};
  const dropped: string[] = [];
  const label = (v: unknown) => (typeof v === "string" ? v.trim() : JSON.stringify(v));
  if ("topic" in body && body.topic !== null) {
    value.topic = topicSlug(body.topic);
    if (value.topic === null) dropped.push(`topic ${label(body.topic)}`);
  } else if ("topic" in body) value.topic = null;
  if ("cefr" in body && body.cefr !== null) {
    value.cefr = cefrLevel(body.cefr);
    if (value.cefr === null) dropped.push(`level ${label(body.cefr)}`);
  } else if ("cefr" in body) value.cefr = null;
  if (body.tags !== undefined && body.tags !== null) {
    const tags: string[] = [];
    for (const entry of Array.isArray(body.tags) ? body.tags : [body.tags]) {
      const slug = topicSlug(entry);
      if (slug !== null && tags.includes(slug)) continue;
      if (slug === null || slug === value.topic || tags.length >= MAX_TAGS) {
        dropped.push(`tag ${label(entry)}`);
      } else {
        tags.push(slug);
      }
    }
    value.tags = tags;
  }
  return { value, dropped };
}

function kindValue(value: unknown): Parsed<VocabKind> {
  return (VOCAB_KINDS as readonly unknown[]).includes(value)
    ? { ok: true, value: value as VocabKind }
    : fail("kind", `must be one of ${VOCAB_KINDS.join(", ")}`);
}

export function parseFields(body: Record<string, unknown>): Parsed<Partial<VocabFields>> {
  const out: Partial<VocabFields> = {};
  if ("urdu" in body) {
    const r = urduText(body.urdu);
    if (!r.ok) return r;
    out.urdu = r.value;
  }
  if ("kind" in body) {
    const r = kindValue(body.kind);
    if (!r.ok) return r;
    out.kind = r.value;
  }
  for (const field of OPTIONAL_TEXT) {
    if (!(field in body)) continue;
    const r = optionalText(field, body[field]);
    if (!r.ok) return r;
    out[field] = r.value;
  }
  if ("topic" in body) {
    const r = topicValue(body.topic);
    if (!r.ok) return r;
    out.topic = r.value;
  }
  if ("cefr" in body) {
    const r = cefrValue(body.cefr);
    if (!r.ok) return r;
    out.cefr = r.value;
  }
  if ("tags" in body) {
    const r = tagList(body.tags);
    if (!r.ok) return r;
    if (out.topic && r.value.includes(out.topic)) {
      return fail("tags", "must not repeat the item's topic");
    }
    out.tags = r.value;
  }
  if ("favourite" in body) {
    if (typeof body.favourite !== "boolean") return fail("favourite", "must be a boolean");
    out.favourite = body.favourite;
  }
  if ("ladder_step" in body) {
    // The upper bound depends on the active ladder, so the service checks it.
    const step = body.ladder_step;
    if (typeof step !== "number" || !Number.isInteger(step) || step < 0) {
      return fail("ladder_step", "must be a non-negative integer");
    }
    out.ladder_step = step;
  }
  return { ok: true, value: out };
}

export type CreateInput = Partial<Omit<VocabFields, "urdu" | "ladder_step">> & {
  urdu: string;
  source: VocabSource;
};

export function parseCreate(body: unknown): Parsed<CreateInput> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  for (const key of Object.keys(body)) {
    if (key === "ladder_step") return fail("ladder_step", "new items start on the entry rung");
    if (key !== "source" && !EDITABLE.has(key)) return fail(key, "is not a recognised field");
  }
  if (!("urdu" in body)) return fail("urdu", "is required and must be a string");

  const fields = parseFields(body);
  if (!fields.ok) return fields;

  let source: CreateInput["source"] = "manual";
  if ("source" in body) {
    if (!(PWA_VOCAB_SOURCES as readonly unknown[]).includes(body.source)) {
      return fail("source", `must be one of ${PWA_VOCAB_SOURCES.join(", ")}`);
    }
    source = body.source as CreateInput["source"];
  }
  const { urdu, ...rest } = fields.value;
  return { ok: true, value: { ...rest, urdu: urdu as string, source } };
}

// f14: every entry must be a valid `urdu` value with Urdu letters; the client extracts them first.
export function parseMatch(body: unknown): Parsed<MatchRequest> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  const extra = Object.keys(body).find((key) => key !== "words");
  if (extra) return fail(extra, "is not a recognised field");
  const words = body.words;
  if (!Array.isArray(words)) return fail("words", "is required and must be an array");
  if (words.length === 0) return fail("words", "must not be empty");
  if (words.length > MAX_MATCH_WORDS) {
    return fail("words", `must have at most ${MAX_MATCH_WORDS} entries`);
  }
  const out: string[] = [];
  for (const [i, word] of words.entries()) {
    const text = urduText(word);
    if (!text.ok) return fail(`words[${i}]`, text.error.message);
    if (urduKey(text.value) === "") return fail(`words[${i}]`, "must contain Urdu letters");
    out.push(text.value);
  }
  return { ok: true, value: { words: out } };
}

export function parseUpdate(body: unknown): Parsed<UpdateVocabRequest> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  const keys = Object.keys(body);
  for (const key of keys) {
    if (!EDITABLE.has(key)) return fail(key, "is not an editable field");
  }
  if (keys.length === 0) return fail(undefined, "no fields to update");
  return parseFields(body);
}
