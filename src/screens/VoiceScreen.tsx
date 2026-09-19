// f07 s03: the Voice tab (FR-G Option 2). Start / End / Mute, a live transcript, elapsed time, the
// running cost estimate and a line per tool call. Leaving the tab or hiding the app ends the session
// so the mic is never left open. The Coach's writes go through Urdu Core (connection.ts).

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { connectVoice, type VoiceConnection } from "../voice/connection";
import {
  estimateCost,
  formatElapsed,
  initialVoice,
  stripMarkdown,
  voiceReducer,
} from "../voice/events";

const PHASE_LABELS = {
  idle: "Ready",
  connecting: "Connecting…",
  live: "Live",
  closing: "Ending…",
  ended: "Ended",
} as const;

export function VoiceScreen({ onLocked }: { onLocked: () => void }) {
  const [state, dispatch] = useReducer(voiceReducer, initialVoice);
  const connection = useRef<VoiceConnection | null>(null);
  const startedAt = useRef(0);
  const [now, setNow] = useState(0);
  const transcriptEnd = useRef<HTMLDivElement | null>(null);
  const active =
    state.phase === "connecting" || state.phase === "live" || state.phase === "closing";

  const start = useCallback(() => {
    if (connection.current) return;
    dispatch({ type: "connect" });
    startedAt.current = performance.now();
    setNow(startedAt.current);
    connection.current = connectVoice({
      onCreated: (sessionId) => dispatch({ type: "created", sessionId }),
      onEvent: (event) => {
        switch (event.kind) {
          case "started":
            return dispatch({ type: "started" });
          case "transcript":
            return dispatch({ type: "transcript", who: event.who, delta: event.delta });
          case "usage":
            return dispatch({ type: "usage", seconds: event.seconds });
          case "function_call":
            return dispatch({ type: "tool_call", call: event.call });
          case "error":
            return dispatch({ type: "error", message: event.message });
          case "closed":
            return;
        }
      },
      onToolResult: (callId, ok, detail) => dispatch({ type: "tool_result", callId, ok, detail }),
      onClosed: (error) => {
        connection.current = null;
        dispatch({ type: "closed", error });
      },
      onLocked,
    });
  }, [onLocked]);

  const end = useCallback(() => {
    if (!connection.current) return;
    dispatch({ type: "closing" });
    connection.current.end();
  }, []);

  function toggleMute() {
    const muted = !state.muted;
    connection.current?.setMuted(muted);
    dispatch({ type: "mute", muted });
  }

  // Hiding the app ends the session; unloading the page drops it at once.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") end();
    };
    const onPageHide = () => connection.current?.abort();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      // Leaving the tab: close politely so the server still reports final usage.
      connection.current?.end();
    };
  }, [end]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(performance.now()), 500);
    return () => clearInterval(timer);
  }, [active]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the transcript grows.
  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: "end" });
  }, [state.turns, state.tools.length]);

  const elapsed = state.phase === "idle" ? 0 : now - startedAt.current;

  return (
    <section className="panel voice">
      <p className="eyebrow">VOICE COACH</p>
      <div className="voice-status">
        <span className={`voice-phase voice-phase--${state.phase}`} role="status">
          {PHASE_LABELS[state.phase]}
        </span>
        <span>{formatElapsed(elapsed)}</span>
        <span title="Estimate from billed seconds">
          ${estimateCost(state.phase === "idle" ? 0 : state.seconds).toFixed(2)}
        </span>
      </div>

      <div className="voice-controls">
        {active ? (
          <>
            <button type="button" onClick={end} disabled={state.phase === "closing"}>
              End
            </button>
            <button
              type="button"
              className="secondary"
              onClick={toggleMute}
              disabled={state.phase !== "live"}
              aria-pressed={state.muted}
            >
              {state.muted ? "Unmute" : "Mute"}
            </button>
          </>
        ) : (
          <button type="button" onClick={start}>
            {state.phase === "ended" ? "Start again" : "Start"}
          </button>
        )}
      </div>

      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}

      {state.phase === "idle" && (
        <p className="hint">
          Talk Urdu with your Coach. Ask it to add a word, or to quiz you on your due words; quiz
          answers move the same schedule as the Review tab.
        </p>
      )}

      {(state.turns.length > 0 || state.tools.length > 0) && (
        <div className="voice-log" aria-live="polite">
          {state.turns.map((turn, i) => (
            <p
              // Turns only ever append, so the index is stable.
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only list.
              key={i}
              className={`voice-turn voice-turn--${turn.who}`}
              dir="auto"
            >
              {stripMarkdown(turn.text)}
            </p>
          ))}
          {state.tools.length > 0 && (
            <ul className="voice-tools">
              {state.tools.map((tool) => (
                <li
                  key={tool.callId}
                  className={`voice-tool voice-tool--${tool.status}`}
                  dir="auto"
                >
                  {tool.label}
                  {tool.status === "done" && ` ${tool.detail}`}
                  {tool.status === "failed" && ` failed: ${tool.detail}`}
                </li>
              ))}
            </ul>
          )}
          <div ref={transcriptEnd} />
        </div>
      )}
    </section>
  );
}
