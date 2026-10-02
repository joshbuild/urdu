# Smoke test 15 — review correction (f15)

Run after the sponsor deploys the build. No migration is needed. Use real due items in the installed Android PWA.

1. Start an Urdu → English review. Tap the Urdu term before Reveal: it speaks. There is no separate Speak button.
2. Reveal and grade the first card deliberately wrong. On the next card, tap **Back**. The first card shows the recorded grade. Choose the intended grade. Confirm the next card returns and the graded tally is unchanged.
3. In Vocab, check that the corrected item's rung and due time reflect the intended grade. The export should contain one review event for that answer with the corrected grade.
4. Return to reviews and finish a session. On **Session done**, tap **Back to last card** and change or keep its grade. Confirm the tally and Vocab schedule.
5. Start an English → Urdu review. Reveal and tap the Urdu answer to hear it. Skip a card, tap **Back**, then reveal and grade it. Confirm the tally counts it as graded, not skipped.

Pass when all five steps work on the phone. Record any failure here before closing f15.

## Closed 2026-10-02

The sponsor reported the flow working in daily use on the deployed build, so f15 closed on that report and the unticked steps were waived.
