import { describe, expect, it } from "vitest";
import type { VocabItem } from "../../shared/api";
import { buildUpdate as build, draftFromItem as draftFor, legacyTags } from "./edit";

const ACTIVE = 3;
const draftFromItem = (i: VocabItem) => draftFor(i, ACTIVE);
const buildUpdate = (i: VocabItem, d: ReturnType<typeof draftFromItem>) => build(i, d, ACTIVE);

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
  topic: "school",
  cefr: "A1",
  tags: ["home", "nouns"],
  favourite: false,
  ladder_id: 3,
  ladder_step: 2,
  interval_seconds: 61094,
  added_at: "2026-09-01T00:00:00.000Z",
  last_reviewed_at: "2026-09-10T08:00:00.000Z",
  due_at: "2026-09-11T00:58:14.000Z",
  source: "airtable",
  airtable_id: null,
  checked_at: null,
  filled_at: null,
  harvest_id: null,
  released_at: "2026-09-01T00:00:00.000Z",
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
};

describe("draftFromItem", () => {
  it("turns nulls into empty fields and keeps only known secondary slugs", () => {
    const draft = draftFromItem(item);
    expect(draft.notes).toBe("");
    expect(draft).toMatchObject({ topic: "school", cefr: "A1", tags: ["home"] });
    expect(draft.ladder_step).toBe(2);
  });

  it("names legacy free tags, which a save drops", () => {
    expect(legacyTags(item)).toEqual(["nouns"]);
  });
});

describe("buildUpdate", () => {
  it("is null when nothing changed, including whitespace-only differences", () => {
    const clean = { ...item, tags: ["home"] };
    expect(buildUpdate(clean, { ...draftFromItem(clean), english: " book " })).toBeNull();
  });

  it("drops legacy tags with any other change", () => {
    expect(buildUpdate(item, { ...draftFromItem(item), english: "a book" })).toEqual({
      english: "a book",
      tags: ["home"],
    });
  });

  it("sends only changed fields", () => {
    const clean = { ...item, tags: ["home"] };
    const draft = { ...draftFromItem(clean), english: "a book", ladder_step: 4 };
    expect(buildUpdate(clean, draft)).toEqual({ english: "a book", ladder_step: 4 });
  });

  it("sends a changed topic or level, null when cleared, and keeps tags off the topic", () => {
    const clean = { ...item, tags: ["home"] };
    expect(buildUpdate(clean, { ...draftFromItem(clean), topic: "home" })).toEqual({
      topic: "home",
      tags: [],
    });
    expect(buildUpdate(clean, { ...draftFromItem(clean), cefr: "" })).toEqual({ cefr: null });
  });

  it("clears an emptied optional field with null", () => {
    const clean = { ...item, tags: ["home"] };
    expect(buildUpdate(clean, { ...draftFromItem(clean), roman: "  " })).toEqual({ roman: null });
  });

  it("sends the whole tag list when tags change, order included", () => {
    const clean = { ...item, tags: ["home", "food"] };
    expect(buildUpdate(clean, { ...draftFromItem(clean), tags: ["food", "home"] })).toEqual({
      tags: ["food", "home"],
    });
    expect(buildUpdate(clean, { ...draftFromItem(clean), tags: ["", ""] })).toEqual({ tags: [] });
  });

  it("sends urdu and kind edits trimmed", () => {
    const clean = { ...item, tags: ["home"] };
    const draft = { ...draftFromItem(clean), urdu: " کتابیں ", kind: "phrase" as const };
    expect(buildUpdate(clean, draft)).toEqual({ urdu: "کتابیں", kind: "phrase" });
  });
});

describe("rung edits across ladders", () => {
  // Legacy level 3 (25 days) sits nearest Moderate rung 6 (22.6 days).
  const legacy: VocabItem = {
    ...item,
    tags: [],
    ladder_id: 1,
    ladder_step: 3,
    interval_seconds: 25 * 86_400,
  };

  it("offers the active rung the item would move to, and sends nothing if it is kept", () => {
    expect(draftFromItem(legacy).ladder_step).toBe(6);
    expect(buildUpdate(legacy, draftFromItem(legacy))).toBeNull();
  });

  it("sends the rung when it is changed", () => {
    expect(buildUpdate(legacy, { ...draftFromItem(legacy), ladder_step: 5 })).toEqual({
      ladder_step: 5,
    });
  });
});
