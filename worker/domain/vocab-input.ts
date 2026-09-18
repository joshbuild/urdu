// Validation for vocab writes. Shared by the PWA routes now and the Coach routes (f06)
// later, so a bad field is rejected the same way whichever client sent it.

import {
  PWA_VOCAB_SOURCES,
  type UpdateVocabRequest,
  type VocabFields,
  type VocabSource,
} from "../../shared/api";
import { VOCAB_KINDS, type VocabKind } from "../../shared/normalize";

export const MAX_URDU_LENGTH = 500;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 50;

const OPTIONAL_TEXT = ["roman", "english", "notes", "example_urdu", "example_english"] as const;

const EDITABLE = new Set<string>([
  "urdu",
  "kind",
  ...OPTIONAL_TEXT,
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

// Trimmed, blank entries rejected, exact duplicates dropped, order kept.
function tagList(value: unknown): Parsed<string[]> {
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
  if ("tags" in body) {
    const r = tagList(body.tags);
    if (!r.ok) return r;
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
    if (key === "ladder_step") return fail("ladder_step", "new items start on the first rung");
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

export function parseUpdate(body: unknown): Parsed<UpdateVocabRequest> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  const keys = Object.keys(body);
  for (const key of keys) {
    if (!EDITABLE.has(key)) return fail(key, "is not an editable field");
  }
  if (keys.length === 0) return fail(undefined, "no fields to update");
  return parseFields(body);
}
