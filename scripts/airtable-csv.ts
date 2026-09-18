// f02 Stage 2: Airtable CSV export → import records (PRD FR-H2, Appendix C).
//
// Pure functions only — no fs, no fetch — so the mapping is unit-testable in the node
// Vitest project. The IO wrapper is `scripts/airtable-import.ts`.
//
// Header names come from the real export, which differs from Appendix C in two places:
// the record id column is `_airtable_record_id`, and the Tags table's name column is
// `Tag Name`. All three files carry a UTF-8 BOM.

import type { ImportTagRecord, ImportVocabRecord } from "../shared/api";
import { isLegacyLevel, type LegacyLevel } from "../shared/mastery";
import { inferKind } from "../shared/normalize";

export const VOCAB_HEADERS = {
  recordId: "_airtable_record_id",
  urdu: "Urdu Term",
  roman: "Urdu Transliteration",
  english: "English Term",
  notes: "Meaning",
  exampleUrdu: "Example",
  tags: "Tags",
  added: "Added",
  lastReviewed: "Last Reviewed",
  nextReview: "Next Review",
  mastery: "Mastery Score",
} as const;

export const TAG_HEADERS = {
  name: "Tag Name",
  description: "Description",
} as const;

export type CsvRow = Record<string, string>;

/**
 * RFC 4180 CSV parse: handles a UTF-8 BOM, quoted cells containing commas, escaped
 * doubled quotes, embedded newlines, and CRLF or LF line endings. Returns rows keyed by
 * the header line; a short row's missing columns read as empty strings.
 */
export function parseCsv(input: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let cellStarted = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
    cellStarted = false;
  };
  const endRow = () => {
    endCell();
    // A trailing newline must not produce a phantom one-empty-cell record.
    if (!(row.length === 1 && row[0] === "")) records.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string;

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && !cellStarted) {
      quoted = true;
      cellStarted = true;
    } else if (char === ",") {
      endCell();
    } else if (char === "\r") {
      // Swallow CR; the LF that follows ends the row. A lone CR ends it too.
      if (text[i + 1] === "\n") i += 1;
      endRow();
    } else if (char === "\n") {
      endRow();
    } else {
      cell += char;
      cellStarted = true;
    }
  }
  if (cell !== "" || cellStarted || row.length > 0) endRow();

  const header = records.shift();
  if (!header) return [];

  return records.map((values) => {
    const record: CsvRow = {};
    header.forEach((name, index) => {
      record[name] = values[index] ?? "";
    });
    return record;
  });
}

export type MapError = { row: number; airtable_id: string; field: string; message: string };

export type MapResult<T> = { ok: true; value: T } | { ok: false; error: string; field: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cell(row: CsvRow, name: string): string {
  return (row[name] ?? "").trim();
}

/** Airtable writes `Mastery Score` as `"1-Learning"`. The leading digit is the level. */
export function parseMastery(value: string): MapResult<LegacyLevel> {
  const text = value.trim();
  if (text === "") return { ok: false, field: "mastery", error: "Mastery Score is empty" };
  const match = /^(\d+)\b/.exec(text);
  if (!match) {
    return { ok: false, field: "mastery", error: `Mastery Score "${text}" has no leading level` };
  }
  const level = Number(match[1]);
  if (!isLegacyLevel(level)) {
    return { ok: false, field: "mastery", error: `mastery ${level} is outside 0-6` };
  }
  return { ok: true, value: level };
}

function parseDate(field: string, value: string): MapResult<string | null> {
  if (value === "") return { ok: true, value: null };
  // Airtable can export a date field as a bare date or as an ISO datetime.
  const date = ISO_DATE.test(value) ? value : value.slice(0, 10);
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(date))) {
    return { ok: false, field, error: `${field} "${value}" is not a YYYY-MM-DD date` };
  }
  return { ok: true, value: date };
}

