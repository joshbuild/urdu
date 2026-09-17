// f01 s08 smoke test: exercise the deployed Urdu Core end to end against a real origin.
//
//   URDU_SECRET="<unlock secret>" pnpm tsx scripts/smoke.ts https://urdu.umber-amber.workers.dev
//
// Creates one throwaway vocab item, reviews it, then deletes it, so a passing run leaves
// no rows behind (the review event cascades with the vocab row). Exits non-zero on the
// first failed check. The secret comes from the environment only — never an argument, so
// it stays out of shell history and process listings.

import type { ReviewResponse, StatusResponse, VocabItem } from "../shared/api";
import { nextReviewOn } from "../shared/dates";

const SESSION_COOKIE = "__Host-urdu_session";

const baseUrl = (process.argv[2] ?? "").replace(/\/+$/, "");
const secret = process.env.URDU_SECRET ?? "";

if (!baseUrl) {
  console.error("usage: URDU_SECRET=... pnpm tsx scripts/smoke.ts <base-url>");
  process.exit(2);
}
if (!secret) {
  console.error("URDU_SECRET is not set");
  process.exit(2);
}

let cookie: string | null = null;
let checks = 0;

function pass(label: string): void {
  checks += 1;
  console.log(`  ok  ${label}`);
}

function fail(label: string, detail: string): never {
  console.error(`  FAIL ${label}: ${detail}`);
  process.exit(1);
}

function check(label: string, condition: boolean, detail = "condition not met"): void {
  if (!condition) fail(label, detail);
  pass(label);
}

type Result = { status: number; body: unknown };

async function call(method: string, path: string, body?: unknown): Promise<Result> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.Cookie = cookie;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  });

  // Capture the session cookie the Worker sets on unlock (fetch does not keep a jar).
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    if (pair?.startsWith(`${SESSION_COOKIE}=`)) {
      const value = pair.slice(SESSION_COOKIE.length + 1);
      cookie = value ? pair : null;
    }
  }

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Leave the raw text for the failure message.
  }
  return { status: response.status, body: parsed };
}

function describe(result: Result): string {
  return `${result.status} ${JSON.stringify(result.body).slice(0, 200)}`;
}

async function main(): Promise<void> {
  console.log(`smoke: ${baseUrl}`);

  const health = await call("GET", "/api/health");
  check("health responds 200", health.status === 200, describe(health));

  const locked = await call("GET", "/api/status");
  check("status is 401 while locked", locked.status === 401, describe(locked));

  const wrong = await call("POST", "/api/unlock", { secret: `${secret}-wrong` });
  check("wrong secret is rejected", wrong.status === 401 || wrong.status === 429, describe(wrong));
  if (wrong.status === 429) {
    fail("wrong secret is rejected", "rate limiter tripped; wait a minute and re-run");
  }

  const unlock = await call("POST", "/api/unlock", { secret });
  check("unlock succeeds", unlock.status === 200, describe(unlock));
  check("unlock sets a session cookie", cookie !== null, "no __Host- cookie in the response");

  const before = await call("GET", "/api/status");
  check("status responds 200 when unlocked", before.status === 200, describe(before));
  const counts = before.body as StatusResponse;
  check(
    "status carries total, due and today",
    typeof counts.total === "number" &&
      typeof counts.due === "number" &&
      /^\d{4}-\d{2}-\d{2}$/.test(counts.today),
    describe(before),
  );

  // A marker unlikely to collide with real vocabulary, and unique per run.
  const marker = `smoke-${Date.now().toString(36)}`;
  // No tags: tag names live in a standalone catalogue table that a vocab delete does not
  // cascade to, and a smoke run must leave the vault exactly as it found it.
  const created = await call("POST", "/api/vocab", {
    urdu: `سموک ٹیسٹ ${marker}`,
    english: `smoke test ${marker}`,
    source: "manual",
  });
  check("create vocab responds 201", created.status === 201, describe(created));
  const item = created.body as VocabItem;
  check("new item starts at mastery 0", item.mastery === 0, describe(created));
  check("new item is due immediately", item.next_review_on === null, describe(created));

  let cleanedUp = false;
  try {
    const fetched = await call("GET", `/api/vocab/${item.id}`);
    check("read back the created item", fetched.status === 200, describe(fetched));

    const duplicate = await call("POST", "/api/vocab", { urdu: `سموک ٹیسٹ ${marker}` });
    check("duplicate is refused with 409", duplicate.status === 409, describe(duplicate));

    // MAX_LIMIT is 200, so once the vault holds more due items than that the new one can
    // legitimately fall off the page; a full page is accepted rather than failed.
    const due = await call("GET", "/api/vocab/due?limit=200");
    const dueItems = (due.body as { items: VocabItem[] }).items ?? [];
    check(
      "the new item is in the due list",
      due.status === 200 && (dueItems.some((v) => v.id === item.id) || dueItems.length === 200),
      describe(due),
    );

    const reviewed = await call("POST", `/api/vocab/${item.id}/reviews`, {
      grade: "correct",
      direction: "ur_en",
    });
    check("review responds 201", reviewed.status === 201, describe(reviewed));
    const review = reviewed.body as ReviewResponse;
    check("correct raises mastery to 1", review.item.mastery === 1, describe(reviewed));
    check(
      "next review is scheduled by the ladder",
      review.item.last_reviewed_on !== null &&
        review.item.next_review_on === nextReviewOn(review.item.last_reviewed_on, 1),
      describe(reviewed),
    );
    check(
      "the review event records the transition",
      review.event.mastery_before === 0 &&
        review.event.mastery_after === 1 &&
        review.event.source === "pwa",
      describe(reviewed),
    );

    const exported = await call("GET", "/api/export");
    const dump = exported.body as {
      vocab: VocabItem[];
      review_events: { vocab_id: string }[];
    };
    check(
      "export includes the item and its event",
      exported.status === 200 &&
        dump.vocab.some((v) => v.id === item.id) &&
        dump.review_events.some((e) => e.vocab_id === item.id),
      describe(exported),
    );

    const removed = await call("DELETE", `/api/vocab/${item.id}`, {});
    check("delete responds 200", removed.status === 200, describe(removed));
    cleanedUp = true;

    const gone = await call("GET", `/api/vocab/${item.id}`);
    check("the item is gone", gone.status === 404, describe(gone));

    const after = await call("GET", "/api/status");
    check(
      "total count is back where it started",
      (after.body as StatusResponse).total === counts.total,
      describe(after),
    );
  } finally {
    if (!cleanedUp) {
      const cleanup = await call("DELETE", `/api/vocab/${item.id}`, {});
      console.error(`  cleanup: deleted smoke item ${item.id} (${cleanup.status})`);
    }
  }

  const lock = await call("POST", "/api/lock", {});
  check("lock responds 200", lock.status === 200, describe(lock));

  const relocked = await call("GET", "/api/status");
  check("the session is revoked", relocked.status === 401, describe(relocked));

  console.log(`\nsmoke: ${checks} checks passed`);
}

main().catch((error: unknown) => {
  console.error(`  FAIL unexpected error: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
