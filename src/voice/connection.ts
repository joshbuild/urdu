// f07 s03: the Voice screen's WebRTC session and tool relay (FR-B5, DECISIONS 260918h). The
// browser sends its offer to /api/voice/session, connects to OpenAI with the answer, and relays
// each tool call on the data channel to /api/voice/tools/* with the session cookie. Every result,
// failure included, goes back to the Coach so it never confirms a write that did not happen.

import type { VoiceSessionResponse, VoiceToolRequest, VoiceToolResult } from "../../shared/api";
import { type ChannelEvent, type FunctionCall, parseChannelEvent, toolSummary } from "./events";

export type ConnectionHandlers = {
  onCreated: (sessionId: string) => void;
  onEvent: (event: ChannelEvent) => void;
  onToolResult: (callId: string, ok: boolean, detail: string) => void;
  // The session is over (closed, failed or torn down); `error` explains a failure.
  onClosed: (error?: string) => void;
  onLocked: () => void;
};

export type VoiceConnection = {
  // Asks the server to close (it drains tool work and reports final usage), then tears down.
  end: () => void;
  // Tears down at once: the page is going away.
  abort: () => void;
  setMuted: (muted: boolean) => void;
};

// After session.close, the server drains delegated work and sends session.closed with final usage.
const CLOSE_GRACE_MS = 20_000;

function sessionError(status: number, body: unknown): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (error === "voice_unconfigured")
    return "Voice is not set up on the server yet (no OpenAI key).";
  if (status === 502) return "OpenAI refused to start the session. Try again in a moment.";
  return "Could not start a voice session. Try again.";
}

type ToolOutcome = { output: unknown; ok: boolean; detail: string; locked?: boolean };

async function runTool(sessionId: string, call: FunctionCall): Promise<ToolOutcome> {
  let args: unknown;
  try {
    args = JSON.parse(call.arguments || "{}");
  } catch {
    return {
      output: { error: "arguments were not valid JSON" },
      ok: false,
      detail: "bad arguments",
    };
  }
  const body: VoiceToolRequest = { session_id: sessionId, call_id: call.callId, arguments: args };
  try {
    const response = await fetch(`/api/voice/tools/${encodeURIComponent(call.name)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await response.json().catch(() => null);
    if (response.status === 401) {
      const output = { error: "the app is locked; nothing was saved" };
      return { output, ok: false, detail: "locked", locked: true };
    }
    if (!response.ok) {
      const message = (data as { message?: unknown } | null)?.message;
      const text = typeof message === "string" ? message : `request failed (${response.status})`;
      return { output: { error: text }, ok: false, detail: text };
    }
    return { output: data, ...toolSummary(call.name, data as VoiceToolResult) };
  } catch {
    const output = { error: "network error; nothing was saved" };
    return { output, ok: false, detail: "network error" };
  }
}

export function connectVoice(handlers: ConnectionHandlers): VoiceConnection {
  let closed = false;
  let pc: RTCPeerConnection | null = null;
  let dc: RTCDataChannel | null = null;
  let mic: MediaStream | null = null;
  let audio: HTMLAudioElement | null = null;
  let sessionId = "";
  let graceTimer: ReturnType<typeof setTimeout> | undefined;

  function stopMic() {
    for (const track of mic?.getTracks() ?? []) track.stop();
  }

  function teardown(error?: string) {
    if (closed) return;
    closed = true;
    clearTimeout(graceTimer);
    try {
      dc?.close();
    } catch {}
    try {
      pc?.close();
    } catch {}
    stopMic();
    if (audio) audio.srcObject = null;
    handlers.onClosed(error);
  }

  function send(message: object) {
    if (dc?.readyState === "open") dc.send(JSON.stringify(message));
  }

  async function relay(call: FunctionCall) {
    const result = await runTool(sessionId, call);
    if (closed) return;
    handlers.onToolResult(call.callId, result.ok, result.detail);
    // Live rejects delegation_id on these commands (mp02 desktop run).
    send({
      type: "response.item.create",
      item: {
        type: "function_call_output",
        call_id: call.callId,
        output: JSON.stringify(result.output),
      },
    });
    send({ type: "response.create" });
    if (result.locked) handlers.onLocked();
  }

  function onMessage(data: unknown) {
    for (const event of parseChannelEvent(String(data))) {
      if (event.kind === "function_call") void relay(event.call);
      handlers.onEvent(event);
      if (event.kind === "closed") teardown();
    }
  }

  async function start() {
    try {
      mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      teardown("Microphone permission was refused.");
      return;
    }
    // Left while the permission prompt was up: release the mic at once.
    if (closed) return stopMic();

    try {
      const peer = new RTCPeerConnection();
      pc = peer;
      audio = new Audio();
      audio.autoplay = true;
      peer.addEventListener("track", (e) => {
        if (audio) audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      });
      peer.addEventListener("connectionstatechange", () => {
        if (peer.connectionState === "failed") teardown("The connection to the Coach dropped.");
      });
      const [track] = mic.getAudioTracks();
      if (track) peer.addTrack(track, mic);
      dc = peer.createDataChannel("oai-events");
      dc.addEventListener("message", (e) => onMessage(e.data));

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/voice/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp }),
      });
      if (response.status === 401) {
        teardown("This device is locked.");
        handlers.onLocked();
        return;
      }
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) return teardown(sessionError(response.status, data));
      if (closed) return;
      const session = data as VoiceSessionResponse;
      sessionId = session.sessionId;
      handlers.onCreated(sessionId);
      await peer.setRemoteDescription({ type: "answer", sdp: session.sdp });
    } catch {
      teardown("Could not connect to the Coach. Check your connection and try again.");
    }
  }

  void start();

  return {
    end() {
      if (closed) return;
      if (dc?.readyState !== "open") return teardown();
      send({ type: "session.close" });
      // Stop listening now; the mic itself is released at teardown.
      for (const t of mic?.getAudioTracks() ?? []) t.enabled = false;
      graceTimer ??= setTimeout(() => teardown(), CLOSE_GRACE_MS);
    },
    abort() {
      teardown();
    },
    setMuted(muted: boolean) {
      for (const t of mic?.getAudioTracks() ?? []) t.enabled = !muted;
    },
  };
}
