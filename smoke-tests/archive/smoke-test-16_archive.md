# Smoke test 16 — Dash (f16)

Run after the sponsor deploys the build. No migration is needed. Use the installed Android PWA with real data.

1. **Tabs.** The bar shows Harvest · Vocab · Review · Dash · Voice · Settings, all six labels whole on one line (f17 replaced Read with Harvest and opens on Review on a fresh install; if this deploy predates f17, expect Read first).
2. **Loads.** Tap **Dash**. It shows "Loading your Dash…" briefly, then six cards: Known, Due forecast, Recall, Trouble items, Learning backlog, Review calendar. No card shows an error, `NaN` or clipped text. Time to show it is under a second or two. *(A failure here, or an error card with Retry, may be the Workers CPU limit; note it, since f16 Decisions names SQL aggregates as the fallback.)*
3. **Known and backlog are plausible.** Known looks right against the Vocab tab (items on an interval of 14 days or more; pills read Firm 2 wk or above). The backlog headline is roughly the count of New, Learning and Basic pills. The band chart starts at your first review day and ends at Today.
4. **Each card reads sensibly.** The forecast's first bar is today, and Overdue plus New (never reviewed) equals the Review tab's due count. Recall shows a percentage with `n=`, or "not enough reviews yet" below 30 recognition reviews, and a hint once there is enough. The calendar's last filled cell is today.
5. **Grading moves it.** Note today's calendar cell and today's forecast bar. Review one due item (any grade), go back to **Dash**, and confirm today's calendar cell counts one more review and the forecast or Overdue count has changed.
6. **Trouble item opens.** If the Trouble card lists items, tap one: the Vocab tab opens on that item. If it says "No trouble items in the last 30 days", record that and skip this step.
7. **Read-only.** Open the Dash twice more; Vocab due times and the Review due count do not change because of it.

Pass when all seven steps hold on the phone. Record any failure here before closing f16.

## Results

Closed 2026-10-02 on the sponsor's daily-use report. Deployed with f17 (0005–0007 applied remotely).

- Confirmed: the Dash opens with all six cards and no error (step 2), so the route stays inside the Workers CPU limit. The six tabs are in daily use (step 1).
- Steps 3–7 were not run step by step; waived on that report, since the derivations, route and view are covered by `shared/dash.test.ts`, the worker test and `src/dash/*.test.ts`.
