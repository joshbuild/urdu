// Request and response shapes for the /api vocab, review and export routes (f01 s05, s06). Field names match the
// D1 columns and the Coach contract (snake_case).

import type { Grade, Mastery } from "./mastery";
import type { VocabKind } from "./normalize";

export const VOCAB_SOURCES = ["reading", "coach", "airtable", "manual"] as const;
export type VocabSource = (typeof VOCAB_SOURCES)[number];

// Sources a PWA client may set on create; coach and airtable have their own paths.
export const PWA_VOCAB_SOURCES = ["reading", "manual"] as const satisfies readonly VocabSource[];

export type VocabItem = {
  id: string;
  urdu: string;
  urdu_key: string;
  kind: VocabKind;
  roman: string | null;
  english: string | null;
  notes: string | null;
  example_urdu: string | null;
  example_english: string | null;
  tags: string[];
  favourite: boolean;
  mastery: Mastery;
  added_at: string;
  last_reviewed_on: string | null;
  next_review_on: string | null;
  source: VocabSource;
  airtable_id: string | null;
  created_at: string;
  updated_at: string;
};

// Fields a client can edit. All optional text fields accept null (or "") to clear.
export type VocabFields = {
  urdu: string;
  kind: VocabKind;
  roman: string | null;
  english: string | null;
  notes: string | null;
  example_urdu: string | null;
  example_english: string | null;
  tags: string[];
  favourite: boolean;
  mastery: Mastery;
};

export type CreateVocabRequest = Pick<VocabFields, "urdu"> &
  Partial<Omit<VocabFields, "urdu" | "mastery">> & {
    source?: (typeof PWA_VOCAB_SOURCES)[number];
  };

export type UpdateVocabRequest = Partial<VocabFields>;

export const VOCAB_SORTS = ["added", "next_review", "mastery"] as const;
export type VocabSort = (typeof VOCAB_SORTS)[number];

export type VocabListResponse = { items: VocabItem[]; total: number };
export type DueResponse = { items: VocabItem[]; today: string };
export type StatusResponse = { total: number; due: number; today: string };

export const REVIEW_DIRECTIONS = ["ur_en", "en_ur", "oral"] as const;
export type ReviewDirection = (typeof REVIEW_DIRECTIONS)[number];

export const REVIEW_SOURCES = ["pwa", "coach"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export type ReviewEvent = {
  id: string;
  vocab_id: string;
  reviewed_at: string;
  grade: Grade;
  mastery_before: Mastery;
  mastery_after: Mastery;
  direction: ReviewDirection;
  source: ReviewSource;
  handoff_id: string | null;
};

export type ReviewRequest = { grade: Grade; direction: ReviewDirection };
export type ReviewResponse = { item: VocabItem; event: ReviewEvent };

export type Tag = { name: string; description: string | null };

// payload and outcome are stored as JSON text and exported parsed.
export type Handoff = {
  id: string;
  imported_at: string;
  payload: unknown;
  status: string;
  outcome: unknown;
};

// The whole vault except sessions (PRD §6 Portability).
export type ExportResponse = {
  exported_at: string;
  vocab: VocabItem[];
  review_events: ReviewEvent[];
  tags: Tag[];
  handoffs: Handoff[];
};

export type DuplicateResponse = { error: "duplicate"; existing_id: string };
export type ConflictResponse = { error: "conflict"; message: string };
export type InvalidRequestResponse = { error: "invalid_request"; field?: string; message: string };

// --- Admin import (FR-H). Airtable is the only producer; the shapes stay generic so a
// --- future one-off migration can reuse the endpoint.

// Airtable's Next Review / Review Interval Days are never imported (FR-H2). The caller
// sends `airtable_next_review_on` only so the response can report where Airtable's
// schedule disagreed with the one we recompute.
export type ImportVocabRecord = {
  airtable_id: string;
  urdu: string;
  kind?: VocabKind;
  roman?: string | null;
  english?: string | null;
  notes?: string | null;
  example_urdu?: string | null;
  example_english?: string | null;
  tags?: string[];
  favourite?: boolean;
  mastery: Mastery;
  // ISO date or datetime; a date is read as midnight UTC.
  added_at: string;
  last_reviewed_on: string | null;
  airtable_next_review_on?: string | null;
};

export type ImportTagRecord = { name: string; description?: string | null };

export type ImportRequest = { vocab: ImportVocabRecord[]; tags?: ImportTagRecord[] };

export const IMPORT_OUTCOMES = ["created", "updated", "rejected"] as const;
export type ImportOutcome = (typeof IMPORT_OUTCOMES)[number];

export type ImportResult = {
  airtable_id: string;
  outcome: ImportOutcome;
  id?: string;
  // Recomputed from last_reviewed_on + interval(mastery); present unless rejected.
  next_review_on?: string | null;
  // Set when the recomputed date differs from the caller's airtable_next_review_on.
  next_review_mismatch?: { airtable: string | null; recomputed: string | null };
  reason?: string;
  field?: string;
};

export type ImportResponse = {
  results: ImportResult[];
  counts: Record<ImportOutcome, number>;
  mismatches: number;
  tags_upserted: number;
};

export const MAX_IMPORT_BATCH = 200;
