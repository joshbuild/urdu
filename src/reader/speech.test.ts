import { describe, expect, it } from "vitest";
import { chooseVoice, isUrdu, urduVoices, type VoiceLike } from "./speech";

const voice = (name: string, lang: string): VoiceLike => ({
  name,
  lang,
  voiceURI: `${name}:${lang}`,
});

const assamese = voice("Assamese", "as-IN");
const urPkUnderscore = voice("Urdu Pakistan", "ur_PK");
const urPkHyphen = voice("Urdu PK Network", "ur-PK");
const urIn = voice("Urdu India", "ur-IN");
const english = voice("English", "en-US");

describe("isUrdu", () => {
  it("accepts both the underscore and hyphen spellings", () => {
    expect(isUrdu(urPkUnderscore)).toBe(true);
    expect(isUrdu(urPkHyphen)).toBe(true);
    expect(isUrdu(urIn)).toBe(true);
  });

  it("rejects other languages", () => {
    expect(isUrdu(assamese)).toBe(false);
    expect(isUrdu(english)).toBe(false);
  });
});

describe("chooseVoice", () => {
  it("prefers ur-PK over another Urdu voice, whatever the order", () => {
    expect(chooseVoice([urIn, urPkUnderscore])).toBe(urPkUnderscore);
    expect(chooseVoice([urPkHyphen, urIn])).toBe(urPkHyphen);
  });

  it("falls back to any Urdu voice when ur-PK is absent", () => {
    expect(chooseVoice([english, urIn, assamese])).toBe(urIn);
  });

  it("never falls back to the browser default — Assamese on the sponsor's phone", () => {
    expect(chooseVoice([assamese, english])).toBeNull();
    expect(chooseVoice([])).toBeNull();
  });

  it("honours a saved choice over the ur-PK default", () => {
    expect(chooseVoice([urPkUnderscore, urIn], urIn.voiceURI)).toBe(urIn);
  });

  it("ignores a saved choice that is no longer installed", () => {
    expect(chooseVoice([urPkUnderscore, urIn], "gone:ur-PK")).toBe(urPkUnderscore);
  });

  it("allows a saved non-Urdu voice — an explicit choice is the sponsor's to make", () => {
    expect(chooseVoice([assamese, urPkUnderscore], assamese.voiceURI)).toBe(assamese);
  });
});

describe("urduVoices", () => {
  it("keeps only the Urdu voices, in order", () => {
    expect(urduVoices([english, urIn, assamese, urPkUnderscore])).toEqual([urIn, urPkUnderscore]);
  });
});
