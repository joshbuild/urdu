// Urdu normalization for `urdu_key` (PRD Appendix B, FR-A5). Equal keys mean duplicate.

const TASHKEEL = /[\u{064B}-\u{0652}\u{0670}]/gu;
const TATWEEL = /\u{0640}/gu;
const ARABIC_LETTERS = /[\u{064A}\u{0643}\u{0647}\u{0629}]/gu;
const URDU_LETTER: Readonly<Record<string, string>> = {
  "\u{064A}": "\u{06CC}", // Arabic yeh -> Farsi/Urdu yeh
  "\u{0643}": "\u{06A9}", // Arabic kaf -> keheh
  "\u{0647}": "\u{06C1}", // Arabic heh -> heh goal
  "\u{0629}": "\u{06C1}", // teh marbuta -> heh goal
};
// Unicode format characters: ZWNJ, ZWJ, bidi marks, BOM, soft hyphen.
const FORMAT_CHARS = /\p{Cf}/gu;
// Punctuation (Urdu ۔ ، ؟ and ASCII) and symbols become spaces, so "ہاں،جی" and "ہاں، جی" match.
const PUNCTUATION = /[\p{P}\p{S}]/gu;
const WHITESPACE = /\s+/gu;

export function urduKey(text: string): string {
  return text
    .normalize("NFC")
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(ARABIC_LETTERS, (c) => URDU_LETTER[c] ?? c)
    .replace(FORMAT_CHARS, "")
    .replace(PUNCTUATION, " ")
    .replace(WHITESPACE, " ")
    .trim();
}

export const VOCAB_KINDS = ["word", "phrase"] as const;

export type VocabKind = (typeof VOCAB_KINDS)[number];

export function inferKind(text: string): VocabKind {
  return urduKey(text).includes(" ") ? "phrase" : "word";
}
