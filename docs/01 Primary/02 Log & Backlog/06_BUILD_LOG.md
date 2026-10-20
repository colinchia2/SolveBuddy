# SolveBuddy — build log

Newest first.

## 2026-10-20 — Easy packs for both games + localhost test page with hints
- **Sudoku step 4** (`makePuzzle.ts`): an erase is kept only if the puzzle keeps one answer, stays Easy, and
  every row, column and box keeps 2–6 numbers. 5 puzzles (36 numbers showing) saved to
  `packs/sudoku9-easy-starter.json`. About 2 seconds for all 5.
- **Star Battle engine** (`engine/starbattle/`): place non-touching stars → grow regions (smaller regions grow
  more often) → repair until exactly one answer → regions must be 3–14 cells → grade with 4 easy tricks
  (Star rules out, Last cell, Confined region, Row/column inside one region). "Would block" exists and grades
  Medium. 5 puzzles saved to `packs/starbattle8-easy-starter.json`. About 30 seconds for all 5.
- **Hints** (`hint.ts` in each game): mistakes first, then the easiest trick. Each trick carries its Nudge and
  Explain text, plus the cells to highlight.
- **Test page** (`web/`): both games, ported from the mockups. Hint card slides up; focus area highlighted
  (terracotta for Sudoku, full region color for Star Battle), stripes on cells to cross out, terracotta ring
  on the target. In-game settings sheet (Colin's request). Star Battle drag-to-× (Colin's request). Stand-in
  "Solved!" sheet.
- **Checked:** 21 free checks, including "tapping Show me over and over solves every pack puzzle with only
  correct moves" for both games, and "a wrong mark is pointed out first". Checked in the browser too: hint
  ladder, mistake hint, wrong-number red, drag + wipe + one-step Undo.
- **Lessons:** (1) a first try at Star Battle gave 1-cell and 30-cell regions, so the size rule plus repair step
  was added. (2) Even-sized random regions almost never have one answer; repairing beats retrying.
  (3) PowerShell Get/Set-Content garbled UTF-8 characters; repaired with Python.
- Commits (local): b2ea27e … e29bf32.

## 2026-10-20 — Sudoku engine, steps 1–3
- **Step 1, full grid** (`engine/sudoku/fullGrid.ts`): fills cell by cell with 1–9 in random order, and backs up
  when stuck. Check: 200 grids all valid and all different, and a deliberately broken grid gets caught.
- **Step 2, erase** (`countSolutions.ts`, `erase.ts`): erases cells in random order and keeps an erase only if
  the checker still finds exactly one answer. The checker tries every possibility and stops counting at 2.
  Erasing as far as possible left about 25 numbers. Check: 10 erased puzzles each have exactly one answer.
- **Step 3, grade** (`techniques.ts`, `grade.ts`): three human tricks, easiest first: Last cell (in a box, row or
  column), Only spot (in a box, row or column), Only number for cell. Each move carries a plain-English "why",
  which will become the hint's Explain text. If the tricks finish the puzzle, it's Easy. Seen so far: puzzles
  with 40, 34 or 30 numbers left were Easy; one with 26 got stuck. Check: every trick move in 20 puzzles
  matched the real answer.
- **Lesson:** a new check caught a real bug. The checker counted a full grid that broke a rule as "1 answer".
  Fixed: it now rejects rule-breaking givens up front.
- Commits (local): 0ac426a, 1319ba6, 1034649.

## 2026-10-20 — Project set up
- Took over from a Claude Chat agent. Unzipped its handoff into `docs/02 Hand-off from Chat/`.
- Created the docs layout (same shape as CheckBuddy). Local git repo started.
