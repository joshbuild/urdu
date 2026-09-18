// f04 s04: the edit form's decidable logic (FR-D2), kept pure for the node test project.
// A mastery edit is a correction, not a review: PATCH recomputes next review and writes no review
// event (FR-A8), so nothing here touches dates.

import type { UpdateVocabRequest, VocabItem } from "../../shared/api";
import type { Mastery } from "../../shared/mastery";
import type { VocabKind } from "../../shared/normalize";
import { type AddDraft, parseTags } from "../reader/addVocab";

export type EditDraft = AddDraft & { kind: VocabKind; mastery: Mastery };

const OPTIONAL_TEXT = ["roman", "english", "notes", "example_urdu", "example_english"] as const;

export function draftFromItem(item: VocabItem): EditDraft {
  return {
    urdu: item.urdu,
    roman: item.roman ?? "",
    english: item.english ?? "",
    notes: item.notes ?? "",
    example_urdu: item.example_urdu ?? "",
    example_english: item.example_english ?? "",
    tags: item.tags.join(", "),
    kind: item.kind,
    mastery: item.mastery,
  };
}

// Only the fields that differ from the stored item, so an edit cannot overwrite a field it never
// touched. A cleared optional field is sent as null. Null means nothing changed.
export function buildUpdate(item: VocabItem, draft: EditDraft): UpdateVocabRequest | null {
  const update: UpdateVocabRequest = {};
  const urdu = draft.urdu.trim();
  if (urdu !== item.urdu) update.urdu = urdu;
  if (draft.kind !== item.kind) update.kind = draft.kind;
  for (const field of OPTIONAL_TEXT) {
    const value = draft[field].trim() || null;
    if (value !== item[field]) update[field] = value;
  }
  const tags = parseTags(draft.tags);
  if (tags.join("\n") !== item.tags.join("\n")) update.tags = tags;
  if (draft.mastery !== item.mastery) update.mastery = draft.mastery;
  return Object.keys(update).length ? update : null;
}
