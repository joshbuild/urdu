// f07 s03: Voice session state (FR-G Option 2). Pure: the screen owns the WebRTC connection and
// the tool fetches; this turns data-channel events and their outcomes into what the screen shows.
// Event names and shapes are the ones mp02 observed on the Live data channel.

import type {
  AddToVaultResult,
  GetVocabResult,
  RecordReviewResult,
  VoiceSpendResponse,
  VoiceToolResult,
} from "../../shared/api";
import { sessionCost } from "../../shared/voice-cost";

export type Speaker = "user" | "coach";
export type Turn = { who: Speaker; text: string };

export type ToolStatus = "pending" | "done" | "failed";
export type ToolLine = {
  callId: string;
  name: string;
  label: string;
  status: ToolStatus;
  detail: string;
};

export type Phase = "idle" | "connecting" | "live" | "closing" | "ended";

export type VoiceState = {
  phase: Phase;
  sessionId: string | null;
  turns: Turn[];
  tools: ToolLine[];
  // Billed session seconds as last reported by the server.
  seconds: number;
  // Delegated backend tokens, summed over the responses the data channel reported (f07 s04).
  backendInput: number;
  backendOutput: number;
  // Today's spend and the caps, as of session create. `todayBeforeUsd` excludes this session, so
  // the running total stays monotone while the session is live.
  spend: (VoiceSpendResponse & { todayBeforeUsd: number }) | null;
  muted: boolean;
  error: string | null;
};

export const initialVoice: VoiceState = {
  phase: "idle",
  sessionId: null,
  turns: [],
  tools: [],
  seconds: 0,
  backendInput: 0,
  backendOutput: 0,
  spend: null,
  muted: false,
  error: null,
};

// What this session has cost so far, and what the day stands at with it included.
export function sessionUsd(state: VoiceState): number {
  if (state.phase === "idle") return 0;
  return sessionCost({
    seconds: state.seconds,
    backend_input_tokens: state.backendInput,
    backend_output_tokens: state.backendOutput,
  });
}

export function todayUsd(state: VoiceState): number {
  return (state.spend?.todayBeforeUsd ?? 0) + sessionUsd(state);
}

export type CapState = "under" | "soft" | "hard";

export function capState(state: VoiceState): CapState {
  if (!state.spend) return "under";
  const total = todayUsd(state);
  if (total >= state.spend.hard_cap_usd) return "hard";
  return total >= state.spend.soft_cap_usd ? "soft" : "under";
}

export type FunctionCall = { name: string; callId: string; arguments: string };

export type VoiceAction =
  | { type: "connect" }
  | { type: "created"; sessionId: string; spend: VoiceSpendResponse }
  | { type: "started" }
  | { type: "transcript"; who: Speaker; delta: string }
  | { type: "usage"; seconds: number }
  | { type: "backend_usage"; input: number; output: number }
  // The server's figures after a usage report; `sessionUsd` is what it recorded for this session.
  | { type: "spend"; spend: VoiceSpendResponse; sessionUsd: number }
  | { type: "tool_call"; call: FunctionCall }
  | { type: "tool_result"; callId: string; ok: boolean; detail: string }
  | { type: "mute"; muted: boolean }
  | { type: "error"; message: string }
  | { type: "closing" }
  | { type: "closed"; error?: string };

export function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case "connect":
      if (state.phase === "connecting" || state.phase === "live" || state.phase === "closing") {
        return state;
      }
      return { ...initialVoice, phase: "connecting" };
    case "created":
      return state.phase === "connecting"
        ? {
            ...state,
            sessionId: action.sessionId,
            spend: { ...action.spend, todayBeforeUsd: action.spend.today_usd },
          }
        : state;
    case "started":
      return state.phase === "connecting" ? { ...state, phase: "live" } : state;
    case "transcript": {
      if (!action.delta) return state;
      // Fragments from one speaker merge into one bubble; a new bubble starts when the speaker changes.
      const last = state.turns.at(-1);
      if (last && last.who === action.who) {
        const turns = state.turns.slice(0, -1);
        turns.push({ who: last.who, text: last.text + action.delta });
        return { ...state, turns };
      }
      return { ...state, turns: [...state.turns, { who: action.who, text: action.delta }] };
    }
    case "usage":
      return action.seconds >= state.seconds ? { ...state, seconds: action.seconds } : state;
    case "backend_usage":
      // Each response reports its own tokens, so these accumulate rather than replace.
      return {
        ...state,
        backendInput: state.backendInput + action.input,
        backendOutput: state.backendOutput + action.output,
      };
    case "spend":
      // Rebased so the display keeps showing the day total the server just confirmed.
      return {
        ...state,
        spend: {
          ...action.spend,
          todayBeforeUsd: Math.max(0, action.spend.today_usd - action.sessionUsd),
        },
      };
    case "tool_call": {
      if (state.tools.some((t) => t.callId === action.call.callId)) return state;
      const line: ToolLine = {
        callId: action.call.callId,
        name: action.call.name,
        label: toolLabel(action.call),
        status: "pending",
        detail: "",
      };
      return { ...state, tools: [...state.tools, line] };
    }
    case "tool_result":
      return {
        ...state,
        tools: state.tools.map((t) =>
          t.callId === action.callId
            ? { ...t, status: action.ok ? "done" : "failed", detail: action.detail }
            : t,
        ),
      };
    case "mute":
      return { ...state, muted: action.muted };
    case "error":
      return { ...state, error: action.message };
    case "closing":
      return state.phase === "live" || state.phase === "connecting"
        ? { ...state, phase: "closing" }
        : state;
    case "closed":
      return { ...state, phase: "ended", muted: false, error: action.error ?? state.error };
  }
}

