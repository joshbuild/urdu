// Mastery as a colour-coded pill, "0 • New" … "6 • Permanent" (sponsor request 2026-09-18).
// Names come from the shared ladder; the colours live in app.css as .mastery-pill--<level>.

import { type Mastery, masteryName } from "../../shared/mastery";

export function masteryPillLabel(mastery: Mastery): string {
  return `${mastery} • ${masteryName(mastery)}`;
}

export function MasteryPill({ mastery }: { mastery: Mastery }) {
  return (
    <span className={`mastery-pill mastery-pill--${mastery}`}>{masteryPillLabel(mastery)}</span>
  );
}
