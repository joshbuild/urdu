// f04 s04: the edit form's decidable logic (FR-D2), kept pure for the node test project.
// A rung edit is a correction, not a review: PATCH puts the item on the active ladder at that rung,
// recomputes its due time and writes no review event (FR-A8), so nothing here touches dates.

import type { UpdateVocabRequest, VocabItem } from "../../shared/api";
import { ladder, nearestStep } from "../../shared/ladders";
import type { VocabKind } from "../../shared/normalize";
import { cefrLevel, isTopic } from "../../shared/topics";
import { type AddDraft, cleanTags } from "../reader/addVocab";

export type EditDraft = AddDraft & { kind: VocabKind; ladder_step: number };

const OPTIONAL_TEXT = ["roman", "english", "notes", "example_urdu", "example_english"] as const;

// The rung the edit form offers as "unchanged". An item still on an older ladder shows the active
// rung it would move to at its next review (f09), and is only moved if the rung is changed.
export function currentStep(item: VocabItem, activeLadderId: number): number {
  return item.ladder_id === activeLadderId
    ? item.ladder_step
    : nearestStep(ladder(activeLadderId), item.interval_seconds);
}

export function draftFromItem(item: VocabItem, activeLadderId: number): EditDraft {
  return {
    urdu: item.urdu,
    roman: item.roman ?? "",
    english: item.english ?? "",
    notes: item.notes ?? "",
    example_urdu: item.example_urdu ?? "",
    example_english: item.example_english ?? "",
    topic: item.topic ?? "",
    cefr: item.cefr ?? "",
    tags: cleanTags(item.tags, item.topic ?? ""),
    kind: item.kind,
    ladder_step: currentStep(item, activeLadderId),
  };
}

// f18: free tags from before the topic list, which the next save drops.
export function legacyTags(item: VocabItem): string[] {
  return item.tags.filter((tag) => !isTopic(tag));
}

// Only the fields that differ from the stored item, so an edit cannot overwrite a field it never
// touched. A cleared optional field is sent as null. Null means nothing changed.
export function buildUpdate(
  item: VocabItem,
  draft: EditDraft,
  activeLadderId: number,
): UpdateVocabRequest | null {
  const update: UpdateVocabRequest = {};
  const urdu = draft.urdu.trim();
  if (urdu !== item.urdu) update.urdu = urdu;
  if (draft.kind !== item.kind) update.kind = draft.kind;
  for (const field of OPTIONAL_TEXT) {
    const value = draft[field].trim() || null;
    if (value !== item[field]) update[field] = value;
  }
  const topic = isTopic(draft.topic) ? draft.topic : null;
  if (topic !== item.topic) update.topic = topic;
  const cefr = cefrLevel(draft.cefr);
  if (cefr !== item.cefr) update.cefr = cefr;
  // Sent whenever it differs, so a save also drops legacy free tags (f18).
  const tags = cleanTags(draft.tags, draft.topic);
  if (tags.join("\n") !== item.tags.join("\n")) update.tags = tags;
  if (draft.ladder_step !== currentStep(item, activeLadderId)) {
    update.ladder_step = draft.ladder_step;
  }
  return Object.keys(update).length ? update : null;
}
