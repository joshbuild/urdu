# Smoke test mp06 — Mixed-direction review

Run on the installed Android PWA after the deploy. About 3 minutes, or just your next normal
review session.

**Already covered by the agent:** unit tests for the weighting bands and their edges, the
no-English rule, per-card directions fixed at start and kept through Back and from the tally,
and fixed English → Urdu recording `ur_en` for a word with no English. On `pnpm dev`, headless
360 px shots showed the start screen (Mixed selected with its hint) and cards labelled each way,
with the revealed card and grade grid still on one screen. What's left needs your phone and
your judgement on the mix.

## Before (Git Bash, repo root)

```bash
git pull
pnpm run deploy
```

No migration.

## On the phone

1. **Review tab.** Direction shows **Mixed** first and selected, with the hint under it.
2. **Start review.** Each card's top row reads `n OF m` and, under it, **Urdu → English** or
   **English → Urdu**. Expect mostly Urdu → English on new words and more English → Urdu on
   words you've known for weeks.
3. **Grade an English → Urdu card, tap Back.** It comes back still English side up, with your
   grade shown as Recorded.
4. **After the session, open Dash.** Production recall starts to fill in instead of reading
   "not enough reviews yet" (it may take a few sessions to pass the threshold).

Done when normal use says the mix feels right. If it's too easy or too hard, say which way; the
numbers live in `shared/direction.ts`.