// What a data-channel message means for the screen. `null` for the many events it ignores.
export type ChannelEvent =
  | { kind: "started" }
  | { kind: "transcript"; who: Speaker; delta: string }
  | { kind: "usage"; seconds: number }
  | { kind: "backend_usage"; input: number; output: number }
  | { kind: "function_call"; call: FunctionCall }
  | { kind: "closed" }
  | { kind: "error"; message: string };

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === "object" ? (v as Raw) : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function usageSeconds(ev: Raw): number | null {
  const seconds = obj(ev.usage)?.seconds;
  return typeof seconds === "number" && Number.isFinite(seconds) ? seconds : null;
}

export function parseChannelEvent(raw: string): ChannelEvent[] {
  let ev: Raw | null;
  try {
    ev = obj(JSON.parse(raw));
  } catch {
    return [];
  }
  if (!ev) return [];
  switch (ev.type) {
    case "session.started":
      return [{ kind: "started" }];
    case "session.input_transcript.delta":
      return [{ kind: "transcript", who: "user", delta: str(ev.delta) }];
    case "session.output_transcript.delta":
      return [{ kind: "transcript", who: "coach", delta: str(ev.delta) }];
    case "session.usage.updated": {
      const seconds = usageSeconds(ev);
      return seconds === null ? [] : [{ kind: "usage", seconds }];
    }
    case "session.closed": {
      const seconds = usageSeconds(ev);
      const out: ChannelEvent[] = seconds === null ? [] : [{ kind: "usage", seconds }];
      return [...out, { kind: "closed" }];
    }
    case "error": {
      const message =
        str(obj(ev.error)?.message) || str(ev.message) || "The voice session reported an error.";
      return [{ kind: "error", message }];
    }
    case "response.event": {
      // Delegated backend events arrive wrapped; a finished function_call item is a tool call (mp02).
      const inner = obj(ev.event);
      // A finished backend response carries the delegation's token usage (mp02 read it the same way).
      if (inner?.type === "response.completed") {
        const usage = obj(obj(inner.response)?.usage);
        const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
        const input = count(usage?.input_tokens);
        const output = count(usage?.output_tokens);
        return input || output ? [{ kind: "backend_usage", input, output }] : [];
      }
      if (inner?.type !== "response.output_item.done") return [];
      const item = obj(inner.item);
      if (item?.type !== "function_call") return [];
      const name = str(item.name);
      const callId = str(item.call_id);
      if (!name || !callId) return [];
      return [{ kind: "function_call", call: { name, callId, arguments: str(item.arguments) } }];
    }
    default:
      return [];
  }
}

function parseArgs(json: string): Raw {
  try {
    return obj(JSON.parse(json || "{}")) ?? {};
  } catch {
    return {};
  }
}

// The tool line while the call is in flight ("Adding لباس…").
export function toolLabel(call: FunctionCall): string {
  const args = parseArgs(call.arguments);
  switch (call.name) {
    case "get_vocab":
      return args.scope === "all" ? "Reading your vocab…" : "Reading your due words…";
    case "add_to_vault": {
      const items = Array.isArray(args.items) ? args.items : [];
      const words = items.map((i) => str(obj(i)?.urdu)).filter(Boolean);
      return words.length ? `Adding ${words.join("، ")}…` : "Adding to your vault…";
    }
    case "record_review": {
      const word = str(args.urdu);
      return word ? `Recording ${word}…` : "Recording a review…";
    }
    default:
      return `${call.name}…`;
  }
}

// A one-line outcome for the tool line. `ok` false when any part of the call did not do what the
// Coach asked, so the line reads as failed even if the request itself succeeded.
export function toolSummary(
  name: string,
  result: VoiceToolResult,
): { ok: boolean; detail: string } {
  switch (name) {
    case "get_vocab": {
      const r = result as GetVocabResult;
      return { ok: true, detail: `${r.items.length} of ${r.total}` };
    }
    case "add_to_vault": {
      const parts = (result as AddToVaultResult).results.map((r) =>
        r.outcome === "created"
          ? `${r.urdu} added`
          : r.outcome === "duplicate"
            ? `${r.urdu}: already in vault`
            : `${r.urdu}: ${r.reason}`,
      );
      const ok = (result as AddToVaultResult).results.every((r) => r.outcome === "created");
      return { ok, detail: parts.join("; ") };
    }
    case "record_review": {
      const r = result as RecordReviewResult;
      if (r.outcome !== "recorded") return { ok: false, detail: r.reason };
      return {
        ok: true,
        detail: r.counted
          ? `${r.urdu}: ${r.grade}, now ${r.mastery}`
          : `${r.urdu}: helped, not counted`,
      };
    }
    default:
      return { ok: true, detail: "done" };
  }
}

// The Coach sometimes speaks markdown (mp02 tuning note 4); the transcript shows plain text.
export function stripMarkdown(text: string): string {
  return text.replace(/\*+/g, "").replace(/^#+\s*/gm, "");
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
