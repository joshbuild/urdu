// f05: the Review tab — start (FR-E1), card and reveal (FR-E2), grade or skip (FR-E3), tally
// (FR-E4). The Worker applies each grade (FR-A4); this screen only says which button was tapped.

import { useCallback, useEffect, useReducer, useState } from "react";
import type {
  DueResponse,
  ReviewDirection,
  ReviewRequest,
  ReviewResponse,
  StatusResponse,
  UpcomingResponse,
  VocabItem,
} from "../../shared/api";
import { ladder } from "../../shared/ladders";
import { GRADE_LABELS, GRADE_SHORT_LABELS, GRADES, type Grade } from "../../shared/mastery";
import { TankMeter } from "../harvest/TankMeter";
import { speak } from "../reader/speech";
import { intakeOffer, startCounts } from "../review/intake";
import {
  AHEAD_STOPS,
  type AheadStop,
  aheadStop,
  countWithin,
  currentItem,
  dueQuery,
  initialSession,
  promptSide,
  sessionReducer,
} from "../review/session";
import { readSessionLimit } from "../settings/sessionLimit";

const DIRECTION_LABELS: Record<Exclude<ReviewDirection, "oral">, string> = {
  ur_en: "Urdu → English",
  en_ur: "English → Urdu",
};

function aheadHint(ahead: AheadStop, upcoming: UpcomingResponse | null): string {
  if (ahead.seconds === 0) return "Only items due now.";
  const span = `in the next ${ahead.label}. Grades count from now.`;
  if (upcoming === null) return `Also includes items due ${span}`;
  const n = countWithin(upcoming.due_at, upcoming.now, ahead.seconds);
  return `${n.toLocaleString()} more ${n === 1 ? "item falls" : "items fall"} due ${span}`;
}

