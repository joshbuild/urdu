// f18 s05: the Project's topic file is generated from shared/topics.ts and must match it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOPICS } from "../shared/topics";
import { VOCAB_TAGS_PATH, vocabTagsMarkdown } from "./vocab-tags";

describe("vocabTagsMarkdown", () => {
  it("lists every topic slug once", () => {
    const md = vocabTagsMarkdown();
    for (const t of TOPICS) expect(md.split(`\`${t.slug}\``)).toHaveLength(2);
  });

  it("matches the committed prompts/vocab-tags.md (run scripts/write-vocab-tags.ts)", () => {
    const committed = readFileSync(VOCAB_TAGS_PATH, "utf8").replace(/\r\n/g, "\n");
    expect(committed).toBe(vocabTagsMarkdown());
  });
});
