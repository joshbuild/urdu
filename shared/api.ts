// Request and response shapes for the /api vocab, review and export routes (f01 s05, s06). Field names match the
// D1 columns and the Coach contract (snake_case).

import type { BatchCell } from "./coverage";
import type { Dash } from "./dash";
import type { Ladder } from "./ladders";
import type { Grade, LegacyLevel } from "./mastery";
import type { VocabKind } from "./normalize";
import type { CefrLevel, QuotaLevel } from "./topics";

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
  // f18: one topic slug (shared/topics.ts) and a CEFR level; unclassified while either is null.
  topic: string | null;
  cefr: CefrLevel | null;
  // 0–2 secondary topic slugs since f18; older rows may still hold free tags.
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
  // UTC instant this item was last in an applied accuracy check (f11); null means never checked.
  // Only the check apply writes it, and a stamp is not an edit, so updated_at is left alone.
  checked_at: string | null;
  // UTC instant this item was last in an applied completeness check (f13); null means never.
  // Written like checked_at: only by the check apply, and without touching updated_at.
  filled_at: string | null;
  // f17 (FR-K): the harvest whose paste created this item, if any.
  harvest_id: string | null;
  // UTC instant the item entered review; null means queued (in the vault, never due). Release is
  // not an edit, so it leaves updated_at alone.
  released_at: string | null;
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
  topic: string | null;
  cefr: CefrLevel | null;
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
// mp03: due times of items not yet due, ascending, with the Worker's clock to count them against.
export type UpcomingResponse = { now: string; due_at: string[] };
// f17 (FR-K): queued items, the new pile (released, never reviewed), and the batch size.
export type IntakeCounts = { queued: number; new: number; batch_size: number };
export type IntakeReleaseResponse = { released: number; queued: number };

export type StatusResponse = {
  total: number;
  due: number;
  today: string;
  // The ladder new schedules are made on (f09); items on older ladders move at their next review.
  active_ladder_id: number;
  intake: IntakeCounts;
};

export type SettingsResponse = {
  active_ladder_id: number;
  // Daily voice spend caps in dollars (f07 s04).
  voice_soft_cap_usd: number;
  voice_hard_cap_usd: number;
  // f17: new words per day (the top-up target) and the size of Intake, 1–50.
  intake_batch_size: number;
  // f18: how many words one Next batch asks for in all, 1–50.
  next_batch_size: number;
};
export type UpdateSettingsRequest = Partial<SettingsResponse>;

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
export type AmendReviewRequest = { grade: Grade };

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

