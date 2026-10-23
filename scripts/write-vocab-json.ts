// mp08 s04: regenerate `prompts/vocab-json.md` after editing `shared/vocab-entry.ts`.
//
//   pnpm tsx scripts/write-vocab-json.ts
//
// `scripts/vocab-json.test.ts` fails until the file matches, so a wording change cannot ship with
// a stale Project file.

import { writeFileSync } from "node:fs";
import { VOCAB_JSON_PATH, vocabJsonMarkdown } from "./vocab-json";

writeFileSync(VOCAB_JSON_PATH, vocabJsonMarkdown(), "utf8");
console.log(`wrote ${VOCAB_JSON_PATH}`);
