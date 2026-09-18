import { describe, expect, it } from "vitest";
import type { VocabItem } from "../../shared/api";
import { urduKey } from "../../shared/normalize";
import { dictionaryLinks, exactMatch } from "./define";

const item = (urdu: string) => ({ id: urdu, urdu, urdu_key: urduKey(urdu) }) as VocabItem;

describe("exactMatch", () => {
  it("finds the item whose key equals the term's key", () => {
    const items = [item("کتابیں"), item("کتاب")];
    expect(exactMatch(items, " کتاب ")?.urdu).toBe("کتاب");
  });

  it("ignores substring hits from the list search", () => {
    expect(exactMatch([item("کتابیں")], "کتاب")).toBeNull();
  });

  it("is null for a term with no Urdu key", () => {
    expect(exactMatch([item("کتاب")], "۔")).toBeNull();
  });
});

describe("dictionaryLinks", () => {
  it("offers Rekhta, Wiktionary and Google Translate with the term encoded", () => {
    const links = dictionaryLinks(" آپ کہاں ");
    expect(links.map((l) => l.label)).toEqual([
      "Rekhta dictionary",
      "Wiktionary",
      "Google Translate",
    ]);
    const q = encodeURIComponent("آپ کہاں");
    for (const link of links) expect(link.href).toContain(q);
    expect(links[2]?.href).toContain("sl=ur");
  });
});
