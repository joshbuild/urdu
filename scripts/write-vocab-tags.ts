// f18 s05: regenerate `prompts/vocab-tags.md` after editing `shared/topics.ts`.
//
//   pnpm tsx scripts/write-vocab-tags.ts
//
// `scripts/vocab-tags.test.ts` fails until the file matches, so a topic change cannot ship with a
// stale Project file.

import { writeFileSync } from "node:fs";
import { VOCAB_TAGS_PATH, vocabTagsMarkdown } from "./vocab-tags";

writeFileSync(VOCAB_TAGS_PATH, vocabTagsMarkdown(), "utf8");
console.log(`wrote ${VOCAB_TAGS_PATH}`);
