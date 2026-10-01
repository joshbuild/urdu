// Validation for source and harvest writes (f17, FR-K). Strict: an unknown key is a 400.

import {
  type HarvestRequest,
  MAX_HARVEST_FILTER_LENGTH,
  MAX_SOURCE_NAME_LENGTH,
  MAX_SOURCE_URL_LENGTH,
  type SourceRequest,
} from "../../shared/api";
import { isRecord, optionalText, type Parsed } from "./vocab-input";

const fail = (field: string | undefined, message: string) =>
  ({ ok: false, error: { field, message } }) as const;

const SOURCE_FIELDS = new Set(["name", "url", "notes"]);

function sourceName(value: unknown): Parsed<string> {
  if (typeof value !== "string") return fail("name", "is required and must be a string");
  const name = value.trim();
  if (name === "") return fail("name", "must not be empty");
  if (name.length > MAX_SOURCE_NAME_LENGTH)
    return fail("name", `must be at most ${MAX_SOURCE_NAME_LENGTH} characters`);
  return { ok: true, value: name };
}

// Trimmed; "" and null clear it. Compared exactly, with no other normalisation: the URL is the
// source's identity.
function sourceUrl(value: unknown): Parsed<string | null> {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return fail("url", "must be a string or null");
  const url = value.trim();
  if (url === "") return { ok: true, value: null };
  if (url.length > MAX_SOURCE_URL_LENGTH)
    return fail("url", `must be at most ${MAX_SOURCE_URL_LENGTH} characters`);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return fail("url", "must be an http:// or https:// address");
  }
  // The URL parser also accepts "http:x.test"; insist on the slashes, since matching is exact.
  if (!/^https?:\/\//i.test(url) || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    return fail("url", "must be an http:// or https:// address");
  }
  return { ok: true, value: url };
}

// partial: PATCH, where every field is optional.
export function parseSource(body: unknown, partial: boolean): Parsed<Partial<SourceRequest>> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  const extra = Object.keys(body).find((key) => !SOURCE_FIELDS.has(key));
  if (extra) return fail(extra, "is not a recognised field");

  const value: Partial<SourceRequest> = {};
  if ("name" in body || !partial) {
    const name = sourceName(body.name);
    if (!name.ok) return name;
    value.name = name.value;
  }
  if ("url" in body) {
    const url = sourceUrl(body.url);
    if (!url.ok) return url;
    value.url = url.value;
  }
  if ("notes" in body) {
    const notes = optionalText("notes", body.notes);
    if (!notes.ok) return notes;
    value.notes = notes.value;
  }
  return { ok: true, value };
}

export function parseHarvest(body: unknown): Parsed<{ filter: string | null }> {
  if (!isRecord(body)) return fail(undefined, "body must be a JSON object");
  const extra = Object.keys(body).find((key) => key !== "filter");
  if (extra) return fail(extra, "is not a recognised field");
  const raw = (body as HarvestRequest).filter ?? null;
  if (raw !== null && typeof raw !== "string") return fail("filter", "must be a string or null");
  const filter = raw?.trim() ?? "";
  if (filter.length > MAX_HARVEST_FILTER_LENGTH)
    return fail("filter", `must be at most ${MAX_HARVEST_FILTER_LENGTH} characters`);
  return { ok: true, value: { filter: filter === "" ? null : filter } };
}
