// f03 s02-s07: paste, render in Nastaliq, persist, split into tappable tokens, speak a token on
// tap, and act on a selection through the docked action bar: Speak, Add to vocab, Define.

import { useEffect, useRef, useState } from "react";
import { AddVocabSheet } from "../reader/AddVocabSheet";
import { selectedTerm } from "../reader/actionBar";
import { sourceSentence } from "../reader/addVocab";
import { DefineSheet } from "../reader/DefineSheet";
import { speak } from "../reader/speech";
import { readStoredText, storeText, toParagraphs } from "../reader/text";
import { tokenize } from "../reader/tokens";
import type { VoiceState } from "../reader/useVoice";

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

export function ReaderScreen({
  voiceState,
  onOpenVocab,
}: {
  voiceState: VoiceState;
  onOpenVocab: (id: string) => void;
}) {
  const [text, setText] = useState(readStoredText);
  const [editing, setEditing] = useState(() => readStoredText() === "");

  useEffect(() => {
    storeText(text);
  }, [text]);

  const paragraphs = toParagraphs(text);
  const readerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{
    term: string;
    paragraph: string;
  } | null>(null);
  const [adding, setAdding] = useState<{ term: string; sentence: string } | null>(null);
  const [defining, setDefining] = useState<{ term: string; sentence: string } | null>(null);

  // FR-C5: follow the native selection rather than intercepting touches. Only selections inside
  // the reader count; anything else (the paste box, Settings) clears the bar.
  useEffect(() => {
    function sync() {
      const current = globalThis.getSelection();
      const reader = readerRef.current;
      if (!current || current.isCollapsed || current.rangeCount === 0 || !reader) {
        setSelection(null);
        return;
      }
      const range = current.getRangeAt(0);
      const term = selectedTerm(current.toString());
      if (!term || !reader.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }
      // The paragraph the selection starts in supplies FR-C6's source sentence.
      const start = range.startContainer;
      const element = start instanceof Element ? start : start.parentElement;
      const paragraph = element?.closest("p")?.textContent ?? "";
      setSelection({ term, paragraph });
    }
    document.addEventListener("selectionchange", sync);
    return () => {
      document.removeEventListener("selectionchange", sync);
    };
  }, []);

  // Both sheets take the selection with them and clear it, so the native toolbar and our bar
  // do not linger behind the sheet.
  function openSheet(open: (value: { term: string; sentence: string }) => void) {
    if (!selection) return;
    open({ term: selection.term, sentence: sourceSentence(selection.paragraph, selection.term) });
    globalThis.getSelection()?.removeAllRanges();
  }

  function onTokenTap(event: React.MouseEvent<HTMLDivElement>) {
    // A tap that ends a selection drag must not also speak: the selection is the user's intent,
    // and s05's action bar owns what happens to it.
    if (!globalThis.getSelection()?.isCollapsed) return;
    const token = (event.target as HTMLElement).closest<HTMLElement>("[data-token]")?.dataset.token;
    if (token) speak(token, voiceState.voice);
  }

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
      {/* One delegated listener rather than a handler per token: a long passage is thousands of
          tokens, and the token itself carries its text in a data attribute. A tap that lands on a
          separator or between lines finds no token and does nothing. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the tappable unit is a token span, not the container */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: v0 targets touch; desktop keyboard support is Phase 4 */}
      <div ref={readerRef} className="urdu" dir="rtl" lang="ur" onClick={onTokenTap}>
        {paragraphs.map((paragraph, index) => (
          // Paragraphs and tokens have no identity of their own — position is the only key
          // available, and the whole block re-renders together whenever the text changes.
          // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs are positional, not entities
          <p key={index}>{renderTokens(paragraph)}</p>
        ))}
      </div>
      {selection && (
        // Pressing a button must not take focus or collapse the selection before the click
        // lands, so the pointerdown default is suppressed; the selection stays the user's.
        <div
          className="action-bar"
          role="toolbar"
          aria-label="Selection actions"
          onPointerDown={(event) => event.preventDefault()}
        >
          <button type="button" onClick={() => speak(selection.term, voiceState.voice)}>
            Speak
          </button>
          <button type="button" onClick={() => openSheet(setAdding)}>
            Add
          </button>
          <button type="button" onClick={() => openSheet(setDefining)}>
            Define
          </button>
        </div>
      )}
      {defining && (
        <DefineSheet
          term={defining.term}
          onClose={() => setDefining(null)}
          onAdd={() => {
            setAdding(defining);
            setDefining(null);
          }}
        />
      )}
      {adding && (
        <AddVocabSheet
          term={adding.term}
          sentence={adding.sentence}
          onClose={() => setAdding(null)}
          onOpenExisting={onOpenVocab}
        />
      )}
    </section>
  );
}
