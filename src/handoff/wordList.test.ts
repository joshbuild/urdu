import { describe, expect, it } from "vitest";
import { MAX_MATCH_WORDS } from "../../shared/api";
import { chatText, extractWords, ONLY_THESE, tooManyWords } from "./wordList";

const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب
const KITAB_WITH_KASRA = "\u{06A9}\u{0650}\u{062A}\u{0627}\u{0628}"; // کِتاب
const PANI = "\u{067E}\u{0627}\u{0646}\u{06CC}"; // پانی
const GHAR = "\u{06AF}\u{06BE}\u{0631}"; // گھر
const KYA_HAAL_HAI = "\u{06A9}\u{06CC}\u{0627} \u{062D}\u{0627}\u{0644} \u{06C1}\u{06D2}"; // کیا حال ہے

describe("extractWords", () => {
  it("takes one entry per line", () => {
    expect(extractWords(`${KITAB}\n${PANI}\r\n${GHAR}\n`)).toEqual({
      words: [KITAB, PANI, GHAR],
      skipped: 0,
    });
  });

  it("strips numbering, bullets, parentheses and Latin glosses", () => {
    const text = `1. ${KITAB} (kitaab)\n- ${PANI} paani\n* ${GHAR}\n\u{06F4}. ${KYA_HAAL_HAI}`;
    expect(extractWords(text).words).toEqual([KITAB, PANI, GHAR, KYA_HAAL_HAI]);
  });

  it.each([
    [", ", "a comma"],
    ["\u{060C} ", "an Urdu comma"],
    ["; ", "a semicolon"],
    ["\u{061B}", "an Urdu semicolon"],
    [" | ", "a pipe"],
    [" / ", "a slash"],
    [": ", "a colon"],
    ["\t", "a tab"],
    [" - ", "a spaced hyphen"],
    [" \u{2013} ", "a spaced en dash"],
    [" \u{2014} ", "a spaced em dash"],
  ])("splits at %j (%s)", (separator) => {
    expect(extractWords(`${KITAB}${separator}${PANI}`).words).toEqual([KITAB, PANI]);
  });

  it("drops the roman and English pieces of a glossed line", () => {
    expect(extractWords(`${KITAB} \u{2013} kitaab \u{2013} book`)).toEqual({
      words: [KITAB],
      skipped: 0,
    });
  });

  it("keeps a phrase whole and drops its closing punctuation", () => {
    expect(extractWords(`${KYA_HAAL_HAI}\u{061F}\n${PANI}\u{06D4}`).words).toEqual([
      KYA_HAAL_HAI,
      PANI,
    ]);
  });

  it("drops code fences and counts lines with no Urdu", () => {
    const text = `\`\`\`text\n${KITAB}\nbook\n\n42\n\`\`\``;
    expect(extractWords(text)).toEqual({ words: [KITAB], skipped: 2 });
  });

  it("keeps the first spelling of words that share a key", () => {
    expect(extractWords(`${KITAB}\n${KITAB_WITH_KASRA}\n${KITAB}, ${PANI}`)).toEqual({
      words: [KITAB, PANI],
      skipped: 0,
    });
  });

  it("keeps a ZWNJ inside a word", () => {
    const word = `${KITAB}\u{200C}${PANI}`;
    expect(extractWords(word).words).toEqual([word]);
  });

  it("finds nothing in empty or English-only text", () => {
    expect(extractWords("")).toEqual({ words: [], skipped: 0 });
    expect(extractWords("book\nwater")).toEqual({ words: [], skipped: 2 });
  });
});

describe("tooManyWords", () => {
  it(`allows ${MAX_MATCH_WORDS} words and refuses one more`, () => {
    const words = (n: number) => Array.from({ length: n }, () => KITAB);
    expect(tooManyWords({ words: words(MAX_MATCH_WORDS), skipped: 0 })).toBe(false);
    expect(tooManyWords({ words: words(MAX_MATCH_WORDS + 1), skipped: 0 })).toBe(true);
  });
});

describe("chatText", () => {
  it("starts with the vocab-json override line, then one word per line", () => {
    expect(chatText([KITAB, KYA_HAAL_HAI])).toBe(`${ONLY_THESE}\n${KITAB}\n${KYA_HAAL_HAI}`);
    expect(ONLY_THESE.startsWith("vocab-json")).toBe(true);
  });
});
