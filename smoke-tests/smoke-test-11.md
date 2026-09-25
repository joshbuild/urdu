# Smoke test 11 — f11 vocab check (ChatGPT accuracy check)

A checklist for the sponsor to run; it is the phone gate for f11 (s04). The batch route, the
corrections preview and apply, the prompt and the tick model are tested, and `pnpm check` is
green. **Nothing has been seen on the phone yet, and no real ChatGPT check reply has been
pasted.** This deploy carries **migration 0004** (`vocab.checked_at`), which must be applied
to production D1 **before** the deploy. Otherwise every vocab read fails on the missing column.

Tick as you go. **If a step fails, stop and note what you saw.**

---

## Part A — migrate, then deploy (Git Bash, repo root)

```bash
git pull
pnpm wrangler d1 migrations apply urdu --remote
pnpm run deploy
```

- [ ] A1 The migration reports `0004_vocab_check.sql` applied, and the deploy succeeds.
- [ ] A2 On the phone, the Vocab tab's **CHATGPT** section shows six buttons. The two new
      ones are **Copy check prompt** and **Paste corrections**. The list still loads, which
      proves the new column is there.

## Part B — set up a batch with known mistakes

The first batch is the 20 oldest items (none has been checked yet). To make sure the chat
has something to correct, plant two mistakes in that batch first.

- [ ] B1 The Vocab list's **Added** sort is newest first, so the batch is at the very end of
      the list. Scroll to the bottom and, on two of the last few items, change something by
      hand: make one **English** meaning wrong (e.g. "water" → "fire"), and one **Roman**
      spelling academic (e.g. "pānī"). Note which items they are.
- [ ] B2 Note the "due in" of those two items and of one other item in the batch.

## Part C — check round trip

- [ ] C1 Tap **Copy check prompt**. The note says "Check prompt copied (20 items; N never
      checked in the vault)". (If the clipboard is refused, the prompt appears in a box to
      copy by hand. Note it if so.)
- [ ] C2 Paste it into a new ChatGPT chat (outside the Urdu Coach Project is fine). ChatGPT
      replies with JSON only; a ```json fence around it is fine. Copy the reply.
- [ ] C3 Tap **Paste corrections**, paste, then **Preview**. Expected:
  - a line "20 items in this batch; N with suggestions";
  - only the items ChatGPT would change, each with its reason and one row per field showing
    the field name, the old value struck through and "→ new" below it (the Urdu example
    right-to-left in Nastaliq), each row **ticked**;
  - a **Reset to first rung** tick under each item, **unticked**;
  - your two planted mistakes among them.
- [ ] C4 Readability at phone width: long values wrap and nothing runs off the screen.
- [ ] C5 Set up the mix:
  - leave one planted item with **every** change ticked;
  - on another item with two or more changes, **untick one**;
  - tick **Reset to first rung** on one item.
  The button reads "Apply to N items".
- [ ] C6 Tap **Apply**. The result screen reads "20 items marked checked" and, per item,
      "Saved: …", "Unticked, left as they were: …" for the unticked field, and "Reset to the
      first rung." for the reset item, each with an **Open** link.
- [ ] C7 Open the fully accepted item: every accepted value is saved, and its "due in" is
      unchanged from B2.
- [ ] C8 Open the partly accepted item: the unticked field still has its old value.
- [ ] C9 Open the reset item: it is on the first rung and due soon (about 3 h after its last
      review, or now).
- [ ] C10 Open the third item from B2 (one the chat left alone or didn't list): nothing
      changed, same "due in".

## Part D — repeats and rotation

- [ ] D1 Tap **Paste corrections**, paste **the same reply** again, **Preview**. Expected:
      "This reply was already applied; nothing changed." and a Done button.
- [ ] D2 Tap **Copy check prompt** again. The count of never-checked items has dropped by
      20, and the new prompt lists different items (none of the first batch).
- [ ] D3 (Optional) Run D2's prompt through ChatGPT. If it says everything is fine
      (`"corrections": []`), the preview says "the chat found nothing to change" and the
      button reads **Mark checked**. Tap it: "20 items marked checked".

## Part E — record

- [ ] E1 Note anything ChatGPT did that the app rejected (paste the red message here), and
      any suggestion that was wrong about Pakistani Urdu. That tells us whether the prompt
      needs tightening.
- [ ] E2 If a **Suggested spelling** flag appeared, note it. It is never applied; edit the
      item by hand if you agree.

Not covered here (Worker tests cover it): an item edited on another device between the
preview and Apply keeps its edit and is reported "Not saved, edited after the preview". On
the phone, leaving the preview sheet discards it, so the race can't be staged.

Notes:

-
