import { describe, expect, it } from "vitest";
import type { VocabItem } from "../../shared/api";
import {
  describeInvalid,
  fillInPrompt,
  missingFields,
  newVocabPrompt,
  parsePasted,
} from "./prompts";

const item = (over: Partial<VocabItem>): VocabItem => ({
  id: "01J0000000000000000000000A",
  urdu: "\u{067E}\u{0627}\u{0646}\u{06CC}",
  urdu_key: "\u{067E}\u{0627}\u{0646}\u{06CC}",
  kind: "word",
  roman: null,
  english: null,
  notes: null,
  example_urdu: null,
  example_english: null,
  tags: [],
  favourite: false,
  ladder_id: 3,
  ladder_step: 0,
  interval_seconds: 10_800,
  added_at: "2026-09-18T00:00:00.000Z",
  last_reviewed_at: null,
  due_at: null,
  source: "manual",
  airtable_id: null,
  created_at: "2026-09-18T00:00:00.000Z",
  updated_at: "2026-09-18T00:00:00.000Z",
  ...over,
});

describe("newVocabPrompt", () => {
  it("carries the handoff id, session time and the proposal schema", () => {
    const text = newVocabPrompt("H123", new Date("2026-09-18T10:00:00Z"));
    expect(text).toContain('"handoff_id": "H123"');
    expect(text).toContain('"session_at": "2026-09-18T10:00:00.000Z"');
    for (const field of ["proposals", "urdu", "roman", "english", "example_urdu", "tags"]) {
      expect(text).toContain(`"${field}"`);
    }
    expect(text).toContain("Pakistani Urdu");
    expect(text).toContain("JSON document alone");
  });

  it("makes a fresh id each time by default", () => {
    const id = (t: string) => t.match(/"handoff_id": "([^"]+)"/)?.[1];
    expect(id(newVocabPrompt())).not.toBe(id(newVocabPrompt()));
  });
});

describe("fillInPrompt", () => {
  it("lists each item's id, urdu and present fields only", () => {
    const text = fillInPrompt([item({ english: "water" })], "R1");
    expect(text).toContain('"handoff_id": "R1"');
    expect(text).toContain('"vocab_id": "01J0000000000000000000000A"');
    expect(text).toContain('"english": "water"');
    expect(text).not.toContain('"roman": null');
    expect(text).toContain('"revisions"');
  });
});

describe("missingFields", () => {
  it("names the empty fillable fields", () => {
    expect(missingFields(item({ roman: "paani", notes: "n" }))).toEqual([
      "english",
      "example_urdu",
      "example_english",
    ]);
  });
});

describe("parsePasted", () => {
  it("parses plain JSON", () => {
    expect(parsePasted(' {"a": 1} ')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("removes a surrounding markdown fence", () => {
    expect(parsePasted('```json\n{"a": 1}\n```')).toEqual({ ok: true, value: { a: 1 } });
    expect(parsePasted('```\n{"a": 1}```')).toEqual({ ok: true, value: { a: 1 } });
  });

  it("reports invalid JSON without repairing it", () => {
    const result = parsePasted('{"a": 1,}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/not valid JSON/);
    expect(parsePasted('Here you go: {"a": 1}').ok).toBe(false);
  });

  it("asks for a paste when empty", () => {
    expect(parsePasted("   ")).toEqual({
      ok: false,
      message: "Paste the chat's JSON reply first.",
    });
  });
});

describe("describeInvalid", () => {
  it("joins field and message", () => {
    expect(describeInvalid({ field: "proposals[2].roman", message: "must be a string" })).toBe(
      "proposals[2].roman must be a string",
    );
    expect(describeInvalid({ message: "body must be a JSON object" })).toBe(
      "body must be a JSON object",
    );
  });
});
