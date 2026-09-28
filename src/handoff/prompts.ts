// f06: the ChatGPT round trip's prompts (FR-F6; f11/f13 FR-F9) and paste parsing. Pure, so the node
// project tests them. Each prompt carries a fresh handoff_id for the chat to echo, which makes a
// pasted reply idempotent: pasting it twice is a no-op in Urdu Core. The standing ChatGPT
// Project version of newVocabPrompt is chatgpt-project-instructions.md; keep the two in step.

import {
  type CheckOptions,
  FILLABLE_FIELDS,
  type FillableField,
  MAX_CHECK_BATCH,
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

// Chats break JSON by quoting a word inside a string value ("the hyphen and "haqiqat" look...").
// Asking them to escape is unreliable, so the prompt forbids the character instead; the code block
// gives ChatGPT's copy button, which copies the raw text rather than the rendered page.
const JSON_ONLY = `Reply with the JSON document alone, in one json code block: no prose before or after it, no comments inside it. It must be strict JSON that parses as it stands. Inside a text value, never use a double quotation mark or a backslash: to quote a word or spelling, use single quotes ('like this') or none. Before replying, check that the whole document parses. Leave a field out rather than guess.`;

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

// Each item as the chat sees it: its id, its urdu and every field it has. With `missing`, also the
// chosen fields it lacks, which a completeness check asks the chat to supply.
function listItems(items: readonly VocabItem[], missing?: readonly FillableField[]): string {
  const listed = items.map((item) => {
    const entry: Record<string, string | string[]> = { vocab_id: item.id, urdu: item.urdu };
    for (const field of FILLABLE_FIELDS) {
      const value = item[field];
      if (value !== null) entry[field] = value;
    }
    const lacks = missing?.filter((field) => item[field] === null) ?? [];
    if (lacks.length > 0) entry.missing = lacks;
    return entry;
  });
  return JSON.stringify(listed, null, 2);
}

const quoted = (fields: readonly FillableField[]) => fields.map((f) => `"${f}"`).join(", ");

// What a correctness check asks about each field, for the fields chosen.
const CHECKS: Readonly<Record<FillableField, string>> = {
  roman: 'is "roman" the spelling Pakistanis actually type',
  english: 'is "english" the right meaning in everyday Pakistani use',
  notes: 'are the "notes" accurate',
  example_urdu: 'is "example_urdu" natural everyday Urdu',
  example_english: 'does "example_english" translate the Urdu example',
};

// f11 (FR-F9), f13 modes. The handoff_id comes from the Worker, which recorded the batch under it
// with its mode and fields, so unlike the other prompts it is never minted here. The Worker also
// ignores any change the mode or fields don't allow, so the prompt only has to ask well.
export function checkPrompt(
  items: readonly VocabItem[],
  handoffId: string,
  { mode, fields }: Pick<CheckOptions, "mode" | "fields">,
): string {
  const correct = mode !== "completeness";
  const fill = mode !== "correctness";
  const task = [
    correct &&
      `Correctness: check only these fields of each item: ${quoted(fields)}. In particular: ${fields.map((f) => CHECKS[f]).join("; ")}? Correct a wrong value, or set it to null to remove it.${fill ? "" : " Never add a field an item doesn't have."}`,
    fill &&
      `Completeness: each item's "missing" lists the fields it lacks among ${quoted(fields)}. Supply every one of them, following the conventions.${correct ? "" : " Never change or remove a field an item already has."}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const opening =
    mode === "completeness"
      ? "You are completing entries in my Urdu vocabulary app."
      : mode === "both"
        ? "You are checking entries in my Urdu vocabulary app for accuracy and completing them."
        : "You are checking entries in my Urdu vocabulary app for accuracy.";
  return `${opening} Follow these conventions:

${CONVENTIONS}

${task}

Items:
${listItems(items, fill ? fields : undefined)}

Return only the items you change. For each, copy vocab_id and urdu exactly as given; include only the fields you change or supply, with their values; and give one short "reason" (plain words, e.g. 'added example'; single quotes, never double, around any spelling you cite). Never change "urdu". If you think its spelling is wrong, put the spelling you suggest in "urdu_suggestion". Other fields are shown for context only.

Return exactly this JSON shape, copying handoff_id as given:

{
  "handoff_id": "${handoffId}",
  "corrections": [
    { "vocab_id": "...", "urdu": "...", "english": "...", "reason": "..." }
  ]
}

If there is nothing to change, return "corrections": []. At most ${MAX_CHECK_BATCH} corrections. ${JSON_ONLY}
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
    return {
      ok: false,
      message: `That is not valid JSON (${reason}). Ask the chat to resend it as strict JSON, with no double quotes inside the text.`,
    };
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
