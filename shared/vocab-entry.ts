// mp08 s04: what a new vocab entry from ChatGPT holds, in the words the chat sees. One source for
// the in-app new-vocab prompt (src/handoff/prompts.ts) and the Project's `vocab-json.md`
// (scripts/vocab-json.ts), so the two never drift. The wording is the daily-used `vocab-json`
// one, fixed 2026-10-02 to require every field: optional fields were dropped on long lists. The
// Worker still accepts entries without them (worker/domain/handoff-input.ts).

// Where the chat finds the topic list: the in-app prompt carries it, the Project has it as a file.
export function entryFieldRules(topicList: string): string {
  return `Every entry has all nine fields below, filled in. No field is optional, however long the list. Fill each one with your best everyday answer; a reasonable usage note or a simple example sentence is not a guess.

- "urdu": the word or phrase in Urdu script, as people in Pakistan actually say and write it (not Hindi, not formal Arabic or Persian register).
- "roman": practical Roman Urdu as Pakistanis type it (e.g. "kitaab", "shukriya", "kya haal hai"), not academic transliteration.
- "english": a concise English meaning, a few words. If it has two common senses, give both, separated by a semicolon.
- "notes": one short line. For a noun, start with its gender (m. or f.); for a verb, give the infinitive if the entry isn't one. Then add the most useful thing about usage, register (everyday, formal, Punjabi-influenced, English loan) or a common confusion.
- "example_urdu": one short everyday sentence in Urdu script that uses the entry.
- "example_english": the English translation of that sentence.
- "topic": the one slug from ${topicList} where the entry belongs most, exactly as written there.
- "cefr": the CEFR level at which a learner usually meets the entry: A1, A2, B1, B2, C1 or C2.
- "tags": an array of 0 to 2 other slugs from that list where the entry clearly also belongs, never the topic itself; [] if none.`;
}

// A filled-in entry: an example of "..." taught the chat to leave fields as "...".
export const ENTRY_EXAMPLE =
  '{ "urdu": "کتاب", "roman": "kitaab", "english": "book", "notes": "f. Everyday and formal alike; plural کتابیں.", "example_urdu": "یہ کتاب بہت اچھی ہے۔", "example_english": "This book is very good.", "topic": "school", "cefr": "A1", "tags": [] }';

export const ENTRY_CHECK =
  "every entry has all nine keys with non-empty values (tags may be []), every topic and tag is a slug from the list";
