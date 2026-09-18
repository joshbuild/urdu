// f03 s07: Define's decidable logic (FR-C7), kept pure so it can be tested in the node project.
// No LLM here by design (PRD §2.2; DECISIONS 260917h keeps Define LLM-free).

import type { VocabItem } from "../../shared/api";
import { urduKey } from "../../shared/normalize";

// The vault half of Define: an exact `urdu_key` match, the same equality duplicate detection
// uses. The list endpoint's `q` is a substring search, so its results are narrowed here.
export function exactMatch(items: VocabItem[], term: string): VocabItem | null {
  const key = urduKey(term);
  if (!key) return null;
  return items.find((item) => item.urdu_key === key) ?? null;
}

export interface DictionaryLink {
  label: string;
  href: string;
}

// The external half, in the order the PRD names them (sponsor confirmed 2026-09-17).
export function dictionaryLinks(term: string): DictionaryLink[] {
  const text = term.trim();
  const q = encodeURIComponent(text);
  return [
    { label: "Rekhta dictionary", href: `https://www.rekhta.org/urdudictionary?keyword=${q}` },
    { label: "Wiktionary", href: `https://en.wiktionary.org/wiki/${q}#Urdu` },
    {
      label: "Google Translate",
      href: `https://translate.google.com/?sl=ur&tl=en&op=translate&text=${q}`,
    },
  ];
}
