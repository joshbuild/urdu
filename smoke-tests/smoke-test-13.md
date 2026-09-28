# Smoke test 13 — f13 check modes (check options dialog, completeness)

A checklist for the sponsor to run; it is the phone gate for f13 (s05). The options parser, the
per-mode batch selection, the Worker's scope rules and stamps, the prompt and the options
model are tested, and `pnpm check` is green. **Nothing has been seen on a screen yet: the
dialog has not been rendered in a browser, and no real ChatGPT completeness reply has been
pasted.** This deploy carries **migration 0006** (`vocab.filled_at`), which must be applied to
production D1 **before** the deploy, or every vocab read fails on the missing column. If f12's
0005 is still pending, the same command applies both, in order.

Tick as you go. **If a step fails, stop and note what you saw.**

---

## Part A — migrate, then deploy (Git Bash, repo root)

```bash
git pull
pnpm wrangler d1 migrations apply urdu --remote
pnpm run deploy
```

- [ ] A1 The migration reports `0006_vocab_fill.sql` applied (and `0005_day_anchored_ladders.sql`
      if it was still pending), and the deploy succeeds.
- [ ] A2 On the phone, the Vocab tab's **CHATGPT** section shows **four** buttons: Copy
      new-vocab prompt, Paste new vocab, Copy check prompt, Paste check reply. The fill-in
      pair is gone. The list still loads, which proves the new column is there.

## Part B — the dialog

- [ ] B1 Tap **Copy check prompt**. A **Check options** sheet opens with: Check for
      (Correctness / Completeness / Both, Correctness selected), Fields (Roman, English,
      Notes, Example, Example (English), all ticked), How many items (20), and Only items not
      yet checked this way (unticked). It fits the screen; nothing runs off the side.
- [ ] B2 Untick every field: **Copy prompt** greys out and "Tick at least one field." shows.
      Tick one back.
- [ ] B3 Tap How many: the numeric keypad opens. Type 60: Copy prompt greys out and the hint
      says 1 to 50. Set it back to 20.
- [ ] B4 Cancel. Nothing is copied.

## Part C — completeness round trip

- [ ] C1 Open **Copy check prompt**, choose **Completeness**, tick only **Example** and
      **Example (English)**, How many **5**, and tap **Copy prompt**. The note reads "Check
      prompt copied (5 of N items; M not yet checked for completeness)", where N is the
      number of items lacking an example.
- [ ] C2 Paste into a new ChatGPT chat. The prompt starts "You are completing entries", and
      each listed item carries a `"missing"` list. ChatGPT replies with JSON. Copy it.
- [ ] C3 **Paste check reply**, paste, **Preview**. Each item shows its example lines as
      "(empty) → …", each **ticked**. If the chat also changed a field it wasn't asked for, the
      item shows "Ignored, not asked for in this check: …" with no tick for it.
- [ ] C4 Tap **Apply to N items**. The result reads "5 items marked filled" with Saved lines.
      Open one: the examples are there, nothing else changed, same "due in".
- [ ] C5 Open **Copy check prompt** again: the sheet remembers Completeness, the two example
      fields and 5. Copy: the prompt lists 5 **different** items, even if the chat skipped
      one in C3.

## Part D — correctness only

- [ ] D1 On one item with an English meaning, change it by hand to something wrong (e.g.
      "water" → "fire"). Note which. It must be among the least recently checked, so pick one
      near the bottom of the **Added** sort, or tick Only unchecked in D2.
- [ ] D2 **Copy check prompt**: **Correctness**, only **English**, How many 20, Copy. The
      prompt says "check only these fields of each item: \"english\"" and has no `"missing"`
      lists.
- [ ] D3 Run it through ChatGPT, paste, Preview: your planted mistake is among the changes,
      and no line shows "(empty) →" (a correctness check never fills; any fill the chat
      proposed shows as Ignored).
- [ ] D4 Apply: "… marked checked". The planted item is fixed.

## Part E — both, and only unchecked

- [ ] E1 **Copy check prompt**: **Both**, every field, How many 3, tick **Only items not yet
      checked this way**, Copy. The note counts items not yet checked both ways. The prompt
      has both a Correctness and a Completeness paragraph.
- [ ] E2 (Optional) Run it through and Apply: "3 items marked checked and filled".
- [ ] E3 Close and reopen the app (swipe it away), then open **Copy check prompt**: the sheet
      still shows the E1 options.

## Part F — record

- [ ] F1 Note any reply the app rejected (paste the red message here), anything ChatGPT
      filled that isn't everyday Pakistani Urdu, and whether completeness filled examples
      reliably. That tells us whether the prompt needs tightening.

Not covered here (Worker tests cover it): a batch copied before this deploy keeps f11's rules
when pasted after it; an accept for an ignored field is never written; each mode stamps only
its own column.

Notes:

-
