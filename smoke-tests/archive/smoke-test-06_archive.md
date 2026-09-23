# Smoke test 06 — f06 ChatGPT paste path (Stages 1–2)

Sponsor-run checklist, the Done-When gate for f06 Stages 1–2. The routes, the
validation and the prompts are tested and `pnpm check` is green (396 tests).
**Nothing has been seen on the phone yet, and no real ChatGPT reply has been
pasted.** There is no migration: the `handoffs` table has existed since 0001.

Tick as you go. **If a step fails, stop and note what you saw.**

---

## Part A — deploy (Git Bash, repo root)

```bash
git pull
pnpm run deploy
```

> **Voice is expected to be broken after this deploy.** `main` now carries f07
> s04, whose migration 0003 has not been applied to production D1. Creating a
> voice session will fail on the missing `voice_sessions` table until the
> sponsor runs `pnpm wrangler d1 migrations apply urdu --remote`. Nothing in
> this checklist touches voice: `GET /api/settings` falls back to the default
> caps when the rows are absent, and Settings simply omits the spend line. Note
> it and carry on.

- [x] A1 Deploy succeeds. On the phone, the Vocab tab shows a **CHATGPT**
      section under the list with four buttons: Copy prompt, Paste new vocab,
      Copy fill-in prompt, Paste fill-ins.
- [ ] `jml` issue: the buttons are at the bottom of the vocab list, which will get long. need to be at the top. #agent-fix.
  - Agent 2026-09-23: fixed — the CHATGPT section now sits between **New item** and the
    search/filters. Tick after the next deploy shows it there.

## Part B — new vocab round trip (Stage 1)

- [ ] B1 Tap **Copy prompt**. The note says "Prompt copied". (If the clipboard
      is refused, the prompt appears in a box to copy by hand. Note it if so.)
  - [ ] `jml`: not tested. i think the add-command-to-chat-project path is superior–less to do for me on the fly.
- [ ] B2 In a new ChatGPT chat, paste the prompt and add 3 words after it:
      one new Urdu word, one English word, and one word **already in your
      vault**. Send it.
  - [ ] `jml` not tested per above
  - Agent 2026-09-23: B1–B2 waived by the sponsor. The Copy prompt button stays as the
    fallback for a chat outside the Project; B3–B7 cover the same import path.
- [x] B3 ChatGPT replies with JSON only (a ```json fence around it is fine).
      Copy the reply.
- [x] B4 Tap **Paste new vocab**, paste, then **Save to vault**. Expected: two
      lines read "Added" and the vault word reads "Already in your vault",
      each with an Open link.
- [x] B5 Open one of the added words. Its fields match the reply, and it is
      due now.
- [x] B6 Paste **the same reply** again. Expected: "This reply was already
      imported; nothing new was saved", the same lines, and the vocab count
      unchanged.
- [x] B7 Paste `{"handoff_id": "x"}`. Expected: a red "Rejected: session_at
      …" message, and nothing saved.

## Part C — fill-in round trip (Stage 2)

`jml` still relevant?

- [x] C1 Tap **Copy fill-in prompt**. The note gives a count, e.g. "(20 items
      of 31; repeat for the rest)". `ٹیسٹ` should be among them.
- [x] C2 Paste it into a new ChatGPT chat and copy its JSON reply.
- [x] C3 Tap **Paste fill-ins**, paste, then **Preview**. Each item shows the
      fields it would gain. Nothing is saved yet: open an item in another
      tab, or back out, to confirm if you like.
- [x] C4 Tap **Save N items**. Open two filled items: the new fields are
      there, text they already had is unchanged, and "due in" is the same as
      before.
- [x] C5 Paste the same reply again and Preview. Expected: "This reply was
      already applied" and a Done button only.
- [x] C6 Copy fill-in prompt again. Expected: the items just filled are gone
      from the count, unless ChatGPT left some fields out.
- [ ] just need to refresh the message showing how many fill-in items after saving the items, to save refreshing to update
  - Agent 2026-09-23: fixed — saving fill-ins replaces the stale "Fill-in prompt copied (N
    items…)" note with a fresh count ("Fill-ins saved. N items still have empty fields.").
    Rides the next deploy; not a close blocker.

## Part D — record

- [x] D1 Note anything ChatGPT did that the app rejected (paste the red
      message here). That tells us whether the prompt needs tightening.

Notes:

- 2026-09-23: deployed as `07d51e5` with migration 0003 applied remotely first, so
  Part A's voice warning no longer applies. Part B was run through the standing ChatGPT
  Project instructions (`src/handoff/chatgpt-project-instructions.md`, command
  `vocab-json` after a real conversation) instead of B1–B2's Copy prompt: the chat
  minted its own `handoff_id`, and the paste added the new words. Whether the reply
  included a word already in the vault (B4's duplicate line) was not reported. B1–B2
  (Copy prompt), B5–B7 and Part C are still to run.
