// The voice Coach's tools (f07, FR-F1..F3). The model proposes through the browser; these
// functions decide, over the same vocab and review services the PWA uses. Each state-changing
// call is recorded in `handoffs` as `voice:<session id>:<call id>`, so a retried call returns its
// first result instead of applying twice.

import type {
  AddToVaultResult,
  GetVocabResult,
  HandoffStatus,
  RecordReviewResult,
  VocabItem,
} from "../../shared/api";
import { bandName, masteryBand } from "../../shared/mastery";
import { urduKey } from "../../shared/normalize";
import { type ID_CONFLICT, recordHandoff, storedOutcome } from "./handoff";
import { applyReview } from "./review";
import { createVocab, dueVocab, findIdByKey, getVocab, listVocab } from "./vocab";
import type { AddItem, GetVocabArgs, RecordReviewArgs, VoiceCall } from "./voice-input";

const entry = (item: VocabItem) => ({
  id: item.id,
  urdu: item.urdu,
  roman: item.roman,
  english: item.english,
  mastery: bandName(masteryBand(item)),
  due_at: item.due_at,
});

// FR-F1. Due items come in review order; "all" newest first.
export async function voiceGetVocab(
  db: D1Database,
  args: GetVocabArgs,
  now: Date,
): Promise<GetVocabResult> {
  const at = now.toISOString();
  if (args.scope === "due") {
    const [items, all] = await Promise.all([
      dueVocab(db, at, args.limit, args.tag),
      listVocab(db, { due: true, tag: args.tag, sort: "next_review", limit: 1, offset: 0 }, at),
    ]);
    return { items: items.map(entry), total: all.total };
  }
  const page = await listVocab(
    db,
    { tag: args.tag, sort: "added", limit: args.limit, offset: 0 },
    at,
  );
  return { items: page.items.map(entry), total: page.total };
}

// Runs `work` once per call id. A repeat returns the stored result; `keep` says whether a result
// is final (a stale review is not, so its retry can succeed).
async function once<T>(
  db: D1Database,
  call: VoiceCall,
  status: HandoffStatus,
  now: Date,
  work: () => Promise<T>,
  keep: (result: T) => boolean = () => true,
): Promise<T | typeof ID_CONFLICT> {
  const id = `voice:${call.sessionId}:${call.callId}`;
  const stored = await storedOutcome<T>(db, id, status);
  if (stored !== null) return stored;
  const result = await work();
  if (keep(result)) await recordHandoff(db, id, call.args, status, result, now).run();
  return result;
}

// FR-F2: created on the active ladder's first rung with source coach, or reported as a duplicate
// with the existing item's meaning so the Coach can say what is already there.
export function voiceAddToVault(
  db: D1Database,
  call: VoiceCall,
  items: AddItem[],
  now: Date,
  activeLadderId: number,
): Promise<AddToVaultResult | typeof ID_CONFLICT> {
  return once(db, call, "voice_add", now, async () => {
    const results: AddToVaultResult["results"] = [];
    for (const item of items) {
      const created = await createVocab(db, { ...item, source: "coach" }, now, activeLadderId);
      if (created.ok) {
        results.push({ urdu: item.urdu, outcome: "created", id: created.item.id });
      } else if (created.error === "duplicate") {
        const existing = await getVocab(db, created.existingId);
        results.push({
          urdu: item.urdu,
          outcome: "duplicate",
          existing_id: created.existingId,
          existing_english: existing?.english ?? null,
        });
      } else {
        results.push({
          urdu: item.urdu,
          outcome: "rejected",
          reason: "must contain Urdu letters, not only punctuation",
        });
      }
    }
    return { results };
  });
}

// FR-F3 resolution: by id, then by normalized Urdu. An id and Urdu that disagree, or no match,
// is reported back; the item is never guessed.
async function resolve(
  db: D1Database,
  args: RecordReviewArgs,
): Promise<VocabItem | { reason: string }> {
  if (args.vocabId) {
    const item = await getVocab(db, args.vocabId);
    if (item) {
      if (args.urdu && urduKey(args.urdu) !== item.urdu_key) {
        return { reason: `vocab_id ${item.id} is ${item.urdu}, not ${args.urdu}` };
      }
      return item;
    }
    if (!args.urdu) return { reason: `no item has vocab_id ${args.vocabId}` };
  }
  const urdu = args.urdu as string;
  const id = await findIdByKey(db, urduKey(urdu));
  const item = id ? await getVocab(db, id) : null;
  return item ?? { reason: `${urdu} is not in the vocabulary` };
}

export function voiceRecordReview(
  db: D1Database,
  call: VoiceCall,
  args: RecordReviewArgs,
  now: Date,
  activeLadderId: number,
): Promise<RecordReviewResult | typeof ID_CONFLICT> {
  return once(
    db,
    call,
    "voice_review",
    now,
    async (): Promise<RecordReviewResult> => {
      const item = await resolve(db, args);
      if ("reason" in item) return { outcome: "unmatched", reason: item.reason };
      const result = await applyReview(
        db,
        item,
        {
          grade: args.grade,
          direction: "oral",
          source: "coach",
          handoffId: call.sessionId,
          promptSupport: args.promptSupport,
        },
        now,
        activeLadderId,
      );
      if (!result.ok) {
        return result.error === "stale"
          ? { outcome: "stale", reason: "the item changed while recording; try again" }
          : { outcome: "unmatched", reason: `${item.urdu} was deleted` };
      }
      return {
        outcome: "recorded",
        vocab_id: item.id,
        urdu: item.urdu,
        grade: args.grade,
        counted: args.promptSupport === "none",
        applied_delta: result.event.applied_delta ?? 0,
        mastery: bandName(masteryBand(result.item)),
        due_at: result.item.due_at,
      };
    },
    (r) => r.outcome !== "stale",
  );
}
