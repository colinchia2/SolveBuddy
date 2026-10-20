# SolveBuddy — session primer

Read this first in any new session ("pick up SolveBuddy"). Short on purpose.

## Right now (2026-10-20)
- **Building:** the first puzzles: 5 Easy 9×9 Sudokus, then 5 Easy 8×8 Star Battles. Slowly, one step at a time,
  so Colin understands how each is made. Explain each step in plain English before and after building it.
- **Done:** Sudoku steps 1–3 (fill a full grid → erase while keeping one answer → grade with human-style tricks).
- **Next step:** Sudoku step 4: make the 5 Easy 9×9 Sudokus. While erasing, keep an erase only if the puzzle
  still has one answer AND stays Easy. Show Colin the 5 puzzles. Then start Star Battle the same slow way.
- **Open questions:** the backlog's list, asked one at a time, after the first puzzles.
- **To pick up, read:**
  1. This file.
  2. `../02 Log & Backlog/06_BUILD_LOG.md`: the newest entry.
  3. `../02 Log & Backlog/08_BACKLOG.md`: Decided + Parked.
  4. `engine/sudoku/` (fullGrid → countSolutions → erase → techniques → grade) and `checks/run_all.ts`.
  5. When needed: `docs/02 Hand-off from Chat/SOLVEBUDDY_HANDOFF.md` §2–3 (solver + hints), §4 (games).

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

## Gotchas already hit
- The answer-counter must reject a puzzle that already breaks a rule. Otherwise a full but wrong grid counts as
  "1 answer". It's fixed and covered by a check.
