-- 0008_topic_coverage: a topic and a CEFR level on each vocab item (f18, DECISIONS 261006a).
--
-- topic is a slug from the fixed list in shared/topics.ts, which owns which slugs exist, so the
-- column has no CHECK; Urdu Core validates every write. cefr is A1–C2. Both are nullable and
-- independent: an item is unclassified while either is null, and the classify check mode fills
-- them. vocab.tags keeps its shape but from now on holds 0–2 secondary topic slugs; legacy free
-- tags stay until a row's tags are next written. Additive: no rebuild, no backfill.

ALTER TABLE vocab ADD COLUMN topic TEXT CHECK (topic IS NULL OR topic <> '');
ALTER TABLE vocab ADD COLUMN cefr TEXT
  CHECK (cefr IS NULL OR cefr IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

-- Coverage counts group by both; the list and due filters narrow by topic.
CREATE INDEX vocab_topic ON vocab (topic, cefr);
