# Start fresh: clear solved puzzles, keep the streak

Done once, on 2026-11-02 (Colin: "clear all my solved puzzles, but keep my streak at 2 weeks").
This page says how, in case it's ever needed again.

## What it does
- Hidden: every solve from before the cutoff. Library ticks, "View solved puzzle", "See your hints", best times and
  every Stats card start from zero.
- Still counted: the weekly streak (and the "This week" box on Stats and its detail screen). They read every solve,
  old ones included, so the streak carries on.
- Dropped: half-done games started before the cutoff (these are on each device only, not in iCloud).
- Untouched: Block Drop scores, settings, imports, Water Sort looks.
- Nothing is deleted. The old solves stay stored and synced, so it can be undone by setting the cutoff back to 0.

## Why not just delete the solves (or run a script)
- There's no server: solves live on each device and in Colin's iCloud key-value store. A PythonAnywhere script can't
  reach them, and there's no console in the app.
- iCloud sync merges the solve log as a union (`web/sync.js`), so a solve deleted on one device comes back from the
  other. A cutoff date, which both devices read from the same pages, is the only reset that sticks.

## How it's built (pages only, ships by git push)
- `web/bridge.js`: `FRESH_AT` (the cutoff, in ms). `allSolves()` = the whole log; `solves()` = only solves at or after
  `FRESH_AT`. `logSolve` appends to `allSolves()` (never the filtered list, or the old solves would be wiped).
  `allSaved()` drops half-done games older than `FRESH_AT`.
- `web/screens.js`: `streaks()` and `weekCounts()` default to `allSolves()`.
- `web/stats.js` (hero) and `web/statsdetail.js` (the "week" screen) pass `allSolves()`.
- Checks: `globalThis.SB_FRESH_AT` overrides the cutoff. `checks/pages_smoke.mjs` sets it to 0 in every browser
  (its test data uses made-up old dates); its "Start fresh" check sets a real cutoff. `checks/run_all.ts` has a
  "Start fresh" check too.

## To do it again
1. Set `FRESH_AT` in `web/bridge.js` to the new moment (`Date.now()` at the time), and update the date in the
   `run_all.ts` "Start fresh" check.
2. `node checks/run_all.ts` and `node checks/pages_smoke.mjs`, then push.
3. On each device: open the app, wait about 30 seconds, swipe it away, reopen it twice.
