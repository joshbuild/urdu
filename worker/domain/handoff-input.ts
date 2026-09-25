// Validation for clipboard handoffs (f06, FR-F4/F7; f11 corrections, FR-F9). Strict: a payload with any bad field is
// rejected whole, with the field's path, and never repaired. Rejecting whole keeps a handoff_id
// unrecorded, so the corrected reply can be pasted again under the same id.

import {
  type Correction,
  type CorrectionAccept,
  type CorrectionsRequest,
  FILLABLE_FIELDS,
  type FillableField,
  type HandoffProposal,
  type HandoffRequest,
  MAX_CHECK_BATCH,
  MAX_HANDOFF_ID_LENGTH,
  MAX_HANDOFF_PROPOSALS,
  MAX_HANDOFF_REVISIONS,
  type Revision,
  type RevisionsRequest,
} from "../../shared/api";
import {
  isRecord,
  MAX_TEXT_LENGTH,
  optionalText,
  type Parsed,
  parseFields,
  urduText,
} from "./vocab-input";

const PROPOSAL_FIELDS = new Set(["urdu", ...FILLABLE_FIELDS, "tags"]);
const REVISION_FIELDS = new Set(["vocab_id", "urdu", ...FILLABLE_FIELDS]);
const CORRECTION_FIELDS = new Set([...REVISION_FIELDS, "reason", "urdu_suggestion"]);
const ACCEPT_FIELDS = new Set(["vocab_id", "fields", "reset"]);

const fail = (field: string | undefined, message: string) =>
  ({ ok: false, error: { field, message } }) as const;

// Prefixes an item's field path, so the reason names the entry: proposals[2].roman.
function at<T>(path: string, parsed: Parsed<T>): Parsed<T> {
  if (parsed.ok) return parsed;
  const field = parsed.error.field ? `${path}.${parsed.error.field}` : path;
  return fail(field, parsed.error.message);
}

function handoffId(value: unknown): Parsed<string> {
  if (typeof value !== "string" || value.trim() === "") {
    return fail("handoff_id", "is required and must be a non-empty string");
  }
  const id = value.trim();
  if (id.length > MAX_HANDOFF_ID_LENGTH) {
    return fail("handoff_id", `must be at most ${MAX_HANDOFF_ID_LENGTH} characters`);
  }
  return { ok: true, value: id };
}

function unknownKey(body: Record<string, unknown>, allowed: Set<string>): string | undefined {
  return Object.keys(body).find((key) => !allowed.has(key));
}

function list(
  body: Record<string, unknown>,
  field: string,
  max: number,
  allowEmpty = false,
): Parsed<unknown[]> {
  const value = body[field];
  if (!Array.isArray(value)) return fail(field, "is required and must be an array");
  if (value.length === 0 && !allowEmpty) return fail(field, "must not be empty");
  if (value.length > max) return fail(field, `must have at most ${max} entries`);
  return { ok: true, value };
}

function proposal(value: unknown): Parsed<HandoffProposal> {
  if (!isRecord(value)) return fail(undefined, "must be an object");
  const extra = unknownKey(value, PROPOSAL_FIELDS);
  if (extra) return fail(extra, "is not a recognised field");
  if (!("urdu" in value)) return fail("urdu", "is required and must be a string");
  const fields = parseFields(value);
  if (!fields.ok) return fields;
  return { ok: true, value: fields.value as HandoffProposal };
}

export function parseHandoff(body: unknown): Parsed<HandoffRequest> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  if ("results" in body) {
    return fail("results", "review results are not accepted yet; send proposals only");
  }
  const extra = unknownKey(body, new Set(["handoff_id", "session_at", "proposals"]));
  if (extra) return fail(extra, "is not a recognised field");

  const id = handoffId(body.handoff_id);
  if (!id.ok) return id;
  const sessionAt = body.session_at;
  if (typeof sessionAt !== "string" || Number.isNaN(Date.parse(sessionAt))) {
    return fail("session_at", "is required and must be an ISO 8601 date-time");
  }
  const items = list(body, "proposals", MAX_HANDOFF_PROPOSALS);
  if (!items.ok) return items;

  const proposals: HandoffProposal[] = [];
  for (const [i, item] of items.value.entries()) {
    const parsed = at(`proposals[${i}]`, proposal(item));
    if (!parsed.ok) return parsed;
    proposals.push(parsed.value);
  }
  return {
    ok: true,
    value: {
      handoff_id: id.value,
      session_at: new Date(sessionAt).toISOString(),
      proposals,
    },
  };
}

function vocabId(value: unknown): Parsed<string> {
  if (typeof value !== "string" || value.trim() === "") {
    return fail("vocab_id", "is required and must be a non-empty string");
  }
  return { ok: true, value: value.trim() };
}

function revision(value: unknown, allowed = REVISION_FIELDS): Parsed<Revision> {
  if (!isRecord(value)) return fail(undefined, "must be an object");
  const extra = unknownKey(value, allowed);
  if (extra) return fail(extra, "is not a recognised field");
  const id = vocabId(value.vocab_id);
  if (!id.ok) return id;
  const urdu = urduText(value.urdu);
  if (!urdu.ok) return urdu;
  const out: Revision = { vocab_id: id.value, urdu: urdu.value };
  for (const field of FILLABLE_FIELDS) {
    if (!(field in value)) continue;
    const text = optionalText(field, value[field]);
    if (!text.ok) return text;
    out[field] = text.value;
  }
  return { ok: true, value: out };
}

