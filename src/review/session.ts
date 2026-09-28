// f05 s01: review session state (FR-E1..E4). Pure; the screen owns fetching and the POST.
// Mastery arithmetic stays in the Worker: the client only records which grade was tapped.

import type { ReviewDirection, VocabItem } from "../../shared/api";

export type Tally = { graded: number; skipped: number };

export type SessionState =
  | { phase: "start" }
  | {
      phase: "card";
      queue: VocabItem[];
      index: number;
      direction: ReviewDirection;
      revealed: boolean;
      pending: boolean;
      error: string | null;
      tally: Tally;
    }
  | { phase: "done"; tally: Tally };

export type SessionAction =
  | { type: "start"; items: VocabItem[]; direction: ReviewDirection }
  | { type: "reveal" }
  | { type: "submit" }
  | { type: "recorded" }
  | { type: "failed"; message: string }
  // Also used when the item vanished (404) mid-session: it counts as skipped, never graded.
  | { type: "skip" }
  | { type: "end" }
  | { type: "reset" };

export const initialSession: SessionState = { phase: "start" };

const EMPTY: Tally = { graded: 0, skipped: 0 };

function advance(state: Extract<SessionState, { phase: "card" }>, tally: Tally): SessionState {
  const index = state.index + 1;
  if (index >= state.queue.length) return { phase: "done", tally };
  return { ...state, index, revealed: false, pending: false, error: null, tally };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  if (action.type === "reset") return initialSession;
  if (action.type === "start") {
    if (state.phase === "card") return state;
    if (action.items.length === 0) return { phase: "done", tally: EMPTY };
    return {
      phase: "card",
      queue: action.items,
      index: 0,
      direction: action.direction,
      revealed: false,
      pending: false,
      error: null,
      tally: EMPTY,
    };
  }
  if (state.phase !== "card") return state;

  switch (action.type) {
    case "reveal":
      return state.revealed ? state : { ...state, revealed: true };
    case "submit":
      // Grading needs the answer shown, and one grade at a time.
      if (!state.revealed || state.pending) return state;
      return { ...state, pending: true, error: null };
    case "recorded":
      if (!state.pending) return state;
      return advance(state, { ...state.tally, graded: state.tally.graded + 1 });
    case "failed":
      return { ...state, pending: false, error: action.message };
    case "skip":
      return advance(state, { ...state.tally, skipped: state.tally.skipped + 1 });
    case "end":
      if (state.pending) return state;
      return { phase: "done", tally: state.tally };
  }
}

export function currentItem(state: SessionState): VocabItem | null {
  return state.phase === "card" ? (state.queue[state.index] ?? null) : null;
}

// What the card shows before Reveal. English→Urdu falls back to the Urdu side when the item
// has no English yet, rather than showing a blank card.
export function promptSide(
  item: VocabItem,
  direction: ReviewDirection,
): { side: "urdu" | "english"; text: string } {
  const english = item.english?.trim();
  if (direction === "en_ur" && english) return { side: "english", text: english };
  return { side: "urdu", text: item.urdu };
}

// Review ahead (f05; mp03, sponsor request 2026-09-27): the slider snaps through these stops,
// in seconds. The last one matches the Worker's one-year cap.
const HOUR = 3_600;
const DAY = 86_400;
export type AheadStop = { seconds: number; label: string };
const NOW: AheadStop = { seconds: 0, label: "Now" };
export const AHEAD_STOPS: readonly AheadStop[] = [
  NOW,
  ...[1, 2, 3, 5, 8, 12, 16, 20].map((h) => ({
    seconds: h * HOUR,
    label: `${h} ${h === 1 ? "hour" : "hours"}`,
  })),
  ...[1, 2, 3, 5].map((d) => ({ seconds: d * DAY, label: `${d} ${d === 1 ? "day" : "days"}` })),
  { seconds: 7 * DAY, label: "1 week" },
  { seconds: 14 * DAY, label: "2 weeks" },
  { seconds: 30 * DAY, label: "1 month" },
  { seconds: 91 * DAY, label: "3 months" },
  { seconds: 182 * DAY, label: "6 months" },
  { seconds: 365 * DAY, label: "1 year" },
];

// The stop at a slider position; anything off the track reads as Now.
export function aheadStop(index: number): AheadStop {
  return AHEAD_STOPS[index] ?? NOW;
}

// How many of `dueAt` (the upcoming list) fall due within `seconds` of the Worker's `now`.
export function countWithin(dueAt: readonly string[], now: string, seconds: number): number {
  const cutoff = Date.parse(now) + seconds * 1000;
  return dueAt.filter((at) => Date.parse(at) <= cutoff).length;
}

export function dueQuery(limit: number, aheadSeconds: number): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (aheadSeconds > 0) params.set("ahead_seconds", String(aheadSeconds));
  return `/api/vocab/due?${params}`;
}
