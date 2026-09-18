// f03 s02-s03: paste, render in Nastaliq, persist, and split into tappable tokens.
// Speech behind onWord is s04; the selection action bar is s05.

import { useEffect, useState } from "react";
import { readStoredText, storeText, toParagraphs } from "../reader/text";
import { tokenize } from "../reader/tokens";

// Words become spans carrying the token in a data attribute; separators stay bare text. Spans, not
// buttons: a button would take the text out of the inline flow, fight Nastaliq's shaping, and give
// Android its own press behaviour to argue with native selection. s04 attaches speech here.
function renderTokens(paragraph: string) {
  return tokenize(paragraph).map((piece, index) =>
    piece.word ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positional, not entities
      <span key={index} className="token" data-token={piece.text}>
        {piece.text}
      </span>
    ) : (
      piece.text
    ),
  );
}

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
          // Paragraphs and tokens have no identity of their own — position is the only key
          // available, and the whole block re-renders together whenever the text changes.
          // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs are positional, not entities
          <p key={index}>{renderTokens(paragraph)}</p>
        ))}
      </div>
    </section>
  );
}
