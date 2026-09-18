// Mastery as a colour-coded pill, "Firm • 3 wk" (sponsor request 2026-09-18, f09). The band is
// derived from the scheduled interval (shared/mastery.ts); the colours live in app.css as
// .mastery-pill--<band>.

import type { VocabItem } from "../../shared/api";
import { formatInterval } from "../../shared/ladders";
import { bandName, masteryBand } from "../../shared/mastery";

type Scheduled = Pick<VocabItem, "interval_seconds" | "last_reviewed_at">;

export function masteryPillLabel(item: Scheduled): string {
  const name = bandName(masteryBand(item));
  return item.last_reviewed_at === null
    ? name
    : `${name} • ${formatInterval(item.interval_seconds)}`;
}

export function MasteryPill({ item }: { item: Scheduled }) {
  return (
    <span className={`mastery-pill mastery-pill--${masteryBand(item)}`}>
      {masteryPillLabel(item)}
    </span>
  );
}
