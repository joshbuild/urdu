// f03 s01 placeholder. Browsing, search and editing are f04.

import type { StatusResponse } from "../../shared/api";

export function VocabScreen({ status }: { status: StatusResponse }) {
  return (
    <section className="panel">
      <p className="eyebrow">VOCABULARY</p>
      <h2>{status.total.toLocaleString()} items in your vault.</h2>
      <p className="hint">Browsing, search and editing arrive with the vocabulary screen.</p>
    </section>
  );
}
