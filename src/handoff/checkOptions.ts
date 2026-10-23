// f13: the options behind Copy check prompt. Pure apart from the guarded storage calls, so the node
// project tests it. The Worker validates the same shape (parseCheckOptions); this only decides
// what the dialog starts with and whether Copy prompt is enabled.

import {
  CHECK_FIELDS,
  CHECK_MODES,
  CHECK_SCOPES,
  type CheckField,
  type CheckMode,
  type CheckOptions,
  type CheckScope,
  DEFAULT_CHECK_COUNT,
  FILLABLE_FIELDS,
  MAX_CHECK_BATCH,
} from "../../shared/api";
import { isIsoDate } from "../../shared/dates";
import { isTopic } from "../../shared/topics";
import { FIELD_LABELS } from "./prompts";

export const DEFAULT_CHECK_OPTIONS: CheckOptions = {
  mode: "correctness",
  fields: [...FILLABLE_FIELDS],
  count: DEFAULT_CHECK_COUNT,
  only_unchecked: false,
  scope: "rotation",
};

// The dialog's tickboxes, in CHECK_FIELDS order. mp08: Topic & level is off by default, so the
// everyday check prompt stays short; the remembered options keep it once ticked.
export const CHECK_FIELD_LABELS: Readonly<Record<CheckField, string>> = {
  roman: FIELD_LABELS.roman,
  english: FIELD_LABELS.english,
  notes: FIELD_LABELS.notes,
  example_urdu: FIELD_LABELS.example_urdu,
  example_english: FIELD_LABELS.example_english,
  topic: "Topic & level",
};

export const MODE_LABELS: Readonly<Record<CheckMode, string>> = {
  correctness: "Correctness: fix wrong fields",
  completeness: "Completeness: fill empty fields",
  both: "Both",
};

// mp08 Which words. The dialog keeps the dates while another scope is chosen; only an Added
// between request sends them.
export const SCOPE_LABELS: Readonly<Record<CheckScope, string>> = {
  rotation: "Least recently checked",
  newest: "Newest added",
  added: "Added between",
};

// Why Copy prompt is disabled, or null when the options are good to send.
export function optionsProblem(options: CheckOptions): string | null {
  if (options.fields.length === 0) return "Tick at least one field.";
  const { count } = options;
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHECK_BATCH) {
    return `How many must be a whole number from 1 to ${MAX_CHECK_BATCH}.`;
  }
  if (options.scope === "added") {
    const { from, to } = options;
    if (!isIsoDate(from) || !isIsoDate(to)) return "Choose both dates.";
    if (from > to) return "The first date must not be after the second.";
  }
  return null;
}

// The body the Worker gets: dates only with Added between.
export function checkRequest(options: CheckOptions): CheckOptions {
  const { from, to, ...rest } = options;
  return rest.scope === "added" ? { ...rest, from, to } : rest;
}

// The number field's text as a count; NaN when it isn't a plain whole number.
export function parseCount(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}

// Fields always kept in CHECK_FIELDS order, so the prompt and the payload read the same way
// however they were ticked.
export function toggleOptionField(options: CheckOptions, field: CheckField): CheckOptions {
  const on = options.fields.includes(field);
  const fields = CHECK_FIELDS.filter((f) => (f === field ? !on : options.fields.includes(f)));
  return { ...options, fields };
}

// A stored value edited by hand falls back to the defaults whole. mp08: Which words decodes on its
// own, so a value stored before it (no scope) keeps its mode, fields and count; a bad scope, date
// or topic falls back to the rotation over every topic.
export function decodeOptions(raw: string | null): CheckOptions {
  if (raw === null) return DEFAULT_CHECK_OPTIONS;
  try {
    const value = JSON.parse(raw) as Partial<CheckOptions>;
    const dates = isIsoDate(value.from) && isIsoDate(value.to) && value.from <= value.to;
    const scope = CHECK_SCOPES.includes(value.scope as CheckScope)
      ? (value.scope as CheckScope)
      : "rotation";
    const options: CheckOptions = {
      mode: value.mode as CheckMode,
      fields: value.fields as CheckField[],
      count: value.count as number,
      only_unchecked: value.only_unchecked as boolean,
      scope: scope === "added" && !dates ? "rotation" : scope,
      ...(dates ? { from: value.from, to: value.to } : {}),
      ...(isTopic(value.topic) ? { topic: value.topic } : {}),
    };
    const valid =
      CHECK_MODES.includes(options.mode) &&
      Array.isArray(options.fields) &&
      options.fields.every((f) => CHECK_FIELDS.includes(f)) &&
      new Set(options.fields).size === options.fields.length &&
      typeof options.only_unchecked === "boolean" &&
      optionsProblem(options) === null;
    return valid ? options : DEFAULT_CHECK_OPTIONS;
  } catch {
    return DEFAULT_CHECK_OPTIONS;
  }
}

const OPTIONS_KEY = "urdu.checkOptions";

// Remembered per device. localStorage throws in private windows and with site data blocked, so
// every access is guarded: the dialog then starts from the defaults each time.
export function readCheckOptions(): CheckOptions {
  try {
    return decodeOptions(localStorage.getItem(OPTIONS_KEY));
  } catch {
    return DEFAULT_CHECK_OPTIONS;
  }
}

export function storeCheckOptions(options: CheckOptions): void {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // Non-fatal: the options simply aren't remembered on this device.
  }
}
