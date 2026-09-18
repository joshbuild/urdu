// Request and response shapes for the /api vocab, review and export routes (f01 s05, s06). Field names match the
// D1 columns and the Coach contract (snake_case).

import type { Ladder } from "./ladders";
import type { Grade, LegacyLevel } from "./mastery";
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
  // Schedule (f09): one state per item. The rung is a position on ladder_id's version, not a
  // universal measure; interval_seconds is the interval actually scheduled.
  ladder_id: number;
  ladder_step: number;
  interval_seconds: number;
  added_at: string;
  // UTC instants. due_at null means never reviewed, which means due now.
  last_reviewed_at: string | null;
  due_at: string | null;
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
  // A correction on the active ladder: no review event, due recomputed from the last review.
  ladder_step: number;
};

export type CreateVocabRequest = Pick<VocabFields, "urdu"> &
  Partial<Omit<VocabFields, "urdu" | "ladder_step">> & {
    source?: (typeof PWA_VOCAB_SOURCES)[number];
  };

export type UpdateVocabRequest = Partial<VocabFields>;

// "next_review" sorts by due_at; "mastery" by the scheduled interval.
export const VOCAB_SORTS = ["added", "next_review", "mastery"] as const;
export type VocabSort = (typeof VOCAB_SORTS)[number];

export type VocabListResponse = { items: VocabItem[]; total: number };
export type DueResponse = { items: VocabItem[]; today: string };
export type StatusResponse = {
  total: number;
  due: number;
  today: string;
  // The ladder new schedules are made on (f09); items on older ladders move at their next review.
  active_ladder_id: number;
};

export type SettingsResponse = { active_ladder_id: number };
export type UpdateSettingsRequest = { active_ladder_id: number };

export const REVIEW_DIRECTIONS = ["ur_en", "en_ur", "oral"] as const;
export type ReviewDirection = (typeof REVIEW_DIRECTIONS)[number];

// How much help the prompt gave (research §8). PWA reviews are always "none"; f06/f07 set the rest.
export const PROMPT_SUPPORTS = ["none", "hint", "answer_exposed", "repetition"] as const;
export type PromptSupport = (typeof PROMPT_SUPPORTS)[number];

export const REVIEW_SOURCES = ["pwa", "coach"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export type ReviewEvent = {
  id: string;
  vocab_id: string;
  reviewed_at: string;
  grade: Grade;
  direction: ReviewDirection;
  source: ReviewSource;
  handoff_id: string | null;
  prompt_support: PromptSupport;
  // The grade's delta before clamping; null on events migrated from before f09.
  applied_delta: number | null;
  ladder_before_id: number;
  step_before: number;
  interval_before: number;
  due_before: string | null;
  ladder_id: number;
  step_after: number;
  interval_after: number;
  due_after: string | null;
};

export type ReviewRequest = { grade: Grade; direction: ReviewDirection };
export type ReviewResponse = { item: VocabItem; event: ReviewEvent };

export type Tag = { name: string; description: string | null };
export type TagsResponse = { tags: Tag[] };

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
  // Every ladder version, so ladder_id values in the export are self-describing.
  ladders: readonly Ladder[];
  active_ladder_id: number;
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
  // Airtable's 0-6 level; stored as that rung of the legacy ladder.
  mastery: LegacyLevel;
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
  // Recomputed from last_reviewed_on + legacy interval(mastery); present unless rejected.
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
