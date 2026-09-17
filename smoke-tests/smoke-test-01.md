# Smoke test 01 — f01 browser gate + production deploy

Sponsor-run checklist covering the two checks the agent cannot perform: the s07
browser/device gate (local) and the s08 deploy + phone gate (production). Tick
as you go; note anything that fails and stop there rather than pushing past it.

**Before you start:** turn AVG **Hardened Mode** and **CyberCapture** off (turn
them back on afterwards). Do not add AVG exceptions — measured harmful
(DECISIONS 260917b). Never paste secret values into chat.

---

## Part A — local browser gate (s07)

Setup:

```powershell
pnpm wrangler d1 migrations apply urdu --local   # only if the local DB is empty
pnpm dev                                          # note the printed localhost URL
```

- [ ] A1 — the page loads at the printed URL and shows the unlock form.
- [ ] A2 — a **wrong secret** shows an error message and stays locked.
- [ ] A3 — the correct `.dev.vars` secret unlocks; the input clears.
- [ ] A4 — the status screen shows a **total** and a **due** count.
- [ ] A5 — **reload** the page: still unlocked (session cookie persists).
- [ ] A6 — **Lock** returns the unlock form; reload confirms it stays locked.
- [ ] A7 — offline path: stop the dev server (or go offline in DevTools), try
      unlock → a network error message appears, not a blank screen or a hang.
- [ ] A8 — failed **lock** while offline reports that the device is still
      unlocked and keeps the current view.
- [ ] A9 — Chrome DevTools device emulation (e.g. Pixel 7, narrow width): the
      layout holds with no horizontal scroll.
- [ ] A10 — tap targets (unlock button, lock button, input) are at least 48 px
      tall in emulation.
- [ ] A11 — the password manager offers to save/fill the secret on the unlock
      form.

Stop the dev server when done.

---

## Part B — production deploy (s08)

Run from the repo root. `pnpm deploy` is a pnpm built-in — use `pnpm run deploy`.

- [ ] B1 — `pnpm wrangler secret put UNLOCK_SECRET`
      (generate and store the value in a password manager; ≥ 24 characters).
- [ ] B2 — `pnpm wrangler d1 migrations apply urdu --remote`
- [ ] B3 — `pnpm run deploy`
- [ ] B4 — `curl.exe -s https://urdu.umber-amber.workers.dev/api/health`
      returns `{"ok":true}`.

---

## Part C — production smoke script (Done-When 4)

```powershell
$env:URDU_SECRET = "<secret>"
pnpm tsx scripts/smoke.ts https://urdu.umber-amber.workers.dev
Remove-Item Env:URDU_SECRET
```

- [ ] C1 — the script prints `smoke: N checks passed` and exits 0.
- [ ] C2 — no `cleanup:` line appeared (a run that passes deletes its own item
      on the happy path; a `cleanup:` line means a check failed first).
- [ ] C3 — the vault is unchanged afterwards: re-run the health call, unlock in
      the browser and confirm the total count matches what it was before.

If C1 fails on the *wrong secret* check with a rate-limit message, wait a
minute and re-run — the unlock limiter is 5/min per IP.

---

## Part D — phone (Done-When 2)

On the Android phone, in Chrome:

- [ ] D1 — open `https://urdu.umber-amber.workers.dev` and unlock.
- [ ] D2 — install the PWA (menu → Add to Home screen / Install app).
- [ ] D3 — the installed icon looks right on the launcher (maskable icon, no
      clipped lettering).
- [ ] D4 — launch the installed app: it opens standalone (no browser chrome).
- [ ] D5 — it is **still unlocked** after the relaunch.
- [ ] D6 — force-close and relaunch: still unlocked.
- [ ] D7 — **Lock** in the installed app, then relaunch: the unlock form is
      shown (the device is revoked).
- [ ] D8 — unlock once more so the phone is left in a usable state.

---

## Result

- Date run:
- Part A:
- Part B:
- Part C:
- Part D:
- Failures / notes:

All four parts green closes f01's Done-When 1, 2 and 4 (3, 5 and 6 are already
verified in-repo). Record the outcome in the f01 journal at wrap.
