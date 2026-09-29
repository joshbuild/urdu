// f05 s01: review session state (FR-E1..E4). Pure; the screen owns fetching and the POST.
// Mastery arithmetic stays in the Worker: the client only records which grade was tapped.

import type { ReviewDirection, VocabItem } from "../../shared/api";
import type { Grade } from "../../shared/mastery";

export type Tally = { graded: number; skipped: number };
export type CompletedCard =
  | { kind: "graded"; eventId: string; grade: Grade; revealed: true }
  | { kind: "skipped"; revealed: boolean };
type SessionProgress = {
  queue: VocabItem[];
  direction: ReviewDirection;
  history: CompletedCard[];
  tally: Tally;
};

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
      history: CompletedCard[];
    }
  | ({ phase: "done" } & SessionProgress);

export type SessionAction =
  | { type: "start"; items: VocabItem[]; direction: ReviewDirection }
  | { type: "reveal" }
  | { type: "submit" }
  | { type: "recorded"; eventId: string; grade: Grade }
  | { type: "failed"; message: string }
  // Also used when the item vanished (404) mid-session: it counts as skipped, never graded.
  | { type: "skip" }
  | { type: "back" }
  | { type: "next" }
  | { type: "end" }
  | { type: "reset" };

export const initialSession: SessionState = { phase: "start" };

const EMPTY: Tally = { graded: 0, skipped: 0 };

function advance(
  state: Extract<SessionState, { phase: "card" }>,
  completed: CompletedCard,
): SessionState {
  const history = [...state.history];
  history[state.index] = completed;
  const tally = {
    graded: history.filter((entry) => entry.kind === "graded").length,
    skipped: history.filter((entry) => entry.kind === "skipped").length,
  };
  const index = state.index + 1;
  if (index >= state.queue.length)
    return { phase: "done", queue: state.queue, direction: state.direction, history, tally };
  return {
    ...state,
    history,
    index,
    revealed: history[index]?.revealed ?? false,
    pending: false,
    error: null,
    tally,
  };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  if (action.type === "reset") return initialSession;
  if (action.type === "start") {
    if (state.phase === "card") return state;
    if (action.items.length === 0)
      return { phase: "done", queue: [], direction: action.direction, history: [], tally: EMPTY };
    return {
      phase: "card",
      queue: action.items,
      index: 0,
      direction: action.direction,
      revealed: false,
      pending: false,
      error: null,
      tally: EMPTY,
      history: [],
    };
  }
  if (action.type === "back" && state.phase === "done" && state.history.length > 0) {
    const index = state.history.length - 1;
    return {
      ...state,
      phase: "card",
      index,
      revealed: state.history[index]?.revealed ?? false,
      pending: false,
      error: null,
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
      return advance(state, {
        kind: "graded",
        eventId: action.eventId,
        grade: action.grade,
        revealed: true,
      });
    case "failed":
      return { ...state, pending: false, error: action.message };
    case "skip":
      if (state.history[state.index]?.kind === "graded") return state;
      return advance(state, { kind: "skipped", revealed: state.revealed });
    case "back":
      if (state.pending || state.index === 0) return state;
      return {
        ...state,
        index: state.index - 1,
        revealed: state.history[state.index - 1]?.revealed ?? false,
        error: null,
      };
    case "next": {
      const completed = state.history[state.index];
      if (state.pending || !completed) return state;
      return advance(state, completed);
    }
    case "end":
      if (state.pending) return state;
      return {
        phase: "done",
        queue: state.queue,
        direction: state.direction,
        history: state.history,
        tally: state.tally,
      };
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
