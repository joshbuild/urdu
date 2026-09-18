// f02 Stage 2: import the sponsor's Airtable CSV export into D1 through Urdu Core (FR-H).
//
//   URDU_SECRET="<unlock secret>" pnpm tsx scripts/airtable-import.ts --dry-run
//   URDU_SECRET="<unlock secret>" pnpm tsx scripts/airtable-import.ts https://urdu.umber-amber.workers.dev
//
// Flags:
//   --dry-run          map and cross-check locally; never unlocks, never writes.
//   --data <dir>       CSV directory (default data/airtable).
//   --report <path>    report file (default <data>/import-report.md).
//
// The secret comes from the environment only — never an argument — so it stays out of
// shell history and process listings, exactly as scripts/smoke.ts does it.
//
// Exit code is 0 only when the cross-check report is EMPTY: no mapping errors, no
// rejected rows and no next-review mismatches (f02 Done-When #5). A non-empty report
// exits 1 and goes to the sponsor.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ImportRequest, ImportResponse, ImportResult, ImportVocabRecord } from "../shared/api";
import { MAX_IMPORT_BATCH } from "../shared/api";
import { nextReviewOn } from "../shared/dates";
import { urduKey } from "../shared/normalize";
import { type MapError, mapExport } from "./airtable-csv";

const SESSION_COOKIE = "__Host-urdu_session";
const VOCAB_CSV = "airtable_vocabulary_terms.csv";
const TAGS_CSV = "airtable_tags.csv";

type Options = { baseUrl: string | null; dataDir: string; reportPath: string };

function parseArgs(argv: string[]): Options {
  let baseUrl: string | null = null;
  let dataDir = join("data", "airtable");
  let reportPath: string | null = null;
  let dryRun = false;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] as string;
    const value = () => argv[i + 1] ?? die(`${arg} needs a value`);
    if (arg === "--dry-run") {
      dryRun = true;
      i += 1;
    } else if (arg === "--data") {
      dataDir = value();
      i += 2;
    } else if (arg === "--report") {
      reportPath = value();
      i += 2;
    } else if (arg.startsWith("--")) {
      die(`unknown flag ${arg}`);
    } else {
      baseUrl = arg.replace(/\/+$/, "");
      i += 1;
    }
  }

  if (dryRun && baseUrl) die("--dry-run takes no base URL: a dry run never contacts an origin");
  if (!dryRun && !baseUrl) {
    die("usage: URDU_SECRET=... pnpm tsx scripts/airtable-import.ts [--dry-run | <base-url>]");
  }
  return { baseUrl, dataDir, reportPath: reportPath ?? join(dataDir, "import-report.md") };
}

function die(message: string): never {
  console.error(message);
  process.exit(2);
}

function read(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return die(`cannot read ${path}`);
  }
}

// --- Offline cross-check (FR-H2) -------------------------------------------------------
// Runs in both modes. In a dry run it is the whole report; in a live run it is checked
// against what the endpoint reports so a disagreement between the two is visible.

type Mismatch = {
  airtable_id: string;
  urdu: string;
  airtable: string | null;
  recomputed: string | null;
};
type Collision = { urdu_key: string; airtable_ids: string[] };

function crossCheck(vocab: ImportVocabRecord[]): {
  mismatches: Mismatch[];
  collisions: Collision[];
} {
  const mismatches: Mismatch[] = [];
  const byKey = new Map<string, string[]>();

  for (const record of vocab) {
    const recomputed = nextReviewOn(record.last_reviewed_on, record.mastery);
    const airtable = record.airtable_next_review_on ?? null;
    // An absent Airtable value cannot disagree — only a supplied one can.
    if (airtable !== null && airtable !== recomputed) {
      mismatches.push({ airtable_id: record.airtable_id, urdu: record.urdu, airtable, recomputed });
    }
    const key = urduKey(record.urdu);
    byKey.set(key, [...(byKey.get(key) ?? []), record.airtable_id]);
  }

  const collisions: Collision[] = [];
  for (const [key, ids] of byKey) {
    if (ids.length > 1) collisions.push({ urdu_key: key, airtable_ids: ids });
  }
  return { mismatches, collisions };
}

// --- HTTP ------------------------------------------------------------------------------

let cookie: string | null = null;

async function call(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "manual",
  });

  // fetch keeps no cookie jar; capture the session cookie the Worker sets on unlock.
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    if (pair?.startsWith(`${SESSION_COOKIE}=`)) {
      cookie = pair.slice(SESSION_COOKIE.length + 1) ? pair : null;
    }
  }

  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
}

async function postBatches(
  baseUrl: string,
  vocab: ImportVocabRecord[],
  tags: ImportRequest["tags"],
): Promise<ImportResponse> {
  const merged: ImportResponse = {
    results: [],
    counts: { created: 0, updated: 0, rejected: 0 },
    mismatches: 0,
    tags_upserted: 0,
  };

  for (let start = 0; start < vocab.length; start += MAX_IMPORT_BATCH) {
    const batch = vocab.slice(start, start + MAX_IMPORT_BATCH);
    // Tags ride along with the first batch only; they are a catalogue, not per-row data.
    const request: ImportRequest = start === 0 ? { vocab: batch, tags } : { vocab: batch };
    const response = await call(baseUrl, "/api/admin/import", request);
    if (response.status !== 200) {
      die(
        `import batch at row ${start + 1} failed: ${response.status} ${JSON.stringify(response.body).slice(0, 300)}`,
      );
    }
    const result = response.body as ImportResponse;
    merged.results.push(...result.results);
    for (const outcome of ["created", "updated", "rejected"] as const) {
      merged.counts[outcome] += result.counts[outcome];
    }
    merged.mismatches += result.mismatches;
    merged.tags_upserted += result.tags_upserted;
  }
  return merged;
}

