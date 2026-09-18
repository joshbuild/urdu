// f03 s03: splitting a paragraph into tappable tokens (FR-C3). Pure, so it is tested in the
// client node project rather than through a DOM.

export type Piece = {
  text: string;
  // Words are tappable and speakable; separators (spaces, punctuation) are rendered as plain text
  // so that a tap between words does nothing and native selection still flows across the gap.
  word: boolean;
};

// Code points that end a token, as ranges rather than a regex character class: the class would
// hold invisible characters (NBSP, the Urdu marks) that a formatter rewrites into literal bytes,
// and nobody can review a regex they cannot see. Urdu's own punctuation lives in the Arabic block
// alongside its letters, so it is listed out rather than excluded by range.
const SEPARATORS: ReadonlyArray<readonly [number, number]> = [
  [0x0021, 0x002f], // ! " # $ % & ' ( ) * + , - . /
  [0x003a, 0x0040], // : ; < = > ? @
  [0x005b, 0x0060], // [ \ ] ^ _ `
  [0x007b, 0x007e], // { | } ~
  [0x00a0, 0x00a0], // no-break space
  [0x060c, 0x060c], // Arabic comma
  [0x061b, 0x061b], // Arabic semicolon
  [0x061e, 0x061f], // Arabic triple dot, Arabic question mark
  [0x066a, 0x066d], // Arabic percent, decimal separator, thousands separator, five-pointed star
  [0x06d4, 0x06d4], // Urdu full stop
  [0x2010, 0x2027], // dashes, quotes, bullets, ellipsis
  [0x2030, 0x205e], // per-mille through vertical four dots
  [0x3001, 0x3002], // ideographic comma and full stop
  [0xfd3e, 0xfd3f], // ornate parentheses
];

// Tashkeel, ZWNJ and ZWJ never break a token: ZWNJ is what holds a compound together on screen
// (FR-C3), and the vowel marks belong to the letter they sit on.
function isWordChar(char: string): boolean {
  if (/\s/.test(char)) return false;
  const code = char.codePointAt(0) ?? 0;
  return !SEPARATORS.some(([from, to]) => code >= from && code <= to);
}

export function tokenize(text: string): Piece[] {
  // Iterate by code point, not code unit, so nothing can split inside a surrogate pair.
  const chars = [...text];
  const pieces: Piece[] = [];
  let start = 0;

  for (let index = 1; index <= chars.length; index++) {
    const head = chars[start];
    if (head === undefined) break;
    const next = chars[index];
    if (next !== undefined && isWordChar(next) === isWordChar(head)) continue;
    pieces.push({ text: chars.slice(start, index).join(""), word: isWordChar(head) });
    start = index;
  }
  return pieces;
}

// FR-C6 infers kind from the term; a token never contains whitespace, a selection may.
export function inferKind(term: string): "word" | "phrase" {
  return /\s/.test(term.trim()) ? "phrase" : "word";
}
