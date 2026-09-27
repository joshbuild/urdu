-- 0005_day_anchored_ladders: ladders anchored on a one-day rung (f12, DECISIONS 260927a).
-- Data only; no schema change.
--
-- 1. The active ladder moves from its retired f09 version (ids 2-6, starting at 3 h) to the
--    same multiplier's day-anchored version (ids 7-11). Any other value is left alone; the Worker
--    reads an unselectable id as the default, Dense (8).
-- 2. Untouched new items (never reviewed, still on step 0 of any ladder, including legacy
--    level-0 imports) move to the active ladder's entry rung, the rung below one day, where the
--    Worker now creates new items (shared/ladders.ts entryStep). due_at stays null, so they stay
--    due now; updated_at is left alone because this is a system move, not an edit. A
--    never-reviewed item on a higher rung was put there by hand and keeps it. Reviewed items are
--    not touched: each moves to the active ladder at its next review.
--
-- Entry rungs (ladder: step, seconds): 7: 3, 43200 · 8: 2, 36327 · 9: 2, 30547 · 10: 1, 25687 ·
-- 11: 1, 21600.

UPDATE settings
SET value = CASE value
  WHEN '2' THEN '7'
  WHEN '3' THEN '8'
  WHEN '4' THEN '9'
  WHEN '5' THEN '10'
  WHEN '6' THEN '11'
  ELSE value
END
WHERE key = 'active_ladder_id';

UPDATE vocab
SET
  ladder_id = CASE (SELECT value FROM settings WHERE key = 'active_ladder_id')
    WHEN '7' THEN 7 WHEN '9' THEN 9 WHEN '10' THEN 10 WHEN '11' THEN 11 ELSE 8 END,
  ladder_step = CASE (SELECT value FROM settings WHERE key = 'active_ladder_id')
    WHEN '7' THEN 3 WHEN '9' THEN 2 WHEN '10' THEN 1 WHEN '11' THEN 1 ELSE 2 END,
  interval_seconds = CASE (SELECT value FROM settings WHERE key = 'active_ladder_id')
    WHEN '7' THEN 43200 WHEN '9' THEN 30547 WHEN '10' THEN 25687 WHEN '11' THEN 21600
    ELSE 36327 END
WHERE last_reviewed_at IS NULL AND ladder_step = 0;