export function parseRevisions(body: unknown): Parsed<RevisionsRequest> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  const extra = unknownKey(body, new Set(["handoff_id", "revisions"]));
  if (extra) return fail(extra, "is not a recognised field");

  const id = handoffId(body.handoff_id);
  if (!id.ok) return id;
  const items = list(body, "revisions", MAX_HANDOFF_REVISIONS);
  if (!items.ok) return items;

  const revisions: Revision[] = [];
  const seen = new Set<string>();
  for (const [i, item] of items.value.entries()) {
    const parsed = at(`revisions[${i}]`, revision(item));
    if (!parsed.ok) return parsed;
    if (seen.has(parsed.value.vocab_id)) {
      return fail(`revisions[${i}].vocab_id`, "appears more than once");
    }
    seen.add(parsed.value.vocab_id);
    revisions.push(parsed.value);
  }
  return { ok: true, value: { handoff_id: id.value, revisions } };
}

// A correction is a revision that may also remove (null) and must say why. An empty or null
// urdu_suggestion is read as none.
function correction(value: unknown): Parsed<Correction> {
  const base = revision(value, CORRECTION_FIELDS);
  if (!base.ok) return base;
  const body = value as Record<string, unknown>;
  const reason = optionalText("reason", body.reason);
  if (!reason.ok) return reason;
  if (reason.value === null) return fail("reason", "is required and must be a non-empty string");
  const out: Correction = { ...base.value, reason: reason.value };
  if (body.urdu_suggestion != null && body.urdu_suggestion !== "") {
    const suggestion = urduText(body.urdu_suggestion);
    if (!suggestion.ok) return fail("urdu_suggestion", suggestion.error.message);
    out.urdu_suggestion = suggestion.value;
  }
  return { ok: true, value: out };
}

// Old values are compared exactly with the stored ones, so they are not trimmed.
function accepted(value: unknown, proposed: Correction | undefined): Parsed<CorrectionAccept> {
  if (!isRecord(value)) return fail(undefined, "must be an object");
  const extra = unknownKey(value, ACCEPT_FIELDS);
  if (extra) return fail(extra, "is not a recognised field");
  const id = vocabId(value.vocab_id);
  if (!id.ok) return id;
  if (!proposed) return fail("vocab_id", "has no correction in this paste");
  if (!isRecord(value.fields)) return fail("fields", "is required and must be an object");
  if (typeof value.reset !== "boolean") return fail("reset", "is required and must be a boolean");

  const fields: CorrectionAccept["fields"] = {};
  for (const [key, old] of Object.entries(value.fields)) {
    if (!(FILLABLE_FIELDS as readonly string[]).includes(key) || !(key in proposed)) {
      return fail(`fields.${key}`, "is not a field this correction proposes");
    }
    if (old !== null && (typeof old !== "string" || old.length > MAX_TEXT_LENGTH)) {
      return fail(`fields.${key}`, "must be the old value shown, a string or null");
    }
    fields[key as FillableField] = old;
  }
  if (Object.keys(fields).length === 0 && !value.reset) {
    return fail("fields", "must accept at least one field unless reset is true");
  }
  return { ok: true, value: { vocab_id: id.value, fields, reset: value.reset } };
}

// f11 (FR-F9). `corrections` may be empty: every item was fine. A preview must not carry
// `accept`; an apply must, and each entry must name a pasted correction and fields it proposes.
export function parseCorrections(body: unknown, preview: boolean): Parsed<CorrectionsRequest> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  const extra = unknownKey(body, new Set(["handoff_id", "corrections", "accept"]));
  if (extra) return fail(extra, "is not a recognised field");

  const id = handoffId(body.handoff_id);
  if (!id.ok) return id;
  const items = list(body, "corrections", MAX_CHECK_BATCH, true);
  if (!items.ok) return items;

  const corrections: Correction[] = [];
  const byId = new Map<string, Correction>();
  for (const [i, item] of items.value.entries()) {
    const parsed = at(`corrections[${i}]`, correction(item));
    if (!parsed.ok) return parsed;
    if (byId.has(parsed.value.vocab_id)) {
      return fail(`corrections[${i}].vocab_id`, "appears more than once");
    }
    byId.set(parsed.value.vocab_id, parsed.value);
    corrections.push(parsed.value);
  }
  const request: CorrectionsRequest = { handoff_id: id.value, corrections };

  if (preview) {
    return "accept" in body
      ? fail("accept", "is not accepted on a preview")
      : { ok: true, value: request };
  }
  const entries = list(body, "accept", MAX_CHECK_BATCH, true);
  if (!entries.ok) return entries;
  const accept: CorrectionAccept[] = [];
  const seen = new Set<string>();
  for (const [i, entry] of entries.value.entries()) {
    const target = isRecord(entry) && typeof entry.vocab_id === "string" ? entry.vocab_id : "";
    const parsed = at(`accept[${i}]`, accepted(entry, byId.get(target.trim())));
    if (!parsed.ok) return parsed;
    if (seen.has(parsed.value.vocab_id)) {
      return fail(`accept[${i}].vocab_id`, "appears more than once");
    }
    seen.add(parsed.value.vocab_id);
    accept.push(parsed.value);
  }
  return { ok: true, value: { ...request, accept } };
}
