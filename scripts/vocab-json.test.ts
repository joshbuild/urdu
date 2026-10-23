// mp08 s04: the Project's vocab-json file is generated from shared/vocab-entry.ts and must match
// it; the Project instructions keep only a trigger line pointing to it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { entryFieldRules } from "../shared/vocab-entry";
import { VOCAB_JSON_PATH, vocabJsonMarkdown } from "./vocab-json";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const INSTRUCTIONS = "prompts/urdu-coach-project-instructions.md";

describe("vocabJsonMarkdown", () => {
  it("carries the entry rules, pointing at the Project's topic file", () => {
    const md = vocabJsonMarkdown();
    expect(md).toContain(entryFieldRules("the topic list in the Project file `vocab-tags.md`"));
    expect(md).toContain('"handoff_id": "vocab-YYYYMMDD-xxxxxx"');
    expect(md).not.toContain('"..."');
  });

  it("matches the committed prompts/vocab-json.md (run scripts/write-vocab-json.ts)", () => {
    expect(read(VOCAB_JSON_PATH)).toBe(vocabJsonMarkdown());
  });

  it("leaves the Project instructions a trigger line, not a second copy", () => {
    const instructions = read(INSTRUCTIONS);
    expect(instructions).toContain("### `vocab-json`");
    expect(instructions).toContain("`vocab-json.md`");
    expect(instructions).not.toContain("No field is optional");
  });
});
