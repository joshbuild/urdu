import { describe, expect, it } from "vitest";
import type { VocabItem } from "../../shared/api";
import { buildUpdate as build, draftFromItem as draftFor } from "./edit";

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
  tags: ["nouns", "reading"],
  favourite: false,
  ladder_id: 3,
  ladder_step: 2,
  interval_seconds: 61094,
  added_at: "2026-09-01T00:00:00.000Z",
  last_reviewed_at: "2026-09-10T08:00:00.000Z",
  due_at: "2026-09-11T00:58:14.000Z",
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
    expect(draft.ladder_step).toBe(2);
  });
});

describe("buildUpdate", () => {
  it("is null when nothing changed, including whitespace-only differences", () => {
    const draft = { ...draftFromItem(item), english: " book ", tags: "nouns,reading" };
    expect(buildUpdate(item, draft)).toBeNull();
  });

  it("sends only changed fields", () => {
    const draft = { ...draftFromItem(item), english: "a book", ladder_step: 4 };
    expect(buildUpdate(item, draft)).toEqual({ english: "a book", ladder_step: 4 });
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

describe("rung edits across ladders", () => {
  // Legacy level 3 (25 days) sits nearest Moderate rung 6 (22.6 days).
  const legacy: VocabItem = {
    ...item,
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
