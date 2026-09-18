// f03 s02-s05: paste, render in Nastaliq, persist, split into tappable tokens, speak a token on
// tap, and act on a selection through the floating action bar.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Placement, placeActionBar, selectedTerm } from "../reader/actionBar";
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

export function ReaderScreen({ voiceState }: { voiceState: VoiceState }) {
  const [text, setText] = useState(readStoredText);
  const [editing, setEditing] = useState(() => readStoredText() === "");

  useEffect(() => {
    storeText(text);
  }, [text]);

  const paragraphs = toParagraphs(text);
  const readerRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ term: string; rect: DOMRect } | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

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
      setSelection({ term, rect: range.getBoundingClientRect() });
    }
    document.addEventListener("selectionchange", sync);
    // The bar is position: fixed, so a scroll moves the selection out from under it.
    globalThis.addEventListener("scroll", sync, { passive: true });
    globalThis.addEventListener("resize", sync);
    return () => {
      document.removeEventListener("selectionchange", sync);
      globalThis.removeEventListener("scroll", sync);
      globalThis.removeEventListener("resize", sync);
    };
  }, []);

  // Measure the rendered bar, then place it; layout effect so it never paints in the wrong spot.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!selection || !bar) {
      setPlacement(null);
      return;
    }
    const tabs = document.querySelector(".tabs");
    setPlacement(
      placeActionBar(
        selection.rect,
        { width: bar.offsetWidth, height: bar.offsetHeight },
        {
          width: innerWidth,
          height: innerHeight,
          bottomInset: tabs?.getBoundingClientRect().height ?? 0,
        },
      ),
    );
  }, [selection]);

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
          ref={barRef}
          className="action-bar"
          role="toolbar"
          aria-label="Selection actions"
          style={
            placement ? { top: placement.top, left: placement.left } : { visibility: "hidden" }
          }
          onPointerDown={(event) => event.preventDefault()}
        >
          <button type="button" onClick={() => speak(selection.term, voiceState.voice)}>
            Speak
          </button>
          {/* s06 and s07 wire these. */}
          <button type="button" disabled>
            Add
          </button>
          <button type="button" disabled>
            Define
          </button>
        </div>
      )}
    </section>
  );
}
