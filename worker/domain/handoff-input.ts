// Validation for clipboard handoffs (f06, FR-F4/F7). Strict: a payload with any bad field is
// rejected whole, with the field's path, and never repaired. Rejecting whole keeps a handoff_id
// unrecorded, so the corrected reply can be pasted again under the same id.

import {
  FILLABLE_FIELDS,
  type HandoffProposal,
  type HandoffRequest,
  MAX_HANDOFF_ID_LENGTH,
  MAX_HANDOFF_PROPOSALS,
  MAX_HANDOFF_REVISIONS,
  type Revision,
  type RevisionsRequest,
} from "../../shared/api";
import { isRecord, optionalText, type Parsed, parseFields, urduText } from "./vocab-input";

const PROPOSAL_FIELDS = new Set(["urdu", ...FILLABLE_FIELDS, "tags"]);
const REVISION_FIELDS = new Set(["vocab_id", "urdu", ...FILLABLE_FIELDS]);

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

function list(body: Record<string, unknown>, field: string, max: number): Parsed<unknown[]> {
  const value = body[field];
  if (!Array.isArray(value)) return fail(field, "is required and must be an array");
  if (value.length === 0) return fail(field, "must not be empty");
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

function revision(value: unknown): Parsed<Revision> {
  if (!isRecord(value)) return fail(undefined, "must be an object");
  const extra = unknownKey(value, REVISION_FIELDS);
  if (extra) return fail(extra, "is not a recognised field");
  if (typeof value.vocab_id !== "string" || value.vocab_id.trim() === "") {
    return fail("vocab_id", "is required and must be a non-empty string");
  }
  const urdu = urduText(value.urdu);
  if (!urdu.ok) return urdu;
  const out: Revision = { vocab_id: value.vocab_id.trim(), urdu: urdu.value };
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
