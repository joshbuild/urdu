import { describe, expect, it } from "vitest";
import { inferKind, urduKey } from "./normalize";

// Escapes keep the invisible and look-alike code points explicit.
const KITAB = "\u{06A9}\u{062A}\u{0627}\u{0628}"; // کتاب with Urdu keheh

describe("urduKey: single rules", () => {
  it("strips tashkeel", () => {
    expect(urduKey("\u{06A9}\u{0650}\u{062A}\u{0627}\u{0628}")).toBe(KITAB); // zer
    expect(
      urduKey(
        "\u{06A9}\u{064B}\u{064C}\u{064D}\u{064E}\u{064F}\u{0650}\u{0651}\u{0652}\u{062A}\u{0627}\u{0628}",
      ),
    ).toBe(KITAB);
  });

  it("strips superscript alef U+0670", () => {
    expect(urduKey("\u{0627}\u{0639}\u{0644}\u{06CC}\u{0670}")).toBe(
      "\u{0627}\u{0639}\u{0644}\u{06CC}",
    ); // اعلیٰ
  });

  it("strips tatweel", () => {
    expect(urduKey("\u{06A9}\u{0640}\u{0640}\u{062A}\u{0627}\u{0628}")).toBe(KITAB);
  });

  it("maps Arabic kaf to Urdu keheh", () => {
    expect(urduKey("\u{0643}\u{062A}\u{0627}\u{0628}")).toBe(KITAB);
  });

  it("maps Arabic yeh to Urdu yeh", () => {
    expect(urduKey("\u{0639}\u{0644}\u{064A}")).toBe("\u{0639}\u{0644}\u{06CC}");
  });

  it("maps Arabic heh and teh marbuta to heh goal", () => {
    expect(urduKey("\u{06A9}\u{0645}\u{0631}\u{0647}")).toBe("\u{06A9}\u{0645}\u{0631}\u{06C1}");
    expect(urduKey("\u{06A9}\u{0645}\u{0631}\u{0629}")).toBe("\u{06A9}\u{0645}\u{0631}\u{06C1}");
  });

  it("removes ZWNJ and ZWJ", () => {
    expect(urduKey("\u{06A9}\u{200C}\u{062A}\u{0627}\u{200D}\u{0628}")).toBe(KITAB);
  });

  it("removes other format characters", () => {
    // RLM, LRM, Arabic letter mark, BOM, soft hyphen.
    expect(
      urduKey("\u{200F}\u{06A9}\u{200E}\u{062A}\u{061C}\u{0627}\u{FEFF}\u{0628}\u{00AD}"),
    ).toBe(KITAB);
  });

  it("strips Urdu and ASCII punctuation", () => {
    expect(urduKey("\u{06A9}\u{06CC}\u{0627}\u{061F}")).toBe("\u{06A9}\u{06CC}\u{0627}"); // کیا؟
    expect(urduKey(`${KITAB}\u{06D4}`)).toBe(KITAB); // full stop ۔
    expect(urduKey(`"${KITAB}!?."`)).toBe(KITAB);
  });

  it("treats punctuation as a word break", () => {
    const han = "\u{06C1}\u{0627}\u{06BA}"; // ہاں
    const ji = "\u{062C}\u{06CC}"; // جی
    expect(urduKey(`${han}\u{060C}${ji}`)).toBe(`${han} ${ji}`); // Urdu comma, no space
    expect(urduKey(`${han}\u{060C} ${ji}\u{06D4}`)).toBe(`${han} ${ji}`);
  });

  it("collapses whitespace and trims", () => {
    expect(urduKey(`  ${KITAB} \t\n\u{00A0} ${KITAB}  `)).toBe(`${KITAB} ${KITAB}`);
  });
});

describe("urduKey: equivalence", () => {
  it("applies NFC so composed and decomposed forms match", () => {
    expect(urduKey("\u{0627}\u{0653}")).toBe(urduKey("\u{0622}")); // alef + maddah = آ
    expect(urduKey("\u{06C1}\u{0654}")).toBe(urduKey("\u{06C2}")); // heh goal + hamza = ۂ
  });

  it.each([
    ["tashkeel + Arabic kaf", "\u{0643}\u{0650}\u{062A}\u{0627}\u{0628}", KITAB],
    [
      "Arabic heh + full stop",
      "\u{06A9}\u{0645}\u{0631}\u{0647}\u{06D4}",
      "\u{06A9}\u{0645}\u{0631}\u{06C1}",
    ],
    [
      "phrase with ZWNJ, comma and extra spaces",
      " \u{0622}\u{067E}\u{200C}  \u{06A9}\u{06CC}\u{0633}\u{06D2}\u{060C}  \u{06C1}\u{06CC}\u{06BA}\u{061F}",
      "\u{0622}\u{067E} \u{06A9}\u{06CC}\u{0633}\u{06D2} \u{06C1}\u{06CC}\u{06BA}",
    ],
  ])("%s collides", (_label, a, b) => {
    expect(urduKey(a)).toBe(urduKey(b));
  });

  it.each([
    [
      "do-chashmi heh vs heh goal",
      "\u{0628}\u{06BE}\u{0627}\u{0626}\u{06CC}",
      "\u{0628}\u{06C1}\u{0627}\u{0626}\u{06CC}",
    ],
    ["choti yeh vs bari yeh", "\u{06A9}\u{06CC}", "\u{06A9}\u{06D2}"],
    ["noon vs noon ghunna", "\u{0645}\u{06CC}\u{0646}", "\u{0645}\u{06CC}\u{06BA}"],
    ["word boundary", "\u{06A9}\u{0648} \u{0626}\u{06CC}", "\u{06A9}\u{0648}\u{0626}\u{06CC}"],
    ["alef madda vs alef", "\u{0622}\u{0645}", "\u{0627}\u{0645}"],
  ])("%s does not collide", (_label, a, b) => {
    expect(urduKey(a)).not.toBe(urduKey(b));
  });

  it("returns an empty key for punctuation-only input", () => {
    expect(urduKey(" \u{06D4}\u{060C}? ")).toBe("");
  });
});

describe("inferKind", () => {
  it("is word for a single token, ignoring surrounding space and punctuation", () => {
    expect(inferKind(KITAB)).toBe("word");
    expect(inferKind(`  ${KITAB}\u{06D4} `)).toBe("word");
  });

  it("is phrase when the normalized text has more than one token", () => {
    expect(
      inferKind("\u{0622}\u{067E} \u{06A9}\u{06CC}\u{0633}\u{06D2} \u{06C1}\u{06CC}\u{06BA}"),
    ).toBe("phrase");
    expect(inferKind(`${KITAB}\u{060C}${KITAB}`)).toBe("phrase");
  });
});
