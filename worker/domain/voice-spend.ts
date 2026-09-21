// Voice spend (f07 s04, FR-G / FR-I1). Urdu Core owns what a session cost and whether another one
// may start; the browser only reports the usage the data channel gave it.

import {
  capOrDefault,
  DEFAULT_HARD_CAP_USD,
  DEFAULT_SOFT_CAP_USD,
  sessionCost,
  type VoiceUsage,
} from "../../shared/voice-cost";

export type VoiceCaps = { soft_cap_usd: number; hard_cap_usd: number };

export async function voiceCaps(db: D1Database): Promise<VoiceCaps> {
  const { results } = await db
    .prepare(
      "SELECT key, value FROM settings WHERE key IN ('voice_soft_cap_usd', 'voice_hard_cap_usd')",
    )
    .all<{ key: string; value: string }>();
  const stored = new Map(results.map((r) => [r.key, r.value]));
  return {
    soft_cap_usd: capOrDefault(stored.get("voice_soft_cap_usd"), DEFAULT_SOFT_CAP_USD),
    hard_cap_usd: capOrDefault(stored.get("voice_hard_cap_usd"), DEFAULT_HARD_CAP_USD),
  };
}

export async function setVoiceCap(
  db: D1Database,
  which: "soft" | "hard",
  usd: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    )
    .bind(`voice_${which}_cap_usd`, String(usd))
    .run();
}

// The broker's row: the session exists, so its create charge counts even if it reports nothing.
export async function startVoiceSession(
  db: D1Database,
  id: string,
  day: string,
  now: Date,
): Promise<void> {
  await db
    .prepare("INSERT OR IGNORE INTO voice_sessions (id, day, started_at) VALUES (?, ?, ?)")
    .bind(id, day, now.toISOString())
    .run();
}

// Usage is cumulative, so each field takes the larger of what is stored and what was reported: a
// late or out-of-order report can never lower a session's recorded spend. Unknown ids are ignored
// (the broker writes the row), which keeps a stray client report from inventing spend.
export async function recordVoiceUsage(
  db: D1Database,
  id: string,
  usage: VoiceUsage,
  ended: boolean,
  now: Date,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE voice_sessions
          SET seconds = max(seconds, ?),
              backend_input_tokens = max(backend_input_tokens, ?),
              backend_output_tokens = max(backend_output_tokens, ?),
              ended_at = CASE WHEN ? = 1 THEN coalesce(ended_at, ?) ELSE ended_at END
        WHERE id = ?`,
    )
    .bind(
      usage.seconds,
      usage.backend_input_tokens,
      usage.backend_output_tokens,
      ended ? 1 : 0,
      now.toISOString(),
      id,
    )
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function sessionSpend(db: D1Database, id: string): Promise<number> {
  const row = await db
    .prepare(
      "SELECT seconds, backend_input_tokens, backend_output_tokens FROM voice_sessions WHERE id = ?",
    )
    .bind(id)
    .first<VoiceUsage>();
  return row ? sessionCost(row) : 0;
}

// Every session that started today, priced together. Summing the usage first and pricing once
// would lose the per-session create charge, so the rows are priced individually.
export async function spendOn(db: D1Database, day: string): Promise<number> {
  const { results } = await db
    .prepare(
      "SELECT seconds, backend_input_tokens, backend_output_tokens FROM voice_sessions WHERE day = ?",
    )
    .bind(day)
    .all<VoiceUsage>();
  return results.reduce((total, row) => total + sessionCost(row), 0);
}