/** Airtable multi-selects export as a comma-separated list; empty entries are dropped. */
export function parseTagList(value: string): string[] {
  const tags: string[] = [];
  for (const entry of value.split(",")) {
    const tag = entry.trim();
    if (tag !== "" && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

function optional(value: string): string | null {
  return value === "" ? null : value;
}

/** Maps one Vocabulary Terms row per Appendix C. `row` is the 1-based data-row number. */
export function mapVocabRow(csv: CsvRow, row: number): ImportVocabRecord | MapError {
  const airtableId = cell(csv, VOCAB_HEADERS.recordId);
  const err = (field: string, message: string): MapError => ({
    row,
    airtable_id: airtableId,
    field,
    message,
  });

  if (airtableId === "") return err(VOCAB_HEADERS.recordId, "record id is empty");

  const urdu = cell(csv, VOCAB_HEADERS.urdu);
  if (urdu === "") return err(VOCAB_HEADERS.urdu, "Urdu Term is empty");

  const mastery = parseMastery(csv[VOCAB_HEADERS.mastery] ?? "");
  if (!mastery.ok) return err(VOCAB_HEADERS.mastery, mastery.error);

  const added = cell(csv, VOCAB_HEADERS.added);
  if (added === "") return err(VOCAB_HEADERS.added, "Added is empty");
  const addedDate = parseDate(VOCAB_HEADERS.added, added);
  if (!addedDate.ok) return err(VOCAB_HEADERS.added, addedDate.error);

  const lastReviewed = parseDate(VOCAB_HEADERS.lastReviewed, cell(csv, VOCAB_HEADERS.lastReviewed));
  if (!lastReviewed.ok) return err(VOCAB_HEADERS.lastReviewed, lastReviewed.error);

  const nextReview = parseDate(VOCAB_HEADERS.nextReview, cell(csv, VOCAB_HEADERS.nextReview));
  if (!nextReview.ok) return err(VOCAB_HEADERS.nextReview, nextReview.error);

  return {
    airtable_id: airtableId,
    urdu,
    // Appendix C: phrase if the term contains whitespace, else word.
    kind: inferKind(urdu),
    roman: optional(cell(csv, VOCAB_HEADERS.roman)),
    english: optional(cell(csv, VOCAB_HEADERS.english)),
    notes: optional(cell(csv, VOCAB_HEADERS.notes)),
    example_urdu: optional(cell(csv, VOCAB_HEADERS.exampleUrdu)),
    // The export has no English-example column; Appendix C maps nothing to it.
    example_english: null,
    tags: parseTagList(csv[VOCAB_HEADERS.tags] ?? ""),
    favourite: false,
    mastery: mastery.value,
    added_at: addedDate.value as string,
    last_reviewed_on: lastReviewed.value,
    airtable_next_review_on: nextReview.value,
  };
}

export function mapTagRow(csv: CsvRow, row: number): ImportTagRecord | MapError {
  const name = cell(csv, TAG_HEADERS.name);
  if (name === "") {
    return { row, airtable_id: "", field: TAG_HEADERS.name, message: "Tag Name is empty" };
  }
  return { name, description: optional(cell(csv, TAG_HEADERS.description)) };
}

export function isMapError(value: unknown): value is MapError {
  return typeof value === "object" && value !== null && "message" in value && "row" in value;
}

export type MappedExport = {
  vocab: ImportVocabRecord[];
  tags: ImportTagRecord[];
  errors: MapError[];
};

export function mapExport(vocabCsv: string, tagsCsv: string | null): MappedExport {
  const errors: MapError[] = [];
  const vocab: ImportVocabRecord[] = [];
  const tags: ImportTagRecord[] = [];

  parseCsv(vocabCsv).forEach((csv, index) => {
    const mapped = mapVocabRow(csv, index + 1);
    if (isMapError(mapped)) errors.push(mapped);
    else vocab.push(mapped);
  });

  if (tagsCsv !== null) {
    parseCsv(tagsCsv).forEach((csv, index) => {
      const mapped = mapTagRow(csv, index + 1);
      if (isMapError(mapped)) errors.push(mapped);
      else tags.push(mapped);
    });
  }

  return { vocab, tags, errors };
}