// --- Report ----------------------------------------------------------------------------

type ReportInput = {
  mode: "dry-run" | "live";
  target: string;
  rows: number;
  mapErrors: MapError[];
  mismatches: Mismatch[];
  collisions: Collision[];
  tagCount: number;
  response: ImportResponse | null;
};

function table(header: string[], rows: string[][]): string {
  const lines = [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`];
  for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
  return lines.join("\n");
}

function buildReport(input: ReportInput): { markdown: string; clean: boolean } {
  const rejected = (input.response?.results ?? []).filter((r) => r.outcome === "rejected");
  const clean =
    input.mapErrors.length === 0 &&
    input.mismatches.length === 0 &&
    input.collisions.length === 0 &&
    rejected.length === 0;

  const out: string[] = [
    "# Airtable import cross-check report",
    "",
    `*Generated ${new Date().toISOString()} · mode: ${input.mode} · target: ${input.target}*`,
    "",
    "## Summary",
    "",
    table(
      ["Metric", "Count"],
      [
        ["CSV vocab rows", String(input.rows)],
        ["CSV tag rows", String(input.tagCount)],
        ["Mapping errors", String(input.mapErrors.length)],
        ["Next-review mismatches (offline)", String(input.mismatches.length)],
        ["urdu_key collisions within the export", String(input.collisions.length)],
        ["Created", input.response ? String(input.response.counts.created) : "—"],
        ["Updated", input.response ? String(input.response.counts.updated) : "—"],
        ["Rejected", input.response ? String(input.response.counts.rejected) : "—"],
        [
          "Mismatches reported by the endpoint",
          input.response ? String(input.response.mismatches) : "—",
        ],
        ["Tags upserted", input.response ? String(input.response.tags_upserted) : "—"],
      ],
    ),
    "",
    `**Verdict: ${clean ? "CLEAN — no sponsor review needed (f02 Done-When #5)." : "NON-EMPTY — hand this to the sponsor."}**`,
    "",
  ];

  const section = (title: string, body: string | null) => {
    out.push(`## ${title}`, "", body ?? "*None.*", "");
  };

  section(
    "Mapping errors",
    input.mapErrors.length === 0
      ? null
      : table(
          ["CSV row", "Record id", "Field", "Problem"],
          input.mapErrors.map((e) => [String(e.row), e.airtable_id || "—", e.field, e.message]),
        ),
  );

  section(
    "Next-review mismatches",
    input.mismatches.length === 0
      ? null
      : table(
          ["Record id", "Urdu", "Airtable Next Review", "Recomputed"],
          input.mismatches.map((m) => [
            m.airtable_id,
            m.urdu,
            m.airtable ?? "(none)",
            m.recomputed ?? "(due now)",
          ]),
        ),
  );

  section(
    "urdu_key collisions within the export",
    input.collisions.length === 0
      ? null
      : table(
          ["urdu_key", "Record ids"],
          input.collisions.map((c) => [c.urdu_key, c.airtable_ids.join(", ")]),
        ),
  );

  section(
    "Rejected rows",
    rejected.length === 0
      ? null
      : table(
          ["Record id", "Field", "Reason"],
          rejected.map((r: ImportResult) => [r.airtable_id, r.field ?? "—", r.reason ?? "—"]),
        ),
  );

  return { markdown: `${out.join("\n").trimEnd()}\n`, clean };
}

// --- Main ------------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const dryRun = options.baseUrl === null;

  const mapped = mapExport(
    read(join(options.dataDir, VOCAB_CSV)),
    read(join(options.dataDir, TAGS_CSV)),
  );
  const { mismatches, collisions } = crossCheck(mapped.vocab);

  console.log(
    `mapped ${mapped.vocab.length} vocab rows, ${mapped.tags.length} tags, ${mapped.errors.length} mapping errors`,
  );

  let response: ImportResponse | null = null;
  if (!dryRun) {
    const baseUrl = options.baseUrl as string;
    const secret = process.env.URDU_SECRET ?? "";
    if (!secret) die("URDU_SECRET is not set");

    const unlock = await call(baseUrl, "/api/unlock", { secret });
    if (unlock.status !== 200 || cookie === null) {
      die(`unlock failed: ${unlock.status} ${JSON.stringify(unlock.body).slice(0, 200)}`);
    }
    console.log(`unlocked ${baseUrl}; posting ${mapped.vocab.length} records`);
    response = await postBatches(baseUrl, mapped.vocab, mapped.tags);
    console.log(
      `created ${response.counts.created}, updated ${response.counts.updated}, rejected ${response.counts.rejected}`,
    );
  }

  const report = buildReport({
    mode: dryRun ? "dry-run" : "live",
    target: dryRun ? "(none — local mapping only)" : (options.baseUrl as string),
    rows: mapped.vocab.length + mapped.errors.length,
    mapErrors: mapped.errors,
    mismatches,
    collisions,
    tagCount: mapped.tags.length,
    response,
  });

  writeFileSync(options.reportPath, report.markdown, "utf8");
  console.log(`report written to ${options.reportPath}`);

  if (!report.clean) {
    console.error("report is NOT empty — review it with the sponsor before proceeding");
    process.exit(1);
  }
  console.log("report is clean: no mapping errors, no mismatches, no rejected rows");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
