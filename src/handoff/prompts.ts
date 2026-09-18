// f06: the ChatGPT round trip's prompts (FR-F6, FR-F7) and paste parsing. Pure, so the node
// project tests them. Each prompt carries a fresh handoff_id for the chat to echo, which makes a
// pasted reply idempotent: pasting it twice is a no-op in Urdu Core.

import {
  FILLABLE_FIELDS,
  type FillableField,
  MAX_HANDOFF_PROPOSALS,
  type VocabItem,
} from "../../shared/api";
import { ulid } from "../../shared/ulid";

const CONVENTIONS = `Language conventions:
- Everyday Pakistani Urdu as people actually speak it, in Urdu script (not Hindi, not formal Arabic or Persian register).
- "roman": practical Roman Urdu as Pakistanis type it (e.g. "kitaab", "shukriya", "kya haal hai"), not academic transliteration.
- "english": a concise English meaning, a few words.
- "notes": optional, one short line on usage, register or a common confusion.
- "example_urdu": optional, one short everyday sentence in Urdu script; "example_english": its translation.`;

const JSON_ONLY = `Reply with the JSON document alone: no prose before or after it, no comments. Leave a field out rather than guess.`;

export function newVocabPrompt(handoffId: string = ulid(), sessionAt = new Date()): string {
  return `You are helping me add Urdu vocabulary to my learning app. For each word or phrase I give you below, draft one vocabulary entry. A phrase that is learned as a unit is one entry, not split into words.

${CONVENTIONS}
- "tags": optional array of short lowercase topic tags.

Return exactly this JSON shape, copying handoff_id and session_at as given:

{
  "handoff_id": "${handoffId}",
  "session_at": "${sessionAt.toISOString()}",
  "proposals": [
    { "urdu": "کتاب", "roman": "kitaab", "english": "book", "notes": "...", "example_urdu": "...", "example_english": "...", "tags": ["..."] }
  ]
}

"urdu" is required on every proposal; every other field is optional. At most ${MAX_HANDOFF_PROPOSALS} proposals. ${JSON_ONLY}

My words (Urdu, Roman Urdu or English — if English, give the everyday Urdu for it):
`;
}

// The fields an item lacks, which are what the fill-in prompt asks for.
export function missingFields(item: VocabItem): FillableField[] {
  return FILLABLE_FIELDS.filter((field) => item[field] === null);
}

export function fillInPrompt(items: readonly VocabItem[], handoffId: string = ulid()): string {
  const listed = items.map((item) => {
    const entry: Record<string, string> = { vocab_id: item.id, urdu: item.urdu };
    for (const field of FILLABLE_FIELDS) {
      const value = item[field];
      if (value !== null) entry[field] = value;
    }
    return entry;
  });
  return `You are helping me complete entries in my Urdu vocabulary app. Each item below is missing some fields. For each item, supply only the fields it lacks, among: ${FILLABLE_FIELDS.join(", ")}. Do not repeat or change fields it already has, and keep "urdu" exactly as given so I can match your reply to the item.

${CONVENTIONS}

Items:
${JSON.stringify(listed, null, 2)}

Return exactly this JSON shape, copying handoff_id as given, one revision per item, with vocab_id and urdu copied from the item:

{
  "handoff_id": "${handoffId}",
  "revisions": [
    { "vocab_id": "...", "urdu": "...", "roman": "...", "english": "..." }
  ]
}

${JSON_ONLY}
`;
}

export type Pasted = { ok: true; value: unknown } | { ok: false; message: string };

// Chat replies often come wrapped in a markdown code fence; the fence is packaging, so it is
// removed. Nothing inside the JSON is ever repaired: invalid JSON is reported as it is.
export function parsePasted(text: string): Pasted {
  let body = text.trim();
  const fenced = body.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  if (fenced) body = (fenced[1] ?? "").trim();
  if (body === "") return { ok: false, message: "Paste the chat's JSON reply first." };
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unreadable";
    return { ok: false, message: `That is not valid JSON (${reason}). Ask the chat to resend it.` };
  }
}

// The Worker's 400 body as one line: "proposals[2].roman must be a string or null".
export function describeInvalid(body: { field?: string; message: string }): string {
  return body.field ? `${body.field} ${body.message}` : body.message;
}

export const FIELD_LABELS: Readonly<Record<FillableField, string>> = {
  roman: "Roman",
  english: "English",
  notes: "Notes",
  example_urdu: "Example",
  example_english: "Example (English)",
};
