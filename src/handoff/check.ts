// f11 (FR-F9): the corrections preview as the sponsor ticks it. Pure, so the node project tests
// it. The Worker plans; this only decides what is shown, what starts ticked, and turns the ticks
// into the `accept` list, carrying each field's old value so the write can refuse a stale one.

import type {
  CorrectionAccept,
  CorrectionPlan,
  CorrectionResult,
  FillableField,
} from "../../shared/api";

type Planned = Exclude<CorrectionPlan, { outcome: "rejected" }>;

// A `nothing` row is worth showing only for its spelling flag; otherwise it counts as fine.
export function isShown(plan: CorrectionPlan): boolean {
  return plan.outcome !== "nothing" || plan.urdu_suggestion !== undefined;
}

// Rows that can be ticked: a correction with changes, or a flagged row, which can still be reset.
export function tickable(plans: readonly CorrectionPlan[]): Planned[] {
  return plans.filter((p): p is Planned => p.outcome !== "rejected" && isShown(p));
}

export type ItemTicks = { fields: Partial<Record<FillableField, boolean>>; reset: boolean };
export type Ticks = Readonly<Record<string, ItemTicks>>;

// Every change ticked, every reset not.
export function defaultTicks(plans: readonly CorrectionPlan[]): Ticks {
  const ticks: Record<string, ItemTicks> = {};
  for (const plan of tickable(plans)) {
    const fields: Partial<Record<FillableField, boolean>> = {};
    for (const change of plan.changes) fields[change.field] = true;
    ticks[plan.vocab_id] = { fields, reset: false };
  }
  return ticks;
}

export function toggleField(ticks: Ticks, vocabId: string, field: FillableField): Ticks {
  const item = ticks[vocabId];
  if (!item) return ticks;
  return {
    ...ticks,
    [vocabId]: { ...item, fields: { ...item.fields, [field]: !item.fields[field] } },
  };
}

export function toggleReset(ticks: Ticks, vocabId: string): Ticks {
  const item = ticks[vocabId];
  if (!item) return ticks;
  return { ...ticks, [vocabId]: { ...item, reset: !item.reset } };
}

// One entry per item with a ticked field or its reset; empty means Mark checked.
export function acceptList(plans: readonly CorrectionPlan[], ticks: Ticks): CorrectionAccept[] {
  const accept: CorrectionAccept[] = [];
  for (const plan of tickable(plans)) {
    const item = ticks[plan.vocab_id];
    if (!item) continue;
    const fields: CorrectionAccept["fields"] = {};
    for (const change of plan.changes) {
      if (item.fields[change.field]) fields[change.field] = change.old;
    }
    if (Object.keys(fields).length > 0 || item.reset) {
      accept.push({ vocab_id: plan.vocab_id, fields, reset: item.reset });
    }
  }
  return accept;
}

// A result line is worth showing if something was written, kept, declined, reset or flagged.
export function isReported(result: CorrectionResult): boolean {
  return (
    result.outcome === "rejected" ||
    result.written.length > 0 ||
    result.kept.length > 0 ||
    result.declined.length > 0 ||
    result.reset !== "not_asked" ||
    result.urdu_suggestion !== undefined
  );
}
