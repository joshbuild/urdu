// f07 s03: Voice session state (FR-G Option 2). Pure: the screen owns the WebRTC connection and
// the tool fetches; this turns data-channel events and their outcomes into what the screen shows.
// Event names and shapes are the ones mp02 observed on the Live data channel.

import type {
  AddToVaultResult,
  GetVocabResult,
  RecordReviewResult,
  VoiceToolResult,
} from "../../shared/api";

// mp02 pricing: about $0.05 a minute of session audio, plus ~15 s charged at create. An estimate
// for the running display and the client-side cap; s04 records the reported usage.
export const VOICE_RATE_PER_SECOND = 0.05 / 60;
export const CREATE_CHARGE_SECONDS = 15;

export function estimateCost(seconds: number): number {
  return (seconds + CREATE_CHARGE_SECONDS) * VOICE_RATE_PER_SECOND;
}

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
  muted: boolean;
  error: string | null;
};

export const initialVoice: VoiceState = {
  phase: "idle",
  sessionId: null,
  turns: [],
  tools: [],
  seconds: 0,
  muted: false,
  error: null,
};

export type FunctionCall = { name: string; callId: string; arguments: string };

export type VoiceAction =
  | { type: "connect" }
  | { type: "created"; sessionId: string }
  | { type: "started" }
  | { type: "transcript"; who: Speaker; delta: string }
  | { type: "usage"; seconds: number }
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
      return state.phase === "connecting" ? { ...state, sessionId: action.sessionId } : state;
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
