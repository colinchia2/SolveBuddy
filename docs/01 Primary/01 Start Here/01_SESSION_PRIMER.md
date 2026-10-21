# SolveBuddy — session primer

Read this first in any new session ("pick up SolveBuddy"). Short on purpose.

## Right now (2026-10-20)
- **Done:** 5 Easy 9×9 Sudokus + 5 Easy 8×8 Star Battles, each with real hints, playable on a localhost
  test page (Sudoku ↔ Star Battle switch above the phone). Colin has played them and likes them.
- **Done too:** 1 Expert Star Battle (`packs/starbattle8-expert.json`). Colin played it through: What if hints
  play out step by step on the board, and wrong-star hints say why. He liked it.
- **Next step:** Colin picks: Expert Sudoku (explain each trick → add it → 1 puzzle → Colin tests), or more
  Expert Star Battles, or one of the new ideas.
- **New ideas parked (10/20):** screenshot import, Water Sort, two-star Star Battle, a block-dropping game.
  Flow Free is a no. See the backlog's "New ideas". Don't start them until Colin picks one.
- **Open questions:** the backlog's list, one at a time, when Colin is ready.
- **To pick up, read:**
  1. This file (rules + how to start the test page below).
  2. `../02 Log & Backlog/06_BUILD_LOG.md`: the newest entry.
  3. `../02 Log & Backlog/08_BACKLOG.md`: Next, Decided, Parked.
  4. `engine/starbattle/techniques.ts` and `grade.ts` (where the harder tricks go), then `checks/run_all.ts`.
  5. When needed: `docs/02 Hand-off from Chat/SOLVEBUDDY_HANDOFF.md` §3 (hints), §5–6 (design).

## Read in this order (general)
1. `05_PROJECT_STATUS.md` (this folder): where things stand.
2. `../02 Log & Backlog/06_BUILD_LOG.md`: the newest entry only.
3. `../02 Log & Backlog/08_BACKLOG.md`: what's next.
4. When needed: `docs/02 Hand-off from Chat/SOLVEBUDDY_HANDOFF.md`: the full spec, decisions and rejected ideas.

## Key rules
1. **Less is more** with Colin: plain English, short, ~5 ideas per message, no code in messages, one thing at a time.
   If he asks for more than that at once, slow it down and say why.
2. **Port, don't redesign.** The mockups in `docs/02 Hand-off from Chat/design/solvebuddy/` define the look and
   behavior. Changes are Colin's call: show him first, then build. Don't bring back anything in handoff §7.
3. **No AI at runtime.** Hints and puzzle-making come from a code solver, so they're always right.
4. **Fully offline.** Puzzles and hints must work in airplane mode.
5. **Icons, never emoji**, in screens and mockups.
6. **Every fix ships with a free check** in `checks/run_all.ts`. Run `npm run checks` before committing.

## How to run things
- Node 24 runs the TypeScript files directly. No install step.
- `node scripts/step1_full_grid.ts`, `step2_erase.ts`, `step3_grade.ts` show each Sudoku step working.
- `node scripts/step4_make_easy.ts` / `node scripts/starbattle_make_easy.ts` remake the Easy packs (overwrites).
- **Test page:** `node web/server.ts`, then open http://localhost:4321. Plays both packs with real hints.
  It runs the real engine in the browser (the server strips the TypeScript types). Shared styles live in
  `web/common.css`. Settings are remembered in the browser under `solvebuddy.settings`.
- `npm run checks`: 21 free checks (rules, one answer, grades, hints solve every pack puzzle, mistakes first).

## Gotchas already hit
- **Never bulk-edit files with PowerShell `Get-Content`/`Set-Content`.** It read UTF-8 as the wrong encoding and
  garbled every ×, · and →. Use the Edit tool, or Python reading/writing bytes as UTF-8.
- Browser test tools drag in one jump, and so can a fast finger. Drag code must fill in the cells in between.
- The answer-counter must reject a puzzle that already breaks a rule. Otherwise a full but wrong grid counts as
  "1 answer". It's fixed and covered by a check.
