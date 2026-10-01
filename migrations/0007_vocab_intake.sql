-- 0007_vocab_intake: queued vault items, sources and harvests (f17, PRD FR-K, DECISIONS 261001b).
--
-- released_at is the UTC instant an item entered review; null means queued: in the vault, but
-- not due, until the daily top-up, Intake, Release now or a tracked review releases it
-- (worker/domain/intake.ts). The backfill sets it to added_at on every existing row, so nothing
-- already in the vault becomes queued.
--
-- A source is a story or page to harvest; its URL, when set, is its identity (exact match after
-- trimming). A harvest is one pass over a source at a filter such as "CEFR A2+", and collects one
-- or more pastes; vocab.harvest_id links each item it created. Deletes are explicit in domain
-- code, so no ON DELETE clause is needed: deleting a source deletes its harvests and unlinks
-- their items in one batch.

CREATE TABLE sources (
  id         TEXT PRIMARY KEY CHECK (length(id) = 26),
  name       TEXT NOT NULL CHECK (name <> ''),
  url        TEXT CHECK (url IS NULL OR url <> ''),
  notes      TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX sources_url ON sources (url) WHERE url IS NOT NULL;

CREATE TABLE harvests (
  id         TEXT PRIMARY KEY CHECK (length(id) = 26),
  source_id  TEXT NOT NULL REFERENCES sources (id),
  filter     TEXT CHECK (filter IS NULL OR filter <> ''),
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX harvests_source ON harvests (source_id, created_at);

ALTER TABLE vocab ADD COLUMN harvest_id TEXT REFERENCES harvests (id);
ALTER TABLE vocab ADD COLUMN released_at TEXT;

UPDATE vocab SET released_at = added_at;

-- The queue is read in FIFO order (added_at, id) among released_at IS NULL rows.
CREATE INDEX vocab_queue ON vocab (released_at, added_at);
CREATE INDEX vocab_harvest ON vocab (harvest_id) WHERE harvest_id IS NOT NULL;
