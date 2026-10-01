// Dash fixtures for the client tests and the headless 360 px check (f16 s03): synthetic vaults
// run through the real buildDash, so the shapes are what the Worker sends. Not imported by the app.

import type { DashResponse } from "../../shared/api";
import { buildDash, type DashEvent, type DashVocab } from "../../shared/dash";
import { GRADES } from "../../shared/mastery";

export const FIXTURE_NOW = new Date("2026-10-01T19:00:00.000Z");
const TZ = "America/Vancouver";
const DAY = 86_400;
const DAY_MS = DAY * 1000;

const WORDS: [string, string][] = [
  ["\u{06A9}\u{062A}\u{0627}\u{0628}", "book"],
  ["\u{067E}\u{0627}\u{0646}\u{06CC}", "water"],
  ["\u{062F}\u{0631}\u{0648}\u{0627}\u{0632}\u{06C1}", "door"],
  ["\u{062E}\u{0648}\u{0628}\u{0635}\u{0648}\u{0631}\u{062A}", "beautiful"],
  ["\u{0627}\u{0646}\u{062A}\u{0638}\u{0627}\u{0631} \u{06A9}\u{0631}\u{0646}\u{0627}", "to wait"],
  ["\u{0645}\u{0634}\u{06A9}\u{0644}", "difficult"],
  ["\u{0628}\u{0627}\u{0632}\u{0627}\u{0631}", "market"],
  ["\u{0686}\u{0627}\u{0626}\u{06D2}", "tea"],
  ["\u{062F}\u{0648}\u{0633}\u{062A}", "friend"],
];

// Deterministic pseudo-random numbers in [0, 1).
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1_103_515_245 + 12_345) % 2_147_483_648;
    return s / 2_147_483_648;
  };
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function respond(vocab: DashVocab[], events: DashEvent[], ladderId = 8): DashResponse {
  return {
    ...buildDash(vocab, events, FIXTURE_NOW, TZ),
    active_ladder_id: ladderId,
    generated_at: FIXTURE_NOW.toISOString(),
  };
}

export function emptyDash(): DashResponse {
  return respond([], []);
}

// Two days of history, below the recall minimum, no trouble items.
export function sparseDash(): DashResponse {
  const now = FIXTURE_NOW.getTime();
  const vocab: DashVocab[] = [];
  const events: DashEvent[] = [];
  for (let i = 0; i < 12; i++) {
    const [urdu, english] = WORDS[i % WORDS.length] as [string, string];
    const reviewed = i < 8;
    const at = now - (i % 2) * DAY_MS - 3_600_000;
    vocab.push({
      id: `s${i}`,
      urdu: `${urdu}${i}`,
      english,
      added_at: iso(now - DAY_MS - 7_200_000),
      interval_seconds: reviewed ? DAY : 3600,
      last_reviewed_at: reviewed ? iso(at) : null,
      due_at: reviewed ? iso(at + DAY_MS) : null,
    });
    if (reviewed) {
      events.push({
        vocab_id: `s${i}`,
        reviewed_at: iso(at),
        grade: i % 3 === 0 ? "wrong" : "correct",
        direction: "ur_en",
        prompt_support: "none",
        interval_before: 3600,
        due_before: i % 2 ? iso(at - 60_000) : null,
        interval_after: DAY,
      });
    }
  }
  return respond(vocab, events);
}

// Four months of reviews over 180 items: every block populated.
export function fullDash(ladderId = 8): DashResponse {
  const random = rng(16);
  const now = FIXTURE_NOW.getTime();
  const vocab: DashVocab[] = [];
  const events: DashEvent[] = [];
  for (let i = 0; i < 180; i++) {
    const [urdu, english] = WORDS[i % WORDS.length] as [string, string];
    const id = `f${i}`;
    const addedMs = now - Math.floor(random() * 120) * DAY_MS - 3_600_000;
    let interval = 6422;
    let last: number | null = null;
    let at = addedMs + DAY_MS * (0.2 + random());
    const troubled = i < 6;
    while (at < now - 60_000 && random() > 0.04) {
      const roll = random();
      const grade = troubled
        ? roll < 0.6
          ? "wrong"
          : "correct"
        : (GRADES[roll < 0.08 ? 0 : roll < 0.14 ? 1 : roll < 0.3 ? 2 : roll < 0.85 ? 3 : 4] ??
          "correct");
      const before = interval;
      interval =
        grade === "wrong"
          ? 6422
          : grade === "partial"
            ? Math.max(6422, before / 2)
            : Math.min(400 * DAY, before * (grade === "confident" ? 4 : 2.4));
      events.push({
        vocab_id: id,
        reviewed_at: iso(at),
        grade,
        direction: random() < 0.7 ? "ur_en" : random() < 0.8 ? "en_ur" : "oral",
        prompt_support: random() < 0.9 ? "none" : "hint",
        interval_before: before,
        due_before: last === null ? null : iso(last + before * 1000),
        interval_after: interval,
      });
      last = at;
      at = at + Math.max(interval * 1000, 3_600_000) * (0.9 + random() * 0.4);
    }
    vocab.push({
      id,
      urdu: troubled ? (WORDS[i] as [string, string])[0] : `${urdu}${i}`,
      english,
      added_at: iso(addedMs),
      interval_seconds: Math.round(interval),
      last_reviewed_at: last === null ? null : iso(last),
      due_at: last === null ? null : iso(last + interval * 1000),
    });
  }
  return respond(vocab, events, ladderId);
}
