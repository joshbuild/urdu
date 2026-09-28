// f13: the options behind Copy check prompt. Pure apart from the guarded storage calls, so the node
// project tests it. The Worker validates the same shape (parseCheckOptions); this only decides
// what the dialog starts with and whether Copy prompt is enabled.

import {
  CHECK_MODES,
  type CheckMode,
  type CheckOptions,
  DEFAULT_CHECK_COUNT,
  FILLABLE_FIELDS,
  type FillableField,
  MAX_CHECK_BATCH,
} from "../../shared/api";

export const DEFAULT_CHECK_OPTIONS: CheckOptions = {
  mode: "correctness",
  fields: [...FILLABLE_FIELDS],
  count: DEFAULT_CHECK_COUNT,
  only_unchecked: false,
};

export const MODE_LABELS: Readonly<Record<CheckMode, string>> = {
  correctness: "Correctness: fix wrong fields",
  completeness: "Completeness: fill empty fields",
  both: "Both",
};

// Why Copy prompt is disabled, or null when the options are good to send.
export function optionsProblem(options: CheckOptions): string | null {
  if (options.fields.length === 0) return "Tick at least one field.";
  const { count } = options;
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHECK_BATCH) {
    return `How many must be a whole number from 1 to ${MAX_CHECK_BATCH}.`;
  }
  return null;
}

// The number field's text as a count; NaN when it isn't a plain whole number.
export function parseCount(text: string): number {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN;
}

// Fields always kept in FILLABLE_FIELDS order, so the prompt and the payload read the same way
// however they were ticked.
export function toggleOptionField(options: CheckOptions, field: FillableField): CheckOptions {
  const on = options.fields.includes(field);
  const fields = FILLABLE_FIELDS.filter((f) => (f === field ? !on : options.fields.includes(f)));
  return { ...options, fields };
}

// A stored value from an older build, or edited by hand, falls back to the defaults whole.
export function decodeOptions(raw: string | null): CheckOptions {
  if (raw === null) return DEFAULT_CHECK_OPTIONS;
  try {
    const value = JSON.parse(raw) as Partial<CheckOptions>;
    const options: CheckOptions = {
      mode: value.mode as CheckMode,
      fields: value.fields as FillableField[],
      count: value.count as number,
      only_unchecked: value.only_unchecked as boolean,
    };
    const valid =
      CHECK_MODES.includes(options.mode) &&
      Array.isArray(options.fields) &&
      options.fields.every((f) => FILLABLE_FIELDS.includes(f)) &&
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
