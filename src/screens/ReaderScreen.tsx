// f03 s02: paste, render in Nastaliq, persist. Tokens and taps are s03/s04; the action bar is s05.

import { useEffect, useState } from "react";
import { readStoredText, storeText, toParagraphs } from "../reader/text";

export function ReaderScreen() {
  const [text, setText] = useState(readStoredText);
  const [editing, setEditing] = useState(() => readStoredText() === "");

  useEffect(() => {
    storeText(text);
  }, [text]);

  const paragraphs = toParagraphs(text);

  if (editing || paragraphs.length === 0) {
    return (
      <section className="panel">
        <p className="eyebrow">READ</p>
        <h2>Paste something to read.</h2>
        <label htmlFor="reader-text">Urdu text</label>
        <textarea
          id="reader-text"
          className="paste"
          dir="rtl"
          lang="ur"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="اردو یہاں چسپاں کریں"
        />
        <button type="button" onClick={() => setEditing(false)} disabled={text.trim() === ""}>
          Read it
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="reader-bar">
        <p className="eyebrow">READ</p>
        <button type="button" className="secondary inline" onClick={() => setEditing(true)}>
          Edit text
        </button>
      </div>
      <div className="urdu" dir="rtl" lang="ur">
        {paragraphs.map((paragraph, index) => (
          // Paragraphs have no identity of their own — position is the only key available,
          // and the whole block re-renders together whenever the text changes.
          // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs are positional, not entities
          <p key={index}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
