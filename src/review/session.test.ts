import { describe, expect, it } from "vitest";
import type { VocabItem } from "../../shared/api";
import {
  AHEAD_STOPS,
  aheadStop,
  countWithin,
  currentItem,
  dueQuery,
  initialSession,
  promptSide,
  type SessionAction,
  type SessionState,
  sessionReducer,
} from "./session";

function item(id: string, english: string | null = "book"): VocabItem {
  return {
    id,
    urdu: "کتاب",
    urdu_key: "کتاب",
    kind: "word",
    roman: "kitaab",
    english,
    notes: null,
    example_urdu: null,
    example_english: null,
    tags: [],
    favourite: false,
    ladder_id: 3,
    ladder_step: 0,
    interval_seconds: 10800,
    added_at: "2026-09-01T00:00:00.000Z",
    last_reviewed_at: null,
    due_at: null,
    source: "manual",
    airtable_id: null,
    checked_at: null,
    filled_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

const run = (actions: SessionAction[], from: SessionState = initialSession) =>
  actions.reduce(sessionReducer, from);

const start: SessionAction = { type: "start", items: [item("a"), item("b")], direction: "ur_en" };

describe("sessionReducer", () => {
  it("starts on the first card, hidden", () => {
    const state = run([start]);
    expect(state.phase).toBe("card");
    expect(currentItem(state)?.id).toBe("a");
    if (state.phase === "card") expect(state.revealed).toBe(false);
  });

  it("an empty queue goes straight to the tally", () => {
    const state = run([{ type: "start", items: [], direction: "ur_en" }]);
    expect(state).toEqual({ phase: "done", tally: { graded: 0, skipped: 0 } });
  });

  it("will not grade before reveal", () => {
    const state = run([start, { type: "submit" }]);
    if (state.phase !== "card") throw new Error("expected card");
    expect(state.pending).toBe(false);
  });

  it("advances only once the grade is recorded, and counts it", () => {
    const pending = run([start, { type: "reveal" }, { type: "submit" }]);
    expect(currentItem(pending)?.id).toBe("a");
    const next = run([{ type: "recorded" }], pending);
    expect(currentItem(next)?.id).toBe("b");
    if (next.phase !== "card") throw new Error("expected card");
    expect(next.revealed).toBe(false);
    expect(next.tally).toEqual({ graded: 1, skipped: 0 });
  });

  it("blocks a second submit while one is in flight", () => {
    const pending = run([start, { type: "reveal" }, { type: "submit" }]);
    expect(run([{ type: "submit" }], pending)).toBe(pending);
  });

  it("keeps the card and shows the error when recording fails, then retries", () => {
    const failed = run([
      start,
      { type: "reveal" },
      { type: "submit" },
      { type: "failed", message: "offline" },
    ]);
    if (failed.phase !== "card") throw new Error("expected card");
    expect(failed.error).toBe("offline");
    expect(failed.revealed).toBe(true);
    expect(currentItem(failed)?.id).toBe("a");
    const retried = run([{ type: "submit" }, { type: "recorded" }], failed);
    expect(currentItem(retried)?.id).toBe("b");
  });

  it("skip works before reveal and counts as skipped", () => {
    const state = run([start, { type: "skip" }]);
    expect(currentItem(state)?.id).toBe("b");
    if (state.phase === "card") expect(state.tally).toEqual({ graded: 0, skipped: 1 });
  });

  it("a vanished item (skip while pending) counts as skipped", () => {
    const state = run([start, { type: "reveal" }, { type: "submit" }, { type: "skip" }]);
    if (state.phase !== "card") throw new Error("expected card");
    expect(state.pending).toBe(false);
    expect(state.tally).toEqual({ graded: 0, skipped: 1 });
  });

  it("the last card leads to the tally", () => {
    const state = run([
      start,
      { type: "reveal" },
      { type: "submit" },
      { type: "recorded" },
      { type: "skip" },
    ]);
    expect(state).toEqual({ phase: "done", tally: { graded: 1, skipped: 1 } });
  });

  it("ending early keeps the tally so far, but not mid-POST", () => {
    const pending = run([start, { type: "reveal" }, { type: "submit" }]);
    expect(run([{ type: "end" }], pending)).toBe(pending);
    const ended = run([{ type: "recorded" }, { type: "end" }], pending);
    expect(ended).toEqual({ phase: "done", tally: { graded: 1, skipped: 0 } });
  });

  it("reset returns to the start panel", () => {
    expect(run([start, { type: "end" }, { type: "reset" }])).toEqual(initialSession);
  });
});

describe("promptSide", () => {
  it("shows Urdu for Urdu→English", () => {
    expect(promptSide(item("a"), "ur_en")).toEqual({ side: "urdu", text: "کتاب" });
  });

  it("shows English for English→Urdu", () => {
    expect(promptSide(item("a"), "en_ur")).toEqual({ side: "english", text: "book" });
  });

  it("falls back to Urdu when the item has no English", () => {
    expect(promptSide(item("a", null), "en_ur").side).toBe("urdu");
    expect(promptSide(item("a", "  "), "en_ur").side).toBe("urdu");
  });
});

describe("review ahead", () => {
  it("steps from Now to one year, strictly increasing", () => {
    expect(AHEAD_STOPS[0]).toEqual({ seconds: 0, label: "Now" });
    expect(AHEAD_STOPS.at(-1)).toEqual({ seconds: 365 * 86_400, label: "1 year" });
    const seconds = AHEAD_STOPS.map((s) => s.seconds);
    expect(seconds).toEqual([...new Set(seconds)].sort((a, b) => a - b));
    expect(AHEAD_STOPS.map((s) => s.label).slice(1, 4)).toEqual(["1 hour", "2 hours", "3 hours"]);
    expect(AHEAD_STOPS.find((s) => s.seconds === 86_400)?.label).toBe("1 day");
    expect(aheadStop(3).label).toBe("3 hours");
    expect(aheadStop(99)).toEqual(AHEAD_STOPS[0]);
  });

  it("counts upcoming due times up to and including the cutoff", () => {
    const now = "2026-09-27T12:00:00.000Z";
    const dueAt = [
      "2026-09-27T13:00:00.000Z",
      "2026-09-27T15:00:00.000Z",
      "2026-09-27T15:00:00.001Z",
      "2026-09-30T12:00:00.000Z",
    ];
    expect(countWithin(dueAt, now, 0)).toBe(0);
    expect(countWithin(dueAt, now, 3 * 3_600)).toBe(2);
    expect(countWithin(dueAt, now, 3 * 86_400)).toBe(4);
    expect(countWithin([], now, 3_600)).toBe(0);
  });

  it("adds ahead_seconds to the due query only when set", () => {
    expect(dueQuery(20, 0)).toBe("/api/vocab/due?limit=20");
    expect(dueQuery(20, 10_800)).toBe("/api/vocab/due?limit=20&ahead_seconds=10800");
  });
});
