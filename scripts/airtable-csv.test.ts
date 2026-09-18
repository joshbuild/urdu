// Unit coverage for the Airtable CSV → import-record mapping (f02 Stage 2, PRD Appendix C).
// Pure functions, node environment — the endpoint's own behaviour is test/import.test.ts.

import { describe, expect, it } from "vitest";
import {
  isMapError,
  mapExport,
  mapTagRow,
  mapVocabRow,
  parseCsv,
  parseMastery,
  parseTagList,
} from "./airtable-csv";

const HEADER =
  "_airtable_record_id,Urdu Term,Urdu Transliteration,English Term,Meaning,Example,Tags,Added,Last Reviewed,Next Review,Mastery Score";

const row = (...cells: string[]) => cells.join(",");

describe("parseCsv", () => {
  it("strips a UTF-8 BOM from the first header name", () => {
    const rows = parseCsv("\u{FEFF}a,b\n1,2\n");
    expect(Object.keys(rows[0] as object)).toEqual(["a", "b"]);
  });

  it("keeps commas inside quoted cells", () => {
    const rows = parseCsv('a,b\n"one, two",three\n');
    expect(rows[0]).toEqual({ a: "one, two", b: "three" });
  });

  it("keeps newlines inside quoted cells", () => {
    const rows = parseCsv('a,b\n"line one\nline two",x\n');
    expect(rows[0]?.a).toBe("line one\nline two");
    expect(rows).toHaveLength(1);
  });

  it("unescapes doubled quotes", () => {
    const rows = parseCsv('a\n"he said ""hi"""\n');
    expect(rows[0]?.a).toBe('he said "hi"');
  });

  it("handles CRLF line endings", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("does not emit a phantom record for a trailing newline", () => {
    expect(parseCsv("a\n1\n")).toHaveLength(1);
  });

  it("reads a short row's missing columns as empty strings", () => {
    expect(parseCsv("a,b,c\n1\n")[0]).toEqual({ a: "1", b: "", c: "" });
  });

  it("returns nothing for an empty file", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("parseMastery", () => {
  it("reads the leading digit of an Airtable level name", () => {
    expect(parseMastery("1-Learning")).toEqual({ ok: true, value: 1 });
    expect(parseMastery("6-Permanent")).toEqual({ ok: true, value: 6 });
  });

  it("rejects an out-of-range level rather than coercing it", () => {
    const result = parseMastery("9-Mythical");
    expect(result.ok).toBe(false);
  });

  it("rejects an unparseable or empty value", () => {
    expect(parseMastery("Learning").ok).toBe(false);
    expect(parseMastery("").ok).toBe(false);
  });
});

describe("parseTagList", () => {
  it("splits a comma-separated multi-select and de-duplicates", () => {
    expect(parseTagList("nouns, noun-abstract, nouns")).toEqual(["nouns", "noun-abstract"]);
  });

  it("returns an empty list for an empty cell", () => {
    expect(parseTagList("")).toEqual([]);
  });
});

describe("mapVocabRow", () => {
  const base = parseCsv(
    `${HEADER}\n${row("rec1", "کتاب", "kitaab", "book", "a book", "میری کتاب", "nouns", "2026-09-08", "2026-09-11", "2026-09-16", "2-Basic")}\n`,
  )[0];

  it("maps every Appendix C field", () => {
    const mapped = mapVocabRow(base as Record<string, string>, 1);
    expect(isMapError(mapped)).toBe(false);
    expect(mapped).toMatchObject({
      airtable_id: "rec1",
      urdu: "کتاب",
      kind: "word",
      roman: "kitaab",
      english: "book",
      notes: "a book",
      example_urdu: "میری کتاب",
      example_english: null,
      tags: ["nouns"],
      favourite: false,
      mastery: 2,
      added_at: "2026-09-08",
      last_reviewed_on: "2026-09-11",
      airtable_next_review_on: "2026-09-16",
    });
  });

  it("infers kind = phrase for a term containing whitespace", () => {
    const rows = parseCsv(
      `${HEADER}\n${row("rec2", "بہت اچھا", "", "", "", "", "", "2026-09-08", "", "", "0-New")}\n`,
    );
    expect(mapVocabRow(rows[0] as Record<string, string>, 1)).toMatchObject({ kind: "phrase" });
  });

  it("maps empty optional cells to null and an empty Last Reviewed to null", () => {
    const rows = parseCsv(
      `${HEADER}\n${row("rec3", "کتاب", "", "", "", "", "", "2026-09-08", "", "", "0-New")}\n`,
    );
    expect(mapVocabRow(rows[0] as Record<string, string>, 1)).toMatchObject({
      roman: null,
      english: null,
      notes: null,
      example_urdu: null,
      tags: [],
      last_reviewed_on: null,
      airtable_next_review_on: null,
    });
  });

  it("truncates an ISO datetime date cell to its date part", () => {
    const rows = parseCsv(
      `${HEADER}\n${row("rec4", "کتاب", "", "", "", "", "", "2026-09-08T12:00:00.000Z", "", "", "0-New")}\n`,
    );
    expect(mapVocabRow(rows[0] as Record<string, string>, 1)).toMatchObject({
      added_at: "2026-09-08",
    });
  });

  it("reports a row with no Urdu Term instead of dropping it", () => {
    const rows = parseCsv(
      `${HEADER}\n${row("rec5", "", "", "", "", "", "", "2026-09-08", "", "", "0-New")}\n`,
    );
    const mapped = mapVocabRow(rows[0] as Record<string, string>, 7);
    expect(isMapError(mapped)).toBe(true);
    expect(mapped).toMatchObject({ row: 7, airtable_id: "rec5", field: "Urdu Term" });
  });

  it("reports a row with no record id", () => {
    const rows = parseCsv(
      `${HEADER}\n${row("", "کتاب", "", "", "", "", "", "2026-09-08", "", "", "0-New")}\n`,
    );
    expect(isMapError(mapVocabRow(rows[0] as Record<string, string>, 1))).toBe(true);
  });

  it("reports a malformed date rather than importing a wrong one", () => {
    const rows = parseCsv(
      `${HEADER}\n${row("rec6", "کتاب", "", "", "", "", "", "08/09/2026", "", "", "0-New")}\n`,
    );
    expect(mapVocabRow(rows[0] as Record<string, string>, 1)).toMatchObject({ field: "Added" });
  });
});

describe("mapTagRow", () => {
  it("maps name and description", () => {
    const rows = parseCsv(
      '_airtable_record_id,Tag Name,Description\nrec1,nouns,"Concrete things"\n',
    );
    expect(mapTagRow(rows[0] as Record<string, string>, 1)).toEqual({
      name: "nouns",
      description: "Concrete things",
    });
  });

  it("maps an empty description to null", () => {
    const rows = parseCsv("_airtable_record_id,Tag Name,Description\nrec1,nouns,\n");
    expect(mapTagRow(rows[0] as Record<string, string>, 1)).toEqual({
      name: "nouns",
      description: null,
    });
  });

  it("reports a nameless tag", () => {
    const rows = parseCsv("_airtable_record_id,Tag Name,Description\nrec1,,x\n");
    expect(isMapError(mapTagRow(rows[0] as Record<string, string>, 1))).toBe(true);
  });
});

describe("mapExport", () => {
  it("separates mapped rows from errors so no row is silently dropped", () => {
    const vocab = [
      HEADER,
      row("rec1", "کتاب", "", "", "", "", "", "2026-09-08", "", "", "0-New"),
      row("rec2", "", "", "", "", "", "", "2026-09-08", "", "", "0-New"),
    ].join("\n");
    const result = mapExport(
      `${vocab}\n`,
      "_airtable_record_id,Tag Name,Description\nrecT,nouns,things\n",
    );

    expect(result.vocab).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.airtable_id).toBe("rec2");
    expect(result.tags).toEqual([{ name: "nouns", description: "things" }]);
  });

  it("accepts a missing tags export", () => {
    const result = mapExport(`${HEADER}\n`, null);
    expect(result.tags).toEqual([]);
  });
});
