import { describe, expect, it } from "vitest";
import {
  estimateCost,
  type FunctionCall,
  formatElapsed,
  initialVoice,
  parseChannelEvent,
  stripMarkdown,
  toolLabel,
  toolSummary,
  type VoiceAction,
  voiceReducer,
} from "./events";

const run = (actions: VoiceAction[], from = initialVoice) => actions.reduce(voiceReducer, from);
const call = (name: string, args: object, callId = "c1"): FunctionCall => ({
  name,
  callId,
  arguments: JSON.stringify(args),
});

describe("voiceReducer", () => {
  it("goes idle → connecting → live → closing → ended", () => {
    let s = run([{ type: "connect" }, { type: "created", sessionId: "s1" }]);
    expect(s).toMatchObject({ phase: "connecting", sessionId: "s1" });
    s = run([{ type: "started" }], s);
    expect(s.phase).toBe("live");
    s = run([{ type: "closing" }], s);
    expect(s.phase).toBe("closing");
    s = run([{ type: "closed" }], s);
    expect(s.phase).toBe("ended");
  });

  it("ignores connect while a session is active, and restarts clean after one ends", () => {
    const live = run([{ type: "connect" }, { type: "started" }]);
    expect(voiceReducer(live, { type: "connect" })).toBe(live);
    const ended = run([{ type: "transcript", who: "user", delta: "hi" }, { type: "closed" }], live);
    expect(voiceReducer(ended, { type: "connect" })).toEqual({
      ...initialVoice,
      phase: "connecting",
    });
  });

  it("merges fragments per speaker and starts a new bubble on a speaker change", () => {
    const s = run([
      { type: "transcript", who: "coach", delta: "سلام" },
      { type: "transcript", who: "coach", delta: "، کیسے ہیں؟" },
      { type: "transcript", who: "user", delta: "ٹھیک" },
      { type: "transcript", who: "user", delta: "" },
      { type: "transcript", who: "coach", delta: "اچھا" },
    ]);
    expect(s.turns).toEqual([
      { who: "coach", text: "سلام، کیسے ہیں؟" },
      { who: "user", text: "ٹھیک" },
      { who: "coach", text: "اچھا" },
    ]);
  });

  it("tracks a tool call from pending to done or failed, once per call id", () => {
    const add = call("add_to_vault", { items: [{ urdu: "لباس", english: "clothes" }] });
    let s = run([
      { type: "tool_call", call: add },
      { type: "tool_call", call: add },
    ]);
    expect(s.tools).toEqual([
      { callId: "c1", name: "add_to_vault", label: "Adding لباس…", status: "pending", detail: "" },
    ]);
    s = run(
      [{ type: "tool_result", callId: "c1", ok: false, detail: "لباس: already in vault" }],
      s,
    );
    expect(s.tools[0]).toMatchObject({ status: "failed", detail: "لباس: already in vault" });
  });

  it("keeps the highest billed seconds and records an error on close", () => {
    const s = run([
      { type: "usage", seconds: 30 },
      { type: "usage", seconds: 12 },
      { type: "closed", error: "The connection to the Coach dropped." },
    ]);
    expect(s.seconds).toBe(30);
    expect(s.error).toBe("The connection to the Coach dropped.");
  });
});

describe("parseChannelEvent", () => {
  const parse = (ev: object) => parseChannelEvent(JSON.stringify(ev));

  it("maps session and transcript events", () => {
    expect(parse({ type: "session.started", session: { id: "s" } })).toEqual([{ kind: "started" }]);
    expect(parse({ type: "session.input_transcript.delta", delta: "a" })).toEqual([
      { kind: "transcript", who: "user", delta: "a" },
    ]);
    expect(parse({ type: "session.output_transcript.delta", delta: "b" })).toEqual([
      { kind: "transcript", who: "coach", delta: "b" },
    ]);
    expect(parse({ type: "session.usage.updated", usage: { seconds: 42 } })).toEqual([
      { kind: "usage", seconds: 42 },
    ]);
    expect(parse({ type: "session.closed", reason: "x", usage: { seconds: 60 } })).toEqual([
      { kind: "usage", seconds: 60 },
      { kind: "closed" },
    ]);
  });

  it("extracts a finished function call from a delegated response event", () => {
    const item = { type: "function_call", name: "get_vocab", call_id: "c9", arguments: "{}" };
    expect(
      parse({ type: "response.event", event: { type: "response.output_item.done", item } }),
    ).toEqual([
      { kind: "function_call", call: { name: "get_vocab", callId: "c9", arguments: "{}" } },
    ]);
    expect(
      parse({ type: "response.event", event: { type: "response.output_text.delta" } }),
    ).toEqual([]);
    const message = { type: "message" };
    expect(
      parse({
        type: "response.event",
        event: { type: "response.output_item.done", item: message },
      }),
    ).toEqual([]);
  });

  it("reports errors and ignores noise and bad JSON", () => {
    expect(parse({ type: "error", error: { message: "boom" } })).toEqual([
      { kind: "error", message: "boom" },
    ]);
    expect(parse({ type: "output_audio_buffer.started" })).toEqual([]);
    expect(parseChannelEvent("not json")).toEqual([]);
    expect(parseChannelEvent("null")).toEqual([]);
  });
});

describe("tool lines", () => {
  it("labels calls in flight", () => {
    expect(toolLabel(call("get_vocab", {}))).toBe("Reading your due words…");
    expect(toolLabel(call("get_vocab", { scope: "all" }))).toBe("Reading your vocab…");
    expect(toolLabel(call("record_review", { urdu: "کتاب", grade: "correct" }))).toBe(
      "Recording کتاب…",
    );
    expect(toolLabel({ name: "add_to_vault", callId: "c", arguments: "{bad" })).toBe(
      "Adding to your vault…",
    );
  });

  it("marks an add failed unless every item was created", () => {
    expect(
      toolSummary("add_to_vault", { results: [{ urdu: "لباس", outcome: "created", id: "1" }] }),
    ).toEqual({ ok: true, detail: "لباس added" });
    expect(
      toolSummary("add_to_vault", {
        results: [
          { urdu: "لباس", outcome: "created", id: "1" },
          { urdu: "کتاب", outcome: "duplicate", existing_id: "2", existing_english: "book" },
        ],
      }).ok,
    ).toBe(false);
  });

  it("summarises reviews, counted, helped and unmatched", () => {
    const recorded = {
      outcome: "recorded" as const,
      vocab_id: "1",
      urdu: "کتاب",
      grade: "correct",
      counted: true,
      applied_delta: 1,
      mastery: "Learning",
      due_at: null,
    };
    expect(toolSummary("record_review", recorded)).toEqual({
      ok: true,
      detail: "کتاب: correct, now Learning",
    });
    expect(toolSummary("record_review", { ...recorded, counted: false }).detail).toBe(
      "کتاب: helped, not counted",
    );
    expect(toolSummary("record_review", { outcome: "unmatched", reason: "no such item" })).toEqual({
      ok: false,
      detail: "no such item",
    });
  });
});

describe("helpers", () => {
  it("strips markdown emphasis and headings", () => {
    expect(stripMarkdown("**بہت** اچھا\n## Note")).toBe("بہت اچھا\nNote");
  });

  it("formats elapsed time and estimates cost", () => {
    expect(formatElapsed(65_400)).toBe("1:05");
    expect(formatElapsed(-5)).toBe("0:00");
    expect(estimateCost(45)).toBeCloseTo(0.05);
  });
});