export function ReviewScreen({
  status,
  voice,
  onChanged,
}: {
  status: StatusResponse;
  voice: SpeechSynthesisVoice | null;
  // The vault changed (or the session was lost); App refreshes the counts or shows the lock.
  onChanged: () => void;
}) {
  const [state, dispatch] = useReducer(sessionReducer, initialSession);
  const [direction, setDirection] = useState<ReviewDirection>("ur_en");
  const [stop, setStop] = useState(0);
  const ahead = aheadStop(stop);
  // Due times still to come, for the count under the slider. Refetched each time the start
  // screen shows, so a finished session's new due times count; null until loaded or on failure.
  const [upcoming, setUpcoming] = useState<UpcomingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [startError, setStartError] = useState("");
  const [intaking, setIntaking] = useState(false);
  // A fresh status (new intake counts) ends an Intake in flight.
  const intakeCounts = status.intake;
  useEffect(() => {
    void intakeCounts;
    setIntaking(false);
  }, [intakeCounts]);

  const loadUpcoming = useCallback((signal?: AbortSignal) => {
    fetch("/api/vocab/upcoming", { cache: "no-store", signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: UpcomingResponse | null) => setUpcoming(data))
      .catch(() => {
        if (!signal?.aborted) setUpcoming(null);
      });
  }, []);

  const atStart = state.phase === "start";
  useEffect(() => {
    if (!atStart) return;
    const controller = new AbortController();
    loadUpcoming(controller.signal);
    return () => controller.abort();
  }, [atStart, loadUpcoming]);

  // The tab remounts each time it is selected; the due count may have gone stale meanwhile.
  useEffect(() => {
    onChanged();
  }, [onChanged]);

  // Items fall due while the app sits open, and nothing else refetches the counts.
  function refresh() {
    loadUpcoming();
    onChanged();
  }

  // f17: Intake releases the next batch at once, then the counts refetch. No confirm step: it
  // only moves words from the queue into the new pile.
  // The button stays disabled until the refreshed status arrives (the effect below), so a second
  // tap can't release a second batch against the old offer.
  async function intake(count: number) {
    setIntaking(true);
    setStartError("");
    try {
      const response = await fetch("/api/intake/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      if (!response.ok && response.status !== 401) throw new Error("intake failed");
    } catch {
      setStartError("Could not take in more words. Check your connection and try again.");
      setIntaking(false);
    } finally {
      onChanged();
    }
  }

  async function start() {
    setLoading(true);
    setStartError("");
    try {
      const response = await fetch(dueQuery(readSessionLimit(), ahead.seconds), {
        cache: "no-store",
      });
      if (response.status === 401) return onChanged();
      if (!response.ok) throw new Error("due failed");
      const data: DueResponse = await response.json();
      dispatch({ type: "start", items: data.items, direction });
    } catch {
      setStartError("Could not load your due items. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function grade(item: VocabItem, value: Grade) {
    if (state.phase !== "card" || state.pending) return;
    const previous = state.history[state.index];
    dispatch({ type: "submit" });
    const body: ReviewRequest = { grade: value, direction: state.direction };
    try {
      const response = await fetch(
        previous?.kind === "graded"
          ? `/api/reviews/${encodeURIComponent(previous.eventId)}`
          : `/api/vocab/${encodeURIComponent(item.id)}/reviews`,
        {
          method: previous?.kind === "graded" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(previous?.kind === "graded" ? { grade: value } : body),
        },
      );
      if (response.status === 201 || response.status === 200) {
        const data: ReviewResponse = await response.json();
        dispatch({ type: "recorded", eventId: data.event.id, grade: value });
        onChanged();
        return;
      }
      // Deleted since the queue loaded: nothing to grade, so it counts as skipped.
      if (response.status === 404 && previous?.kind !== "graded") return dispatch({ type: "skip" });
      if (response.status === 401) {
        dispatch({ type: "failed", message: "This device is locked. Unlock, then try again." });
        return onChanged();
      }
      dispatch({
        type: "failed",
        message:
          response.status === 409
            ? previous?.kind === "graded"
              ? "This item changed since that grade. The earlier grade cannot be corrected here."
              : "This item changed while grading. Tap a grade again."
            : "Could not record that grade. Tap it again to retry.",
      });
    } catch {
      dispatch({
        type: "failed",
        message: "Could not record that grade. Check your connection and tap it again.",
      });
    }
  }

  function finish() {
    dispatch({ type: "reset" });
    onChanged();
  }

  if (state.phase === "start") {
    const offer = intakeOffer(status.intake);
    return (
      <section className="panel">
        <p className="eyebrow">REVIEW</p>
        <div className="due-row">
          <h2>{startCounts(status.due, status.intake.new)}</h2>
          <button type="button" className="secondary inline" onClick={refresh}>
            Refresh
          </button>
        </div>
        <p className="hint review-new-hint">
          New words come after due ones, so stopping early leaves new words for later.
        </p>
        <TankMeter intake={status.intake} compact />
        {offer && (
          <button
            type="button"
            className="secondary intake"
            onClick={() => void intake(offer.count)}
            disabled={intaking}
          >
            {intaking ? "Taking in…" : offer.label}
          </button>
        )}
        <fieldset className="direction">
          <legend>Direction</legend>
          {(Object.keys(DIRECTION_LABELS) as (keyof typeof DIRECTION_LABELS)[]).map((key) => (
            <label key={key}>
              <input
                type="radio"
                name="direction"
                value={key}
                checked={direction === key}
                onChange={() => setDirection(key)}
              />
              {DIRECTION_LABELS[key]}
            </label>
          ))}
        </fieldset>
        <label htmlFor="review-ahead" className="ahead-label">
          Review ahead <output htmlFor="review-ahead">{ahead.label}</output>
        </label>
        <input
          id="review-ahead"
          type="range"
          min={0}
          max={AHEAD_STOPS.length - 1}
          step={1}
          value={stop}
          onChange={(event) => setStop(Number(event.target.value))}
          aria-valuetext={ahead.label}
          aria-describedby="review-ahead-hint"
        />
        <p id="review-ahead-hint" className="hint">
          {aheadHint(ahead, upcoming)}
        </p>
        <button
          type="button"
          onClick={start}
          disabled={loading || (status.due === 0 && ahead.seconds === 0)}
        >
          {loading ? "Loading…" : "Start review"}
        </button>
        <p className="hint">
          Up to {readSessionLimit()} items per session (change it in Settings). Spacing:{" "}
          {ladder(status.active_ladder_id).name}.
        </p>
        {startError && (
          <p className="error" role="alert">
            {startError}
          </p>
        )}
      </section>
    );
  }

  if (state.phase === "done") {
    const { graded, skipped } = state.tally;
    return (
      <section className="panel">
        <p className="eyebrow">REVIEW</p>
        <h2>{graded + skipped === 0 ? "Nothing to review." : "Session done."}</h2>
        <dl className="counts">
          <div>
            <dt>Graded</dt>
            <dd>{graded}</dd>
          </div>
          <div>
            <dt>Skipped</dt>
            <dd>{skipped}</dd>
          </div>
        </dl>
        {state.history.length > 0 && (
          <button type="button" className="secondary" onClick={() => dispatch({ type: "back" })}>
            Back to last card
          </button>
        )}
        <button type="button" onClick={finish}>
          Back to review
        </button>
      </section>
    );
  }

  const item = currentItem(state);
  if (!item) return null;
  const prompt = promptSide(item, state.direction);
  const completed = state.history[state.index];
  const urduWord = (
    <button
      type="button"
      className="review-speak-word urdu-inline vocab-headword"
      dir="rtl"
      lang="ur"
      aria-label={`Speak ${item.urdu}`}
      onClick={() => speak(item.urdu, voice)}
    >
      {item.urdu}
    </button>
  );

  return (
    <section className="panel review-card">
      <div className="review-top">
        <p className="eyebrow">
          {state.index + 1} OF {state.queue.length}
        </p>
        <div className="review-top-actions">
          {state.index > 0 && (
            <button
              type="button"
              className="back"
              onClick={() => dispatch({ type: "back" })}
              disabled={state.pending}
            >
              Back
            </button>
          )}
          {/* mp04: Skip and Keep grade live up here so the grade grid fits one screen. */}
          {completed?.kind === "graded" ? (
            <button
              type="button"
              className="back"
              onClick={() => dispatch({ type: "next" })}
              disabled={state.pending}
            >
              Keep grade
            </button>
          ) : (
            <button
              type="button"
              className="back"
              onClick={() => dispatch({ type: "skip" })}
              disabled={state.pending}
            >
              Skip
            </button>
          )}
          <button
            type="button"
            className="back"
            onClick={() => dispatch({ type: "end" })}
            disabled={state.pending}
          >
            End
          </button>
        </div>
      </div>

      {prompt.side === "english" ? <p className="review-prompt">{prompt.text}</p> : urduWord}

      {state.revealed && prompt.side === "english" && urduWord}

      {state.revealed && (
        <dl className="entry">
          {item.roman && (
            <>
              <dt>Roman Urdu</dt>
              <dd>{item.roman}</dd>
            </>
          )}
          {item.english && prompt.side === "urdu" && (
            <>
              <dt>English</dt>
              <dd>{item.english}</dd>
            </>
          )}
          {item.notes && (
            <>
              <dt>Notes</dt>
              <dd>{item.notes}</dd>
            </>
          )}
          {item.example_urdu && (
            <>
              <dt>Example</dt>
              <dd className="urdu-inline" dir="rtl" lang="ur">
                {item.example_urdu}
              </dd>
            </>
          )}
          {item.example_english && <dd>{item.example_english}</dd>}
        </dl>
      )}

      {completed?.kind === "graded" && (
        <p className="hint" role="status">
          Recorded: {GRADE_LABELS[completed.grade]}. Choose another grade to correct it.
        </p>
      )}
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}

      <div className="grade-bar">
        {state.revealed ? (
          GRADES.map((value) => (
            <button
              key={value}
              type="button"
              className={`grade grade--${value}`}
              onClick={() => grade(item, value)}
              disabled={state.pending}
            >
              {GRADE_SHORT_LABELS[value]}
            </button>
          ))
        ) : (
          <button type="button" className="reveal" onClick={() => dispatch({ type: "reveal" })}>
            Reveal
          </button>
        )}
      </div>
    </section>
  );
}
