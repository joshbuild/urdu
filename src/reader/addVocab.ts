// f03 s06: the Add-to-vocab form's decidable logic (FR-C6), kept pure so it can be tested in the
// node project. The form component only holds state and posts what these functions build.

import type { CreateVocabRequest } from "../../shared/api";
import { inferKind } from "../../shared/normalize";
import { cefrLevel, isTopic } from "../../shared/topics";

export type CreateSource = NonNullable<CreateVocabRequest["source"]>;

// Sentence ends in running Urdu: full stop (U+06D4), Arabic question mark (U+061F), and the Latin
// . ? ! that turn up in chat text. The terminator stays with its sentence.
const SENTENCE = /[^\u{06D4}\u{061F}.?!]+[\u{06D4}\u{061F}.?!]*/gu;

// FR-C6: the sentence the term was met in. The first sentence of the paragraph that contains the
// term; if the term spans a sentence break, the whole paragraph, since no single sentence holds it.
export function sourceSentence(paragraph: string, term: string): string {
  const text = paragraph.replace(/\s+/g, " ").trim();
  const needle = term.replace(/\s+/g, " ").trim();
  if (!needle) return "";
  for (const match of text.match(SENTENCE) ?? []) {
    const sentence = match.trim();
    if (sentence.includes(needle)) return sentence;
  }
  return text.includes(needle) ? text : "";
}

// f18: the secondary topics chosen in the form, as the Worker accepts them: known slugs, each
// once, never the item's topic, at most two. Blank pickers and legacy free tags fall away.
export function cleanTags(tags: readonly string[], topic: string): string[] {
  const out: string[] = [];
  for (const tag of tags) {
    if (isTopic(tag) && tag !== topic && !out.includes(tag) && out.length < 2) out.push(tag);
  }
  return out;
}

export interface AddDraft {
  urdu: string;
  roman: string;
  english: string;
  notes: string;
  example_urdu: string;
  example_english: string;
  // f18: a topic slug and a CEFR level, "" for none; up to two secondary slugs, "" for an empty
  // picker.
  topic: string;
  cefr: string;
  tags: string[];
}

export function initialDraft(term: string, sentence: string): AddDraft {
  return {
    urdu: term,
    roman: "",
    english: "",
    // PRD FR-C6 puts the source sentence in notes; a sentence that is only the term adds nothing.
    notes: sentence && sentence !== term ? sentence : "",
    example_urdu: "",
    example_english: "",
    topic: "",
    cefr: "",
    tags: [],
  };
}

// Kind is inferred from the final Urdu, not the original selection, so an edited term is judged
// on what is actually saved. Blank optional fields are left out rather than sent as nulls.
export function buildCreateRequest(
  draft: AddDraft,
  source: CreateSource = "reading",
): CreateVocabRequest {
  const urdu = draft.urdu.trim();
  const request: CreateVocabRequest = { urdu, kind: inferKind(urdu), source };
  for (const field of ["roman", "english", "notes", "example_urdu", "example_english"] as const) {
    const value = draft[field].trim();
    if (value) request[field] = value;
  }
  if (isTopic(draft.topic)) request.topic = draft.topic;
  const cefr = cefrLevel(draft.cefr);
  if (cefr) request.cefr = cefr;
  const tags = cleanTags(draft.tags, draft.topic);
  if (tags.length) request.tags = tags;
  return request;
}
