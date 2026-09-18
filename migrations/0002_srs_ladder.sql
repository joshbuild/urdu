-- 0002_srs_ladder: versioned review ladders and timestamp scheduling (f09, DECISIONS 260918c/e).
-- SQLite cannot drop the 0-6 mastery CHECKs, so vocab and review_events are rebuilt.
--
-- Every existing row moves onto ladder 1 (Legacy ×5) with rung = old mastery level, and its dates
-- become instants at 08:00 UTC (00:00 PST / 01:00 PDT in Vancouver; shared/dates.ts
-- legacyInstant). Due times are unchanged. Nothing is replayed: an item joins the active ladder
-- at its next review. Ladder definitions live in shared/ladders.ts; D1 stores only their ids.
--
-- Order matters for foreign keys: the new review_events references vocab_new, the old tables are
-- dropped child first (so dropping vocab cascades into nothing), and the renames then rewrite
-- review_events_new's reference to vocab.

PRAGMA defer_foreign_keys = true;

CREATE TABLE settings (
  key   TEXT PRIMARY KEY CHECK (key <> ''),
  value TEXT NOT NULL
) STRICT;

-- Moderate, 2^1.25 (shared/ladders.ts DEFAULT_LADDER_ID).
INSERT INTO settings (key, value) VALUES ('active_ladder_id', '3');

CREATE TABLE vocab_new (
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
  ladder_id        INTEGER NOT NULL CHECK (ladder_id >= 1),
  ladder_step      INTEGER NOT NULL CHECK (ladder_step >= 0),
  interval_seconds INTEGER NOT NULL CHECK (interval_seconds >= 0),
  added_at         TEXT    NOT NULL,
  last_reviewed_at TEXT,
  due_at           TEXT,
  source           TEXT    NOT NULL CHECK (source IN ('reading', 'coach', 'airtable', 'manual')),
  airtable_id      TEXT    UNIQUE,
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  -- Never reviewed means due now: both instants are null together or set together.
  CHECK ((last_reviewed_at IS NULL) = (due_at IS NULL))
) STRICT;

INSERT INTO vocab_new (id, urdu, urdu_key, kind, roman, english, notes, example_urdu,
  example_english, tags, favourite, ladder_id, ladder_step, interval_seconds, added_at,
  last_reviewed_at, due_at, source, airtable_id, created_at, updated_at)
SELECT id, urdu, urdu_key, kind, roman, english, notes, example_urdu, example_english, tags,
  favourite, 1, mastery,
  (CASE mastery WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 5 WHEN 3 THEN 25 WHEN 4 THEN 125
     WHEN 5 THEN 625 ELSE 3125 END) * 86400,
  added_at,
  CASE WHEN last_reviewed_on IS NULL THEN NULL ELSE last_reviewed_on || 'T08:00:00.000Z' END,
  CASE WHEN next_review_on IS NULL THEN NULL ELSE next_review_on || 'T08:00:00.000Z' END,
  source, airtable_id, created_at, updated_at
FROM vocab;

CREATE TABLE review_events_new (
  id               TEXT    PRIMARY KEY CHECK (length(id) = 26),
  vocab_id         TEXT    NOT NULL REFERENCES vocab_new (id) ON DELETE CASCADE,
  reviewed_at      TEXT    NOT NULL,
  grade            TEXT    NOT NULL
                           CHECK (grade IN ('wrong', 'partial', 'hesitant', 'correct', 'confident')),
  direction        TEXT    NOT NULL CHECK (direction IN ('ur_en', 'en_ur', 'oral')),
  source           TEXT    NOT NULL CHECK (source IN ('pwa', 'coach')),
  -- Plain column, no FK: f06 may record events before the handoff row's outcome is written.
  handoff_id       TEXT,
  prompt_support   TEXT    NOT NULL DEFAULT 'none'
                           CHECK (prompt_support IN ('none', 'hint', 'answer_exposed', 'repetition')),
  -- The grade's delta before clamping. Null on events migrated from before f09.
  applied_delta    INTEGER,
  ladder_before_id INTEGER NOT NULL CHECK (ladder_before_id >= 1),
  step_before      INTEGER NOT NULL CHECK (step_before >= 0),
  interval_before  INTEGER NOT NULL CHECK (interval_before >= 0),
  due_before       TEXT,
  ladder_id        INTEGER NOT NULL CHECK (ladder_id >= 1),
  step_after       INTEGER NOT NULL CHECK (step_after >= 0),
  interval_after   INTEGER NOT NULL CHECK (interval_after >= 0),
  due_after        TEXT
) STRICT;

INSERT INTO review_events_new (id, vocab_id, reviewed_at, grade, direction, source, handoff_id,
  prompt_support, applied_delta, ladder_before_id, step_before, interval_before, due_before,
  ladder_id, step_after, interval_after, due_after)
SELECT id, vocab_id, reviewed_at, grade, direction, source, handoff_id, 'none', NULL,
  1, mastery_before,
  (CASE mastery_before WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 5 WHEN 3 THEN 25 WHEN 4 THEN 125
     WHEN 5 THEN 625 ELSE 3125 END) * 86400,
  NULL,
  1, mastery_after,
  (CASE mastery_after WHEN 0 THEN 0 WHEN 1 THEN 1 WHEN 2 THEN 5 WHEN 3 THEN 25 WHEN 4 THEN 125
     WHEN 5 THEN 625 ELSE 3125 END) * 86400,
  NULL
FROM review_events;

DROP TABLE review_events;
DROP TABLE vocab;
ALTER TABLE vocab_new RENAME TO vocab;
ALTER TABLE review_events_new RENAME TO review_events;

-- Due selection: due_at asc (nulls first), then added_at asc.
CREATE INDEX vocab_due ON vocab (due_at, added_at);
CREATE INDEX review_events_vocab ON review_events (vocab_id, reviewed_at);
CREATE INDEX review_events_handoff ON review_events (handoff_id) WHERE handoff_id IS NOT NULL;