// f17 (FR-K): a story or page to harvest. The URL, when set, is its identity.
export type Source = {
  id: string;
  name: string;
  url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// f17 (FR-K): one pass over a source at a filter such as "CEFR A2+"; collects one or more pastes.
export type Harvest = {
  id: string;
  source_id: string;
  filter: string | null;
  created_at: string;
};

export const MAX_SOURCE_NAME_LENGTH = 200;
export const MAX_SOURCE_URL_LENGTH = 2000;
export const MAX_HARVEST_FILTER_LENGTH = 100;

// POST /api/sources; PATCH takes any subset. url and notes accept null (or "") to clear.
export type SourceRequest = { name: string; url?: string | null; notes?: string | null };
export type HarvestRequest = { filter?: string | null };
// 409 on a URL another source already has; the client opens that source.
export type SourceConflictResponse = { error: "duplicate_source"; existing_id: string };

// Item counts for one harvest. started = reviewed at least once.
export type HarvestCounts = { total: number; queued: number; started: number };
export type HarvestSummary = Harvest & HarvestCounts;

export type SourceStatus = "to_harvest" | "harvested";
export type SourceSummary = Source & {
  status: SourceStatus;
  harvest_count: number;
  // The newest harvest, if any.
  latest: { filter: string | null; created_at: string } | null;
};

// GET /api/harvest: the tank, then to-harvest sources (newest first), then harvested sources by
// latest harvest, newest first.
export type HarvestOverview = { intake: IntakeCounts; sources: SourceSummary[] };
// GET /api/sources/:id: harvests newest first; words = items linked through any of them.
export type SourceDetail = { source: Source; harvests: HarvestSummary[]; words: number };
// GET /api/harvests/:id.
export type HarvestDetail = { harvest: HarvestSummary; source: Source };

// f18: GET /api/coverage. counts[topic][level] for every classified item (topic and level set),
// queued ones included; totals[topic] counts items with that topic whatever their level.
// Topics with no items are absent. unclassified: topic or level null.
export type CoverageResponse = {
  counts: Record<string, Partial<Record<CefrLevel, number>>>;
  totals: Record<string, number>;
  unclassified: number;
  total: number;
};

// f18: POST /api/batches. Cells up to the Next batch size (settings.next_batch_size): the emptiest
// at the lowest unfinished level, then on up; a tapped cell first, then the walk from its level.
export type BatchIssueRequest = { topic?: string; level?: QuotaLevel };
// exclusions: the Urdu of every item in the vault, queued ones too.
export type BatchIssueResponse = {
  handoff_id: string;
  cells: BatchCell[];
  exclusions: string[];
};
// POST /api/batches/handoffs: the FR-F4 reply, imported into a new harvest of the Topics source.
export type BatchPasteResponse = HandoffResponse & { harvest_id: string };

// f18: classify. POST /api/handoffs/classify-batch takes {count?} (1–100, default 100) and lists
// unclassified items (topic or level null), oldest first, numbered from 1.
export const MAX_CLASSIFY_BATCH = 100;
export type ClassifyItem = { n: number; vocab_id: string; urdu: string; english: string | null };
export type ClassifyBatchResponse = {
  // Null when every item is classified: nothing recorded.
  handoff_id: string | null;
  items: ClassifyItem[];
  unclassified: number;
};
// POST /api/handoffs/classify: rows are [n, urdu, topic, level] or [n, urdu, topic, level, tags],
// judged row by row. `accept` (the ticked n) is absent on ?preview=1 and required on apply.
export type ClassifyRequest = { handoff_id: string; rows: unknown[]; accept?: number[] };
type Classified = {
  n: number;
  vocab_id: string;
  urdu: string;
  topic: string;
  cefr: CefrLevel;
  tags: string[];
  // Secondary tags left out: unknown, the topic itself, or past the second.
  dropped?: string[];
};
export type ClassifyPlan =
  // n null: the row was not even [n, urdu, …].
  | { n: number | null; urdu: string; outcome: "rejected"; reason: string }
  // In the batch, absent from the reply: stays unclassified.
  | { n: number; vocab_id: string; urdu: string; outcome: "missing" }
  | (Classified & { outcome: "classify" });
// After apply: "stale" when the item's topic or level changed after the batch was issued.
export type ClassifyResult =
  | Exclude<ClassifyPlan, { outcome: "classify" }>
  | (Classified & { outcome: "classified" | "declined" | "stale" });
export type ClassifyResponse = {
  handoff_id: string;
  preview: boolean;
  // A batch already applied: nothing written, the stored results.
  repeat: boolean;
  batch_size: number;
  results: (ClassifyPlan | ClassifyResult)[];
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
  sources: Source[];
  harvests: Harvest[];
};

// f16 (FR-J): the Dash's six blocks, derived by shared/dash.ts. The active ladder lets the client
// word the recall hint at either end of the ladder range.
export type DashResponse = Dash & { active_ladder_id: number; generated_at: string };

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

// --- Clipboard handoff (f06, FR-F4/F6). The app writes handoff_id and session_at into the
// --- prompt it copies; the chat echoes them back with its proposals.

export const MAX_HANDOFF_PROPOSALS = 50;
export const MAX_HANDOFF_ID_LENGTH = 100;

// handoffs.status values (Appendix A leaves them to f06). The voice ones (f07) key one tool call
// each, `voice:<session id>:<call id>`, so a retried call returns its first result. A check batch
// (f11) is `check_issued` from Copy check prompt until its corrections are applied, then `checked`.
// A Next batch request (f18) is `batch_issued` until its reply is pasted, then `applied`.
export const HANDOFF_STATUSES = [
  "applied",
  "revised",
  "voice_add",
  "voice_review",
  "check_issued",
  "checked",
  "batch_issued",
  // While a batch reply is being imported, so a second paste of it waits.
  "batch_pasting",
  // A classify batch (f18), from Copy classify prompt until its reply is applied.
  "classify_issued",
  "classified",
] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

// FR-F2 candidate shape.
export type HandoffProposal = {
  urdu: string;
  roman?: string | null;
  english?: string | null;
  notes?: string | null;
  example_urdu?: string | null;
  example_english?: string | null;
  // f18: lenient. An unknown topic or level becomes null and a bad tag is dropped, each noted in
  // the result's `dropped`, so a chat that has not learnt the slug list never fails a paste.
  topic?: string | null;
  cefr?: CefrLevel | null;
  tags?: string[];
  // Set by the Worker's parser (what the lenient rules left out); a client never sends it.
  dropped?: string[];
};

export type HandoffRequest = {
  handoff_id: string;
  session_at: string;
  proposals: HandoffProposal[];
};

export type ProposalResult =
  // dropped (f18): what the lenient topic, level and tag rules left out, e.g. "tag objects".
  | { index: number; urdu: string; outcome: "created"; id: string; dropped?: string[] }
  | { index: number; urdu: string; outcome: "duplicate"; existing_id: string }
  | { index: number; urdu: string; outcome: "rejected"; reason: string };

export type HandoffResponse = {
  handoff_id: string;
  // True when this handoff_id was already imported: nothing was written, and results are the
  // stored outcome of the first import.
  repeat: boolean;
  results: ProposalResult[];
};

// --- New word finder (f14, FR-F10). A bare word list from the chat, matched against the vault by
// --- urdu_key before the chat writes full entries. Read-only: nothing is recorded.

export const MAX_MATCH_WORDS = 500;

export type MatchRequest = { words: string[] };

export type MatchResult = { urdu: string; existing: { id: string; urdu: string } | null };

export type MatchResponse = { results: MatchResult[] };

// The text fields a check may correct, remove or fill (FR-F9); FR-F7 fill-ins used them first.
export const FILLABLE_FIELDS = [
  "roman",
  "english",
  "notes",
  "example_urdu",
  "example_english",
] as const;
export type FillableField = (typeof FILLABLE_FIELDS)[number];

// A pasted row naming an item by id, echoing its urdu, with proposed field values. The base of a
// check correction.
export type Revision = { vocab_id: string; urdu: string } & Partial<
  Record<FillableField, string | null>
>;

// f11 accuracy check (FR-F9). A batch is the least recently checked items, recorded by the Worker
// under a handoff_id it mints, so the corrections paste can be judged against it. f13 adds modes:
// correctness fixes wrong fields, completeness fills empty ones, both does the two.
export const MAX_CHECK_BATCH = 50;
export const DEFAULT_CHECK_COUNT = 20;

export const CHECK_MODES = ["correctness", "completeness", "both"] as const;
export type CheckMode = (typeof CHECK_MODES)[number];

// The body of POST /api/handoffs/check-batch. Every key is optional; {} is f11's request.
export type CheckOptions = {
  mode: CheckMode;
  // Non-empty: the fields the chat may check or fill.
  fields: FillableField[];
  count: number;
  // Only items never checked in this mode (checked_at or filled_at null).
  only_unchecked: boolean;
};

export type CheckBatchResponse = {
  // Null when no item qualifies: nothing to check, and nothing recorded.
  handoff_id: string | null;
  items: VocabItem[];
  // For the copy note: items in the vault this mode and these fields could check, and how many
  // of them have never been checked this way.
  candidates: number;
  unchecked: number;
};

// A proposed field is present: a string replaces or fills it, null removes it. `urdu` is the
// echo that matches the item; a suspect spelling goes in `urdu_suggestion`, never applied.
export type Correction = {
  vocab_id: string;
  urdu: string;
  reason: string;
  urdu_suggestion?: string;
} & Partial<Record<FillableField, string | null>>;

// One ticked item: each accepted field with the old value the preview showed, which the write is
// conditioned on, and whether to put the item back on the first rung.
export type CorrectionAccept = {
  vocab_id: string;
  fields: Partial<Record<FillableField, string | null>>;
  reset: boolean;
};

export type CorrectionsRequest = {
  handoff_id: string;
  corrections: Correction[];
  // Absent on a preview, required on apply; empty applies nothing and only marks the batch checked.
  accept?: CorrectionAccept[];
};

export type FieldChange = { field: FillableField; old: string | null; new: string | null };

export type CorrectionPlan =
  | { vocab_id: string; urdu: string; outcome: "rejected"; reason: string }
  | {
      vocab_id: string;
      urdu: string;
      // "nothing": no proposed value differs from the stored one.
      outcome: "correct" | "nothing";
      changes: FieldChange[];
      // f13: proposed changes the batch's mode or fields don't allow, never tickable: a field not
      // chosen, a fill in a correctness check, an overwrite or removal in a completeness check.
      ignored: FillableField[];
      reason: string;
      urdu_suggestion?: string;
    };

export const RESET_OUTCOMES = ["applied", "skipped", "not_asked"] as const;
export type ResetOutcome = (typeof RESET_OUTCOMES)[number];

export type CorrectionResult =
  | { vocab_id: string; urdu: string; outcome: "rejected"; reason: string }
  | {
      vocab_id: string;
      urdu: string;
      outcome: "checked";
      written: FieldChange[];
      // Accepted, but the stored value had changed since the preview, so it was left alone.
      kept: FillableField[];
      // Proposed changes left unticked.
      declined: FillableField[];
      // "skipped": the schedule changed (e.g. a review) between the read and the write.
      reset: ResetOutcome;
      reason: string;
      urdu_suggestion?: string;
    };

// A repeat (the batch was already applied) always returns the applied shape with preview false.
export type CorrectionsResponse =
  | {
      handoff_id: string;
      preview: true;
      repeat: false;
      // f13: the batch's mode; a batch issued before modes reports correctness.
      mode: CheckMode;
      batch_size: number;
      results: CorrectionPlan[];
    }
  | {
      handoff_id: string;
      preview: false;
      repeat: boolean;
      mode: CheckMode;
      // Every item in the batch is stamped checked, including those the chat left out.
      batch_size: number;
      results: CorrectionResult[];
    };

// f07 voice Coach (FR-B5, FR-F1..F3 through cookie routes, DECISIONS 260918h).
// The spend figures ride the create response so the screen can warn at the soft cap from its first
// frame, without a second round trip (f07 s04).
export type VoiceSessionResponse = { sessionId: string; sdp: string } & VoiceSpendResponse;

// f07 s04 spend (FR-G, FR-I1). Dollars, already priced by shared/voice-cost.ts.
export type VoiceSpendResponse = {
  // The HOME_TZ calendar day these totals cover.
  day: string;
  today_usd: number;
  soft_cap_usd: number;
  hard_cap_usd: number;
};

// What the browser reports from the data channel. Cumulative, so a repeat is not additive.
export type VoiceUsageRequest = {
  session_id: string;
  seconds: number;
  backend_input_tokens?: number;
  backend_output_tokens?: number;
  // The session is over: stamps ended_at.
  ended?: boolean;
};

export type VoiceUsageResponse = VoiceSpendResponse & { session_usd: number };

// The broker's refusal once today's spend has reached the hard cap.
export type VoiceCapReachedResponse = { error: "cap_reached" } & VoiceSpendResponse;

// Every tool route takes this envelope. `arguments` is the tool call's parsed JSON; the session
// and call ids make a retried call return its first result.
export type VoiceToolRequest = { session_id: string; call_id: string; arguments: unknown };
export const MAX_VOICE_ID_LENGTH = 100;

export type VoiceVocabEntry = {
  id: string;
  urdu: string;
  roman: string | null;
  english: string | null;
  mastery: string;
  due_at: string | null;
};
export type GetVocabResult = { items: VoiceVocabEntry[]; total: number };

export type AddToVaultResult = {
  results: Array<
    | { urdu: string; outcome: "created"; id: string }
    | { urdu: string; outcome: "duplicate"; existing_id: string; existing_english: string | null }
    | { urdu: string; outcome: "rejected"; reason: string }
  >;
};

export type RecordReviewResult =
  | {
      outcome: "recorded";
      vocab_id: string;
      urdu: string;
      grade: string;
      // False when prompt support meant the schedule was left alone.
      counted: boolean;
      applied_delta: number;
      mastery: string;
      due_at: string | null;
    }
  | { outcome: "unmatched" | "stale"; reason: string };

export type VoiceToolResult = GetVocabResult | AddToVaultResult | RecordReviewResult;
