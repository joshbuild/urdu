// f03 s06: the Add-to-vocab form's decidable logic (FR-C6), kept pure so it can be tested in the
// node project. The form component only holds state and posts what these functions build.

import type { CreateVocabRequest } from "../../shared/api";
import { inferKind } from "../../shared/normalize";

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

// Comma-separated, as typed on a phone keyboard; the Urdu comma (U+060C) counts too.
export function parseTags(input: string): string[] {
  const tags: string[] = [];
  for (const raw of input.split(/[,\u{060C}]/u)) {
    const tag = raw.trim();
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

export interface AddDraft {
  urdu: string;
  roman: string;
  english: string;
  notes: string;
  example_urdu: string;
  example_english: string;
  tags: string;
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
    tags: "",
  };
}

// Kind is inferred from the final Urdu, not the original selection, so an edited term is judged
// on what is actually saved. Blank optional fields are left out rather than sent as nulls.
export function buildCreateRequest(draft: AddDraft): CreateVocabRequest {
  const urdu = draft.urdu.trim();
  const request: CreateVocabRequest = { urdu, kind: inferKind(urdu), source: "reading" };
  for (const field of ["roman", "english", "notes", "example_urdu", "example_english"] as const) {
    const value = draft[field].trim();
    if (value) request[field] = value;
  }
  const tags = parseTags(draft.tags);
  if (tags.length) request.tags = tags;
  return request;
}
