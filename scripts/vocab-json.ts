// mp08 s04: `prompts/vocab-json.md`, the `vocab-json` command for the ChatGPT "Urdu Coach"
// Project, written from shared/vocab-entry.ts so it never drifts from the in-app new-vocab prompt.
// The sponsor uploads it to the Project's files; the Project instructions keep only a trigger line
// pointing here. Pure; `write-vocab-json.ts` writes it.

import { MAX_HANDOFF_PROPOSALS } from "../shared/api";
import { ENTRY_CHECK, ENTRY_EXAMPLE, entryFieldRules } from "../shared/vocab-entry";

export const VOCAB_JSON_PATH = "prompts/vocab-json.md";

export function vocabJsonMarkdown(): string {
  return `# The \`vocab-json\` command

Follow this when I type \`vocab-json\` in this Project. The topic list it uses is the Project file \`vocab-tags.md\`.

When I type \`vocab-json\` (optionally followed by words), turn the new vocabulary from this conversation — the list you most recently gave me, plus any words I add after the command — into one JSON document for my vocabulary app. If I write "only these words" after the command, use just the words I list, none from earlier in the chat. One entry per word or phrase; a phrase learned as a unit is one entry, not split into words. Skip words I say I already know.

${entryFieldRules("the topic list in the Project file `vocab-tags.md`")}

Return exactly this shape, in a single json code block:

{
  "handoff_id": "vocab-YYYYMMDD-xxxxxx",
  "session_at": "YYYY-MM-DDTHH:MM:SSZ",
  "proposals": [
    ${ENTRY_EXAMPLE}
  ]
}

Rules:

- handoff_id: "vocab-", today's date as YYYYMMDD, "-", then 6 random lowercase letters and digits. Make a new one every time I type the command; never reuse one from earlier in the chat.
- session_at: the current date and time in UTC; if you don't know the time, use today's date with T12:00:00Z.
- Use only the keys shown above; no other keys. At most ${MAX_HANDOFF_PROPOSALS} proposals: if there are more, include the first ${MAX_HANDOFF_PROPOSALS} and I will ask for the rest.
- The code block alone: no prose before or after it, no comments inside it.
- Strict JSON that parses as it stands. Inside a text value, never use a double quotation mark or a backslash: to quote a word, use single quotes ('like this') or none.
- Before replying, check that ${ENTRY_CHECK} in \`vocab-tags.md\`, and that the whole document parses.

<!-- Generated from shared/vocab-entry.ts by \`pnpm tsx scripts/write-vocab-json.ts\`; do not edit. -->
`;
}
