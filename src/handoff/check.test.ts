import { describe, expect, it } from "vitest";
import type { CorrectionPlan, CorrectionResult } from "../../shared/api";
import {
  acceptList,
  defaultTicks,
  isReported,
  isShown,
  tickable,
  toggleField,
  toggleReset,
} from "./check";

const plans: CorrectionPlan[] = [
  {
    vocab_id: "A",
    urdu: "a",
    outcome: "correct",
    changes: [
      { field: "roman", old: "paanee", new: "paani" },
      { field: "notes", old: "stiff", new: null },
      { field: "example_english", old: null, new: "Give me water." },
    ],
    reason: "spelling",
  },
  { vocab_id: "B", urdu: "b", outcome: "nothing", changes: [], reason: "fine" },
  {
    vocab_id: "C",
    urdu: "c",
    outcome: "nothing",
    changes: [],
    reason: "spelling",
    urdu_suggestion: "cc",
  },
  { vocab_id: "D", urdu: "d", outcome: "rejected", reason: "not in this batch" },
];

describe("isShown / tickable", () => {
  it("hides an unflagged nothing row and ticks neither rejected nor hidden rows", () => {
    expect(plans.map(isShown)).toEqual([true, false, true, true]);
    expect(tickable(plans).map((p) => p.vocab_id)).toEqual(["A", "C"]);
  });
});

describe("defaultTicks", () => {
  it("ticks every change and no reset", () => {
    expect(defaultTicks(plans)).toEqual({
      A: { fields: { roman: true, notes: true, example_english: true }, reset: false },
      C: { fields: {}, reset: false },
    });
  });
});

describe("acceptList", () => {
  it("sends every ticked field with the old value the preview showed", () => {
    expect(acceptList(plans, defaultTicks(plans))).toEqual([
      {
        vocab_id: "A",
        fields: { roman: "paanee", notes: "stiff", example_english: null },
        reset: false,
      },
    ]);
  });

  it("drops an unticked field and keeps a reset-only item", () => {
    let ticks = toggleField(defaultTicks(plans), "A", "notes");
    ticks = toggleReset(ticks, "C");
    expect(acceptList(plans, ticks)).toEqual([
      { vocab_id: "A", fields: { roman: "paanee", example_english: null }, reset: false },
      { vocab_id: "C", fields: {}, reset: true },
    ]);
  });

  it("keeps an item whose fields are all unticked but whose reset is ticked", () => {
    let ticks = defaultTicks(plans);
    for (const field of ["roman", "notes", "example_english"] as const) {
      ticks = toggleField(ticks, "A", field);
    }
    expect(acceptList(plans, ticks)).toEqual([]);
    expect(acceptList(plans, toggleReset(ticks, "A"))).toEqual([
      { vocab_id: "A", fields: {}, reset: true },
    ]);
  });

  it("is empty (Mark checked) for an all-fine reply", () => {
    expect(acceptList([], defaultTicks([]))).toEqual([]);
  });

  it("ignores toggles for rows that cannot be ticked", () => {
    const ticks = defaultTicks(plans);
    expect(toggleReset(ticks, "D")).toBe(ticks);
    expect(toggleField(ticks, "B", "roman")).toBe(ticks);
  });
});

describe("isReported", () => {
  const checked = (over: Partial<Extract<CorrectionResult, { outcome: "checked" }>>) =>
    ({
      vocab_id: "A",
      urdu: "a",
      outcome: "checked",
      written: [],
      kept: [],
      declined: [],
      reset: "not_asked",
      reason: "r",
      ...over,
    }) satisfies CorrectionResult;

  it("reports anything that happened and skips a quiet row", () => {
    expect(isReported(checked({}))).toBe(false);
    expect(isReported(checked({ kept: ["roman"] }))).toBe(true);
    expect(isReported(checked({ declined: ["notes"] }))).toBe(true);
    expect(isReported(checked({ reset: "skipped" }))).toBe(true);
    expect(isReported(checked({ urdu_suggestion: "x" }))).toBe(true);
    expect(isReported({ vocab_id: "D", urdu: "d", outcome: "rejected", reason: "gone" })).toBe(
      true,
    );
  });
});
