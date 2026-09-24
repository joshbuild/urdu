-- 0004_vocab_check: accuracy-check rotation (f11, PRD FR-F9).
--
-- checked_at is the UTC instant an item was last in an applied check batch; null means never
-- checked. Only the check apply writes it: Vocab-tab edits, reviews and imports name their
-- columns, so they leave it alone. A batch is the 20 least recently checked, never-checked first
-- (worker/domain/check.ts), which the index serves.

ALTER TABLE vocab ADD COLUMN checked_at TEXT;

CREATE INDEX vocab_check ON vocab (checked_at, added_at);
