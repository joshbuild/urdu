-- 0010_checked_fields: which fields each item has been checked for (mp08, DECISIONS 261022b).
--
-- checked_fields is a bitmask, one fixed bit per check field (CHECK_FIELD_BITS in shared/api.ts:
-- roman 1, english 2, notes 4, example_urdu 8, example_english 16). Applying a correctness or both
-- check ORs in the batch's fields; nothing ever clears a bit. checked_at stays the instant of the
-- last check of any field. Like checked_at it is a stamp, not an edit: updated_at is left alone.
--
-- A check judges only values that are there: the bits are of the chosen fields the item had a
-- value in once the check's own writes landed (worker/domain/check.ts).
--
-- Backfill: an item already checked gets the bit of every content field it now has a value in.
-- The dialog defaulted to every field, and the batches don't record cheaply which fields each
-- applied item was judged on.

ALTER TABLE vocab ADD COLUMN checked_fields INTEGER NOT NULL DEFAULT 0 CHECK (checked_fields >= 0);

UPDATE vocab
SET checked_fields = (CASE WHEN roman IS NOT NULL THEN 1 ELSE 0 END)
  | (CASE WHEN english IS NOT NULL THEN 2 ELSE 0 END)
  | (CASE WHEN notes IS NOT NULL THEN 4 ELSE 0 END)
  | (CASE WHEN example_urdu IS NOT NULL THEN 8 ELSE 0 END)
  | (CASE WHEN example_english IS NOT NULL THEN 16 ELSE 0 END)
WHERE checked_at IS NOT NULL;
