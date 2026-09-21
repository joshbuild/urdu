-- 0003_voice_sessions: one row per brokered voice session and the two spend caps (f07 s04,
-- FR-G / FR-I1, DECISIONS 260918h).
--
-- The row is written when the broker creates the session, so a session that never reports usage
-- still costs its 15 s create charge and still counts towards the day. `day` is the HOME_TZ
-- calendar day the session started on, stored rather than derived: daily totals are a plain
-- indexed equality scan, and a session that runs across local midnight belongs to the day it
-- began. Usage is cumulative, so a later report replaces an earlier one (never adds).
--
-- Cost is not stored: shared/voice-cost.ts prices the usage, so a corrected rate reprices history
-- instead of leaving old rows on the old price.

CREATE TABLE voice_sessions (
  id                   TEXT    PRIMARY KEY CHECK (id <> ''),
  day                  TEXT    NOT NULL CHECK (length(day) = 10),
  started_at           TEXT    NOT NULL,
  ended_at             TEXT,
  seconds              INTEGER NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  backend_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (backend_input_tokens >= 0),
  backend_output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (backend_output_tokens >= 0)
) STRICT;

CREATE INDEX voice_sessions_day ON voice_sessions (day);

-- Defaults mirror shared/voice-cost.ts (DECISIONS 260918h: $0.50 soft warn, $1.00 hard stop).
INSERT INTO settings (key, value) VALUES ('voice_soft_cap_usd', '0.5');
INSERT INTO settings (key, value) VALUES ('voice_hard_cap_usd', '1');
