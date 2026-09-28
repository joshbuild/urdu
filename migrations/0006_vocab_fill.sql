-- 0006_vocab_fill: completeness-check rotation (f13, PRD FR-F9).
--
-- filled_at is the UTC instant an item was last in an applied completeness batch; null means
-- never. checked_at (0004) keeps its meaning: last in an applied correctness batch. Only the check
-- apply writes either: Vocab-tab edits, reviews and imports name their columns, so they leave it
-- alone. A completeness batch is the least recently filled items missing a chosen field
-- (worker/domain/check.ts), which the index serves.

ALTER TABLE vocab ADD COLUMN filled_at TEXT;

CREATE INDEX vocab_fill ON vocab (filled_at, added_at);
