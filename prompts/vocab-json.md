# `vocab-json` command (ChatGPT "Urdu Coach" Project)

The `vocab-json` section of `urdu-coach-project-instructions.md`, on its own. Paste the full
instructions file into the Project, not just this one; keep the two copies identical.

Fixed 2026-10-02: the old wording marked notes, examples and tags "optional" and said "leave a
field out rather than guess", so the chat dropped them, worst on long lists. Every field is now
required, and the example entry is filled in rather than showing `"..."`. The Worker still
accepts entries without the optional fields (`worker/domain/handoff-input.ts`). Only the prompt
changed.

---

### `vocab-json`

>  When I type `vocab-json` (optionally followed by words), turn the new vocabulary from this conversation — the list you most recently gave me, plus any words I add after the command — into one JSON document for my vocabulary app. If I write "only these words" after the command, use just the words I list, none from earlier in the chat. One entry per word or phrase; a phrase learned as a unit is one entry, not split into words. Skip words I say I already know.

Every entry has all seven fields below, filled in. No field is optional, however long the list. Fill each one with your best everyday answer; a reasonable usage note or a simple example sentence is not a guess.

- "urdu": the word or phrase in Urdu script, as people in Pakistan actually say and write it (not Hindi, not formal Arabic or Persian register).
- "roman": practical Roman Urdu as Pakistanis type it (e.g. "kitaab", "shukriya", "kya haal hai"), not academic transliteration.
- "english": a concise English meaning, a few words. If it has two common senses, give both, separated by a semicolon.
- "notes": one short line. For a noun, start with its gender (m. or f.); for a verb, give the infinitive if the entry isn't one. Then add the most useful thing about usage, register (everyday, formal, Punjabi-influenced, English loan) or a common confusion.
- "example_urdu": one short everyday sentence in Urdu script that uses the entry.
- "example_english": the English translation of that sentence.
- "tags": an array of 1 to 3 short lowercase topic tags (e.g. "food", "family", "verbs", "greetings").

Return exactly this shape, in a single json code block:

{
  "handoff_id": "vocab-YYYYMMDD-xxxxxx",
  "session_at": "YYYY-MM-DDTHH:MM:SSZ",
  "proposals": [
    { "urdu": "کتاب", "roman": "kitaab", "english": "book", "notes": "f. Everyday and formal alike; plural کتابیں.", "example_urdu": "یہ کتاب بہت اچھی ہے۔", "example_english": "This book is very good.", "tags": ["objects", "school"] }
  ]
}

Rules:

- handoff_id: "vocab-", today's date as YYYYMMDD, "-", then 6 random lowercase letters and digits. Make a new one every time I type the command; never reuse one from earlier in the chat.
- session_at: the current date and time in UTC; if you don't know the time, use today's date with T12:00:00Z.
- Use only the keys shown above; no other keys. At most 50 proposals: if there are more, include the first 50 and I will ask for the rest.
- The code block alone: no prose before or after it, no comments inside it.
- Strict JSON that parses as it stands. Inside a text value, never use a double quotation mark or a backslash: to quote a word, use single quotes ('like this') or none.
- Before replying, check two things: every entry has all seven keys with non-empty values, and the whole document parses.
