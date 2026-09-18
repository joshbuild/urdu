import { describe, expect, it } from "vitest";
import type { VocabItem } from "../../shared/api";
import { buildUpdate, draftFromItem } from "./edit";

const item: VocabItem = {
  id: "01J",
  urdu: "کتاب",
  urdu_key: "کتاب",
  kind: "word",
  roman: "kitaab",
  english: "book",
  notes: null,
  example_urdu: null,
  example_english: null,
  tags: ["nouns", "reading"],
  favourite: false,
  mastery: 2,
  added_at: "2026-09-01T00:00:00.000Z",
  last_reviewed_on: "2026-09-10",
  next_review_on: "2026-09-15",
  source: "airtable",
  airtable_id: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

describe("draftFromItem", () => {
  it("turns nulls into empty fields and tags into comma text", () => {
    const draft = draftFromItem(item);
    expect(draft.notes).toBe("");
    expect(draft.tags).toBe("nouns, reading");
    expect(draft.mastery).toBe(2);
  });
});

describe("buildUpdate", () => {
  it("is null when nothing changed, including whitespace-only differences", () => {
    const draft = { ...draftFromItem(item), english: " book ", tags: "nouns,reading" };
    expect(buildUpdate(item, draft)).toBeNull();
  });

  it("sends only changed fields", () => {
    const draft = { ...draftFromItem(item), english: "a book", mastery: 4 as const };
    expect(buildUpdate(item, draft)).toEqual({ english: "a book", mastery: 4 });
  });

  it("clears an emptied optional field with null", () => {
    expect(buildUpdate(item, { ...draftFromItem(item), roman: "  " })).toEqual({ roman: null });
  });

  it("sends the whole tag list when tags change, order included", () => {
    expect(buildUpdate(item, { ...draftFromItem(item), tags: "reading, nouns" })).toEqual({
      tags: ["reading", "nouns"],
    });
    expect(buildUpdate(item, { ...draftFromItem(item), tags: "" })).toEqual({ tags: [] });
  });

  it("sends urdu and kind edits trimmed", () => {
    const draft = { ...draftFromItem(item), urdu: " کتابیں ", kind: "phrase" as const };
    expect(buildUpdate(item, draft)).toEqual({ urdu: "کتابیں", kind: "phrase" });
  });
});
