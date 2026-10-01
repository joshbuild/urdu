// f17 (FR-K): the Review start screen's intake line and button. Intake releases up to a batch;
// with a shorter queue it offers what is left, and with none it is hidden.

import type { IntakeCounts } from "../../shared/api";

export function intakeOffer(intake: IntakeCounts): { count: number; label: string } | null {
  const count = Math.min(intake.batch_size, intake.queued);
  return count > 0 ? { count, label: `Intake +${count}` } : null;
}

// The new pile is due today, so it is counted inside the due figure and named beside it. Each
// number keeps its word (no-break space), so a narrow heading wraps only at the dot.
const NBSP = "\u{00A0}";

export function startCounts(due: number, fresh: number): string {
  return `${due.toLocaleString("en-US")}${NBSP}due · ${fresh.toLocaleString("en-US")}${NBSP}new`;
}
