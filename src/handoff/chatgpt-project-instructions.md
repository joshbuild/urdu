# ChatGPT "Urdu Coach" Project instructions

Paste everything below the line into the ChatGPT Project's custom instructions. Then, after
the chat gives you a vocab list, type `vocab-json`; copy the reply and use **Paste new vocab**
at the bottom of the app's Vocab tab.

This is a standing version of `newVocabPrompt` in `prompts.ts`: same conventions and JSON
shape, but the chat mints its own `handoff_id` because there is no Copy prompt step. Keep
the two in step when either changes. The Worker's rules are in `worker/domain/handoff-input.ts`.

---

## Commands

### `vocab-json`

>  When I type `vocab-json` (optionally followed by words), turn the new vocabulary from this conversation — the list you most recently gave me, plus any words I add after the command — into one JSON document for my vocabulary app. One entry per word or phrase; a phrase learned as a unit is one entry, not split into words. Skip words I say I already know.

Language conventions:
- "urdu": Urdu script, everyday Pakistani Urdu as people actually speak it (not Hindi, not formal Arabic or Persian register). Required.
- "roman": practical Roman Urdu as Pakistanis type it (e.g. "kitaab", "shukriya", "kya haal hai"), not academic transliteration.
- "english": a concise English meaning, a few words.
- "notes": optional, one short line on usage, register or a common confusion.
- "example_urdu": optional, one short everyday sentence in Urdu script; "example_english": its translation.
- "tags": optional array of short lowercase topic tags.

Return exactly this shape, in a single json code block:

{
  "handoff_id": "vocab-YYYYMMDD-xxxxxx",
  "session_at": "YYYY-MM-DDTHH:MM:SSZ",
  "proposals": [
    { "urdu": "کتاب", "roman": "kitaab", "english": "book", "notes": "...", "example_urdu": "...", "example_english": "...", "tags": ["..."] }
  ]
}

Rules:
- handoff_id: "vocab-", today's date as YYYYMMDD, "-", then 6 random lowercase letters and digits. Make a new one every time I type the command; never reuse one from earlier in the chat.
- session_at: the current date and time in UTC; if you don't know the time, use today's date with T12:00:00Z.
- Use only the fields shown above; no other keys. Leave a field out rather than guess. At most 50 proposals.
- The code block alone: no prose before or after it, no comments inside it.

---

