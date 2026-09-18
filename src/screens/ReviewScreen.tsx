// f03 s01 placeholder. The review session is f05.

import type { StatusResponse } from "../../shared/api";

export function ReviewScreen({ status }: { status: StatusResponse }) {
  return (
    <section className="panel">
      <p className="eyebrow">REVIEW</p>
      <h2>
        {status.due.toLocaleString()} {status.due === 1 ? "item is" : "items are"} due.
      </h2>
      <p className="hint">
        Review date: {status.today} · Vancouver time. The review session arrives with its own
        screen.
      </p>
    </section>
  );
}
