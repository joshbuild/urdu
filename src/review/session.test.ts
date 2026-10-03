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
  shuffleSession,
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
    harvest_id: null,
    released_at: "2026-09-01T00:00:00.000Z",
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

const run = (actions: SessionAction[], from: SessionState = initialSession) =>
  actions.reduce(sessionReducer, from);

const start: SessionAction = { type: "start", items: [item("a"), item("b")], direction: "ur_en" };
const recorded: SessionAction = { type: "recorded", eventId: "event-a", grade: "correct" };

describe("sessionReducer", () => {
  it("starts on the first card, hidden", () => {
    const state = run([start]);
    expect(state.phase).toBe("card");
    expect(currentItem(state)?.id).toBe("a");
    if (state.phase === "card") expect(state.revealed).toBe(false);
  });

  it("an empty queue goes straight to the tally", () => {
    const state = run([{ type: "start", items: [], direction: "ur_en" }]);
    expect(state).toMatchObject({ phase: "done", tally: { graded: 0, skipped: 0 } });
  });

  it("will not grade before reveal", () => {
    const state = run([start, { type: "submit" }]);
    if (state.phase !== "card") throw new Error("expected card");
    expect(state.pending).toBe(false);
  });

  it("advances only once the grade is recorded, and counts it", () => {
    const pending = run([start, { type: "reveal" }, { type: "submit" }]);
    expect(currentItem(pending)?.id).toBe("a");
    const next = run([recorded], pending);
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
    const retried = run([{ type: "submit" }, recorded], failed);
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
    const state = run([start, { type: "reveal" }, { type: "submit" }, recorded, { type: "skip" }]);
    expect(state).toMatchObject({ phase: "done", tally: { graded: 1, skipped: 1 } });
  });

  it("ending early keeps the tally so far, but not mid-POST", () => {
    const pending = run([start, { type: "reveal" }, { type: "submit" }]);
    expect(run([{ type: "end" }], pending)).toBe(pending);
    const ended = run([recorded, { type: "end" }], pending);
    expect(ended).toMatchObject({ phase: "done", tally: { graded: 1, skipped: 0 } });
  });

  it("goes back to a graded card and replaces its grade without increasing the tally", () => {
    const corrected = run([
      start,
      { type: "reveal" },
      { type: "submit" },
      recorded,
      { type: "back" },
      { type: "submit" },
      { type: "recorded", eventId: "event-a", grade: "wrong" },
    ]);
    expect(currentItem(corrected)?.id).toBe("b");
    if (corrected.phase !== "card") throw new Error("expected card");
    expect(corrected.tally).toEqual({ graded: 1, skipped: 0 });
    expect(corrected.history[0]).toMatchObject({ grade: "wrong", eventId: "event-a" });
  });

  it("lets a skipped card be graded after going back", () => {
    const state = run([
      start,
      { type: "skip" },
      { type: "back" },
      { type: "reveal" },
      { type: "submit" },
      recorded,
    ]);
    if (state.phase !== "card") throw new Error("expected card");
    expect(state.tally).toEqual({ graded: 1, skipped: 0 });
  });

  it("returns from the tally to the last card", () => {
    const state = run([start, { type: "skip" }, { type: "skip" }, { type: "back" }]);
    expect(currentItem(state)?.id).toBe("b");
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

describe("shuffleSession", () => {
  const due = (id: string) => ({ ...item(id), due_at: "2026-09-02T00:00:00.000Z" });
  const ids = (items: VocabItem[]) => items.map((v) => v.id);

  it("keeps due cards before the new pile, and every card once", () => {
    const items = [due("d1"), due("d2"), due("d3"), item("n1"), item("n2")];
    for (let seed = 0; seed < 20; seed++) {
      let x = seed;
      const random = () => {
        x = (x * 9301 + 49297) % 233280;
        return x / 233280;
      };
      const out = ids(shuffleSession(items, random));
      expect(out.slice(0, 3).sort()).toEqual(["d1", "d2", "d3"]);
      expect(out.slice(3).sort()).toEqual(["n1", "n2"]);
    }
  });

  it("reorders within a group", () => {
    // random() = 0 always swaps with the first card: [a, b, c] becomes [b, c, a].
    expect(ids(shuffleSession([due("a"), due("b"), due("c")], () => 0))).toEqual(["b", "c", "a"]);
  });

  it("leaves the input untouched", () => {
    const items = [due("a"), due("b")];
    shuffleSession(items, () => 0);
    expect(ids(items)).toEqual(["a", "b"]);
  });
});
