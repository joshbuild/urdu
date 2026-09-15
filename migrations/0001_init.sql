-- 0001_init: Vocab Vault schema (PRD Appendix A).
-- Urdu Core owns the rules (shared/ + worker/domain). Constraints here are a backstop that
-- stops a bug from writing an impossible row; they are not where the rules are decided.
-- Dates (`*_on`) are YYYY-MM-DD in HOME_TZ; instants (`*_at`) are ISO 8601 UTC strings.

CREATE TABLE vocab (
  id               TEXT    PRIMARY KEY CHECK (length(id) = 26),
  urdu             TEXT    NOT NULL CHECK (urdu <> ''),
  urdu_key         TEXT    NOT NULL UNIQUE CHECK (urdu_key <> ''),
  kind             TEXT    NOT NULL CHECK (kind IN ('word', 'phrase')),
  roman            TEXT,
  english          TEXT,
  notes            TEXT,
  example_urdu     TEXT,
  example_english  TEXT,
  tags             TEXT    NOT NULL DEFAULT '[]'
                           CHECK (json_valid(tags) AND json_type(tags) = 'array'),
  favourite        INTEGER NOT NULL DEFAULT 0 CHECK (favourite IN (0, 1)),
  mastery          INTEGER NOT NULL DEFAULT 0 CHECK (mastery BETWEEN 0 AND 6),
  added_at         TEXT    NOT NULL,
  last_reviewed_on TEXT    CHECK (last_reviewed_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  next_review_on   TEXT    CHECK (next_review_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  source           TEXT    NOT NULL CHECK (source IN ('reading', 'coach', 'airtable', 'manual')),
  airtable_id      TEXT    UNIQUE,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  -- Never reviewed means due now: both dates are null together or set together.
  CHECK ((last_reviewed_on IS NULL) = (next_review_on IS NULL))
) STRICT;

-- Due selection (FR-A7): next_review_on asc (nulls first), then added_at asc.
CREATE INDEX vocab_due ON vocab (next_review_on, added_at);

CREATE TABLE review_events (
  id             TEXT    PRIMARY KEY CHECK (length(id) = 26),
  vocab_id       TEXT    NOT NULL REFERENCES vocab (id) ON DELETE CASCADE,
  reviewed_at    TEXT    NOT NULL,
  grade          TEXT    NOT NULL
                         CHECK (grade IN ('wrong', 'partial', 'hesitant', 'correct', 'confident')),
  mastery_before INTEGER NOT NULL CHECK (mastery_before BETWEEN 0 AND 6),
  mastery_after  INTEGER NOT NULL CHECK (mastery_after BETWEEN 0 AND 6),
  direction      TEXT    NOT NULL CHECK (direction IN ('ur_en', 'en_ur', 'oral')),
  source         TEXT    NOT NULL CHECK (source IN ('pwa', 'coach')),
  -- Plain column, no FK: f06 may record events before the handoff row's outcome is written.
  handoff_id     TEXT
) STRICT;

CREATE INDEX review_events_vocab ON review_events (vocab_id, reviewed_at);
CREATE INDEX review_events_handoff ON review_events (handoff_id) WHERE handoff_id IS NOT NULL;

CREATE TABLE handoffs (
  id          TEXT PRIMARY KEY CHECK (id <> ''),
  imported_at TEXT NOT NULL,
  payload     TEXT NOT NULL CHECK (json_valid(payload)),
  -- Status values are defined by f06; validated in Urdu Core.
  status      TEXT NOT NULL,
  outcome     TEXT CHECK (outcome IS NULL OR json_valid(outcome))
) STRICT;

CREATE TABLE tags (
  name        TEXT PRIMARY KEY CHECK (name <> ''),
  description TEXT
) STRICT;

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY CHECK (length(id) = 26),
  -- Hex SHA-256 of the session token; the token itself is never stored.
  token_hash   TEXT NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  label        TEXT
) STRICT;
