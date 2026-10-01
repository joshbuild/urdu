# f17 vocab-intake — journal

## 261001d

Sponsor note: harvesting a big batch on the weekend of 2026-09-26 overloaded review. Asked for a
workflow that covers harvest, recording the source, batching and ingest. Options memo
`research/vocab-intake.md` (A outside the app, B staged bare words, C queued vault items with a
daily limit). Sponsor chose C.

The sponsor's answers:
- Batch size defaults to 10, plus a manual Intake button and a tank meter.
- FIFO release.
- A sources list on its own screen.
- No re-queue.

Round 2:
- Harvest takes Read's tab; Read is parked for 30 days.
- Auto-release stays.
- Low tank at 3 days.
- Queued items show with a badge.

Drafted f17 and stress-tested it. Four forks went to the sponsor, who took all four
recommendations:
- the new pile tops up to the batch size;
- new words come after due ones (an FR-A7 change);
- a paste learns its source from the harvest it is pasted into, not from a ChatGPT header;
- the app opens on Review.

Resolved in the doc:
- the queued state as `released_at`;
- a lazy top-up with a per-call claim, not a cron;
- release doesn't bump `updated_at`;
- a tracked review releases a queued item;
- a source's URL is its identity;
- every paste goes through a harvest;
- the Dash excludes queued items.

The seven slices were split along schema, domain, API and client lines. The deploy-order
dependency on the pending 0005/0006 is noted.
