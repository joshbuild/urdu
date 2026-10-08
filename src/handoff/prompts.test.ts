import { describe, expect, it } from "vitest";
import { FILLABLE_FIELDS, type VocabItem } from "../../shared/api";
import { TOPICS } from "../../shared/topics";
import {
  batchPrompt,
  checkPrompt,
  classifyPrompt,
  describeInvalid,
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
  topic: null,
  cefr: null,
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
  checked_at: null,
  filled_at: null,
  harvest_id: null,
  released_at: "2026-09-01T00:00:00.000Z",
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

  it("asks for a topic slug, a CEFR level and up to two secondary slugs from the list", () => {
    const text = newVocabPrompt("H1");
    for (const field of ["topic", "cefr"]) expect(text).toContain(`"${field}"`);
    for (const t of TOPICS) expect(text).toContain(t.slug);
    expect(text).toContain("A1, A2, B1, B2, C1 or C2");
    expect(text).toContain("at most two");
  });

  it("makes a fresh id each time by default", () => {
    const id = (t: string) => t.match(/"handoff_id": "([^"]+)"/)?.[1];
    expect(id(newVocabPrompt())).not.toBe(id(newVocabPrompt()));
  });
});

describe("checkPrompt", () => {
  it("carries the server's handoff id, every present field and the corrections schema", () => {
    const text = checkPrompt(
      [item({ roman: "paani", english: "water" }), item({ id: "01J0000000000000000000000B" })],
      "C1",
      { mode: "correctness", fields: [...FILLABLE_FIELDS] },
    );
    expect(text).toContain('"handoff_id": "C1"');
    expect(text).toContain('"vocab_id": "01J0000000000000000000000A"');
    expect(text).toContain('"vocab_id": "01J0000000000000000000000B"');
    expect(text).toContain('"roman": "paani"');
    expect(text).toContain('"english": "water"');
    expect(text).not.toContain('"notes": null');
    for (const word of ['"corrections"', '"reason"', '"urdu_suggestion"', '"corrections": []']) {
      expect(text).toContain(word);
    }
    expect(text).toContain("Never change");
    expect(text).toContain("JSON document alone");
  });

  const items = [
    item({ roman: "paani", english: "water" }),
    item({ id: "01J0000000000000000000000B", english: "book", example_urdu: "x" }),
  ];

  it("in correctness names only the chosen fields and never asks for a fill", () => {
    const text = checkPrompt(items, "C1", { mode: "correctness", fields: ["english"] });
    expect(text).toContain('check only these fields of each item: "english"');
    expect(text).toContain("right meaning");
    expect(text).not.toContain("spelling Pakistanis actually type");
    expect(text).toContain("Never add a field");
    expect(text).not.toContain('"missing"');
  });

  it("in completeness lists each item's missing chosen fields and never asks for a change", () => {
    const text = checkPrompt(items, "C1", {
      mode: "completeness",
      fields: ["roman", "example_urdu"],
    });
    expect(text).toContain("You are completing entries");
    // The first item has roman, so lacks only example_urdu; the second lacks roman.
    expect(text).toMatch(/"roman": "paani",[\s\S]*?"missing": \[\s*"example_urdu"\s*\]/);
    expect(text).toMatch(/"example_urdu": "x",\s*"missing": \[\s*"roman"\s*\]/);
    expect(text).toContain("Never change or remove");
    expect(text).not.toContain("Correctness:");
  });

  it("in both asks for the two together, with neither prohibition", () => {
    const text = checkPrompt(items, "C1", { mode: "both", fields: ["roman", "english"] });
    expect(text).toContain("Correctness:");
    expect(text).toContain("Completeness:");
    expect(text).not.toContain("Never add a field");
    expect(text).not.toContain("Never change or remove");
  });
});

const ROTI = "\u{0631}\u{0648}\u{0679}\u{06CC}"; // روٹی

const BATCH = {
  handoff_id: "B123",
  cells: [
    { topic: "food", level: "A1" as const, have: 10, quota: 35, ask: 25 },
    { topic: "body", level: "A1" as const, have: 15, quota: 20, ask: 5 },
  ],
  exclusions: [ROTI],
};

describe("batchPrompt", () => {
  it("asks for each cell's count at its level, with the scope line and the exclusions", () => {
    const text = batchPrompt(BATCH, new Date("2026-10-06T10:00:00Z"));
    expect(text).toContain('"handoff_id": "B123"');
    expect(text).toContain('"session_at": "2026-10-06T10:00:00.000Z"');
    expect(text).toContain("25 words or phrases for topic food at CEFR A1");
    expect(text).toContain("5 words or phrases for topic body at CEFR A1");
    expect(text).toContain("ingredients, dishes, cooking, taste, eating out");
    expect(text).toContain("body parts, looks");
    expect(text).toContain(ROTI);
    expect(text).toContain(`Already in my vault (leave all of these out): ${ROTI}`);
    expect(text).toContain("give fewer rather than repeat one");
    expect(text).toContain("weather never to nature");
  });

  it("says none when the vault is empty", () => {
    expect(batchPrompt({ ...BATCH, exclusions: [] })).toContain(
      "Already in my vault (leave all of these out): none",
    );
  });

  it("asks for every field, the self-review, and at most the total asked", () => {
    const text = batchPrompt(BATCH);
    for (const field of ["urdu", "roman", "english", "notes", "example_urdu", "topic", "cefr"]) {
      expect(text).toContain(`"${field}"`);
    }
    expect(text).toContain("At most 30 proposals");
    expect(text).toContain("Before replying, review");
    expect(text).toContain("strict JSON");
  });
});

describe("classifyPrompt", () => {
  const BATCH = {
    handoff_id: "K1",
    items: [
      { n: 1, vocab_id: "a", urdu: ROTI, english: "bread" },
      { n: 2, vocab_id: "b", urdu: "\u{06A9}\u{06CC}\u{0627}", english: null },
    ],
  };

  it("lists one thin line per item and asks for compact rows", () => {
    const text = classifyPrompt(BATCH);
    expect(text).toContain('"handoff_id": "K1"');
    expect(text).toContain(`1|${ROTI}|bread`);
    expect(text).toContain("2|\u{06A9}\u{06CC}\u{0627}|");
    expect(text).toContain('"rows"');
    expect(text).toContain("[n, urdu, topic, level, tags]");
    for (const t of TOPICS) expect(text).toContain(t.slug);
    expect(text).toContain("every item");
    expect(text).toContain("strict JSON");
  });

  it("stays thin: no full entries, no examples asked for", () => {
    const text = classifyPrompt(BATCH);
    expect(text).not.toContain('"example_urdu"');
    expect(text).not.toContain('"proposals"');
  });
});

describe("every prompt", () => {
  it("asks for strict JSON with no double quotes inside text values", () => {
    for (const text of [
      newVocabPrompt("H1"),
      batchPrompt(BATCH),
      checkPrompt([item({})], "C1", { mode: "both", fields: ["notes"] }),
    ]) {
      expect(text).toContain("strict JSON");
      expect(text).toContain("never use a double quotation mark");
    }
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
