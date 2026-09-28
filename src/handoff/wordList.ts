// f14 (FR-F10): turns a word list pasted from ChatGPT into Urdu entries for /api/vocab/match. The
// chat is asked for bare lines, but may still number them or add a roman spelling and a meaning,
// so each line is split at separators and only the Arabic-script text of each piece is kept.

import { MAX_MATCH_WORDS } from "../../shared/api";
import { urduKey } from "../../shared/normalize";

// Commas, semicolons (Latin and Urdu), pipes, slashes, colons, tabs, and a dash with spaces round it.
const SEPARATORS = /[,\u{060C};\u{061B}|/:\t]|\s[-\u{2013}\u{2014}]\s/u;
// Anything but Arabic-script letters, whitespace and ZWNJ (some Urdu spellings need it).
const NOT_URDU =
  /[^\u{0600}-\u{06FF}\u{0750}-\u{077F}\u{FB50}-\u{FDFF}\u{FE70}-\u{FEFF}\s\u{200C}]/gu;
const DIGITS_AND_PUNCTUATION = /[\p{Nd}\p{P}]/gu;
const FENCE = /^\s*```/;

export type WordList = { words: string[]; skipped: number };

export function extractWords(text: string): WordList {
  const words: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "" || FENCE.test(line)) continue;
    let found = false;
    for (const piece of line.split(SEPARATORS)) {
      const word = piece
        .replace(NOT_URDU, "")
        .replace(DIGITS_AND_PUNCTUATION, "")
        .replace(/\s+/gu, " ")
        .trim();
      const key = urduKey(word);
      if (key === "") continue;
      found = true;
      if (seen.has(key)) continue;
      seen.add(key);
      words.push(word);
    }
    if (!found) skipped += 1;
  }
  return { words, skipped };
}

export function tooManyWords(list: WordList): boolean {
  return list.words.length > MAX_MATCH_WORDS;
}

// The chat's vocab-json merges its latest list with words typed after the command, so the copied
// text says to use only these (chatgpt-project-instructions.md names the override).
export const ONLY_THESE = "vocab-json — only these words, none from earlier in the chat:";

export function chatText(words: readonly string[]): string {
  return [ONLY_THESE, ...words].join("\n");
}
