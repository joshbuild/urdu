// f18 s05: `prompts/vocab-tags.md`, the topic list for the ChatGPT "Urdu Coach" Project, written
// from `shared/topics.ts` so the two never drift. The sponsor uploads the file to the Project, and
// its `vocab-json` command takes `topic` and `tags` from it. Pure; `write-vocab-tags.ts` writes it.

import { TOPIC_BOUNDARIES, TOPIC_SECTIONS, TOPICS } from "../shared/topics";

export const VOCAB_TAGS_PATH = "prompts/vocab-tags.md";

export function vocabTagsMarkdown(): string {
  const lines = [
    "# Vocab topics",
    "",
    "The topic list for my vocabulary app. Every entry has one `topic` slug from this list, the",
    "one where it belongs most, and 0 to 2 `tags`: other slugs from this list where it clearly also",
    "belongs, never the topic itself. Use the slugs exactly as written.",
    "",
    `Boundaries: ${TOPIC_BOUNDARIES}`,
  ];
  for (const section of TOPIC_SECTIONS) {
    lines.push("", `## ${section.label}`, "");
    for (const t of TOPICS.filter((topic) => topic.section === section.id)) {
      lines.push(`- \`${t.slug}\` (${t.label}): ${t.scope}`);
    }
  }
  lines.push(
    "",
    "<!-- Generated from shared/topics.ts by `pnpm tsx scripts/write-vocab-tags.ts`; do not edit. -->",
    "",
  );
  return lines.join("\n");
}
