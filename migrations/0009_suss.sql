-- 0009_suss: flag a vocab item as questionable (mp07, DECISIONS 261022a).
--
-- suss_at is the UTC instant the item was flagged during review or from the Vocab tab; null means
-- not flagged. suss_note is the sponsor's comment on what looks wrong, null when none. A flag is
-- not an edit: like checked_at it never touches updated_at, so a grade guarded on updated_at
-- still lands, and it never touches the schedule. Applying a suss check batch clears both.
-- Additive: no rebuild, no backfill.

ALTER TABLE vocab ADD COLUMN suss_at TEXT;
ALTER TABLE vocab ADD COLUMN suss_note TEXT CHECK (suss_note IS NULL OR suss_note <> '');
