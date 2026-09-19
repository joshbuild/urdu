// Validation for the voice Coach's tool calls (f07). The arguments come from a model, so they are
// checked as strictly as a clipboard handoff: a bad field is rejected with its path, and the
// browser hands that message back to the model instead of the call being repaired.

import {
  MAX_VOICE_ID_LENGTH,
  PROMPT_SUPPORTS,
  type PromptSupport,
  type VocabFields,
} from "../../shared/api";
import { type Grade, isGrade } from "../../shared/mastery";
import { isRecord, type Parsed, parseFields, urduText } from "./vocab-input";

export const DEFAULT_VOICE_VOCAB_LIMIT = 10;
export const MAX_VOICE_VOCAB_LIMIT = 50;
export const MAX_VOICE_ADD_ITEMS = 10;

const fail = (field: string | undefined, message: string) =>
  ({ ok: false, error: { field, message } }) as const;

function extraKey(body: Record<string, unknown>, allowed: readonly string[]): string | undefined {
  return Object.keys(body).find((key) => !allowed.includes(key));
}

function voiceId(body: Record<string, unknown>, field: string): Parsed<string> {
  const value = body[field];
  if (typeof value !== "string" || value.trim() === "") {
    return fail(field, "is required and must be a non-empty string");
  }
  const id = value.trim();
  if (id.length > MAX_VOICE_ID_LENGTH) {
    return fail(field, `must be at most ${MAX_VOICE_ID_LENGTH} characters`);
  }
  return { ok: true, value: id };
}

export type VoiceCall = { sessionId: string; callId: string; args: Record<string, unknown> };

export function parseEnvelope(body: unknown): Parsed<VoiceCall> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  const extra = extraKey(body, ["session_id", "call_id", "arguments"]);
  if (extra) return fail(extra, "is not a recognised field");
  const sessionId = voiceId(body, "session_id");
  if (!sessionId.ok) return sessionId;
  const callId = voiceId(body, "call_id");
  if (!callId.ok) return callId;
  const args = body.arguments ?? {};
  if (!isRecord(args)) return fail("arguments", "must be a JSON object");
  return { ok: true, value: { sessionId: sessionId.value, callId: callId.value, args } };
}

export type GetVocabArgs = { scope: "due" | "all"; tag?: string; limit: number };

export function parseGetVocab(args: Record<string, unknown>): Parsed<GetVocabArgs> {
  const extra = extraKey(args, ["scope", "tag", "limit"]);
  if (extra) return fail(extra, "is not a recognised field");
  const scope = args.scope ?? "due";
  if (scope !== "due" && scope !== "all") return fail("scope", "must be due or all");
  const limit = args.limit ?? DEFAULT_VOICE_VOCAB_LIMIT;
  if (
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_VOICE_VOCAB_LIMIT
  ) {
    return fail("limit", `must be an integer from 1 to ${MAX_VOICE_VOCAB_LIMIT}`);
  }
  let tag: string | undefined;
  if (args.tag !== undefined && args.tag !== null) {
    if (typeof args.tag !== "string") return fail("tag", "must be a string");
    tag = args.tag.trim() || undefined;
  }
  return { ok: true, value: { scope, tag, limit } };
}

export type AddItem = Pick<VocabFields, "urdu"> &
  Partial<Pick<VocabFields, "roman" | "english" | "kind">>;

export function parseAddToVault(args: Record<string, unknown>): Parsed<AddItem[]> {
  const extra = extraKey(args, ["items"]);
  if (extra) return fail(extra, "is not a recognised field");
  const items = args.items;
  if (!Array.isArray(items) || items.length === 0) {
    return fail("items", "is required and must be a non-empty array");
  }
  if (items.length > MAX_VOICE_ADD_ITEMS) {
    return fail("items", `must have at most ${MAX_VOICE_ADD_ITEMS} entries`);
  }
  const out: AddItem[] = [];
  for (const [i, item] of items.entries()) {
    const path = `items[${i}]`;
    if (!isRecord(item)) return fail(path, "must be an object");
    const bad = extraKey(item, ["urdu", "roman", "english", "kind"]);
    if (bad) return fail(`${path}.${bad}`, "is not a recognised field");
    if (!("urdu" in item)) return fail(`${path}.urdu`, "is required and must be a string");
    const fields = parseFields(item);
    if (!fields.ok) {
      const field = fields.error.field ? `${path}.${fields.error.field}` : path;
      return fail(field, fields.error.message);
    }
    out.push(fields.value as AddItem);
  }
  return { ok: true, value: out };
}

export type RecordReviewArgs = {
  vocabId?: string;
  urdu?: string;
  grade: Grade;
  promptSupport: PromptSupport;
};

export function parseRecordReview(args: Record<string, unknown>): Parsed<RecordReviewArgs> {
  const extra = extraKey(args, ["vocab_id", "urdu", "grade", "prompt_support"]);
  if (extra) return fail(extra, "is not a recognised field");
  if (!isGrade(args.grade)) {
    return fail("grade", "must be one of wrong, partial, hesitant, correct, confident");
  }
  if (!(PROMPT_SUPPORTS as readonly unknown[]).includes(args.prompt_support)) {
    return fail("prompt_support", `must be one of ${PROMPT_SUPPORTS.join(", ")}`);
  }
  const value: RecordReviewArgs = {
    grade: args.grade,
    promptSupport: args.prompt_support as PromptSupport,
  };
  if (args.vocab_id !== undefined && args.vocab_id !== null) {
    if (typeof args.vocab_id !== "string") return fail("vocab_id", "must be a string");
    value.vocabId = args.vocab_id.trim() || undefined;
  }
  if (args.urdu !== undefined && args.urdu !== null) {
    const urdu = urduText(args.urdu);
    if (!urdu.ok) return urdu;
    value.urdu = urdu.value;
  }
  if (!value.vocabId && !value.urdu) return fail("vocab_id", "vocab_id or urdu is required");
  return { ok: true, value };
}
