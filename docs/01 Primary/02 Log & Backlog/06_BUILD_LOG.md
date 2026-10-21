# SolveBuddy — build log

Newest first.

## 2026-10-20 — Expert Sudoku, trick 3: Claiming
- **Claiming** (`techniques.ts`): Pointing in reverse. If every spot for a number in a row/column is inside one
  box, the number is ruled out of the rest of that box. Graded Medium, next to Pointing (same difficulty).
- **Survey** (100 fully erased): Easy 43, Medium 13, Hard 3, harder 41. Still need more tricks for Expert.
- **Checked:** 30 checks (Claiming is in the "every move matches the answer" check). Browser: line lit, spots
  ringed, box cells striped, blocking 5s in blue.

## 2026-10-20 — Expert Sudoku, trick 2: Pairs (+ 1 Hard puzzle)
- **Pairs** (`techniques.ts`): two empty cells in a row, column or box that can each only be the same two numbers
  take both, so those numbers are ruled out of the rest of the unit. Steps can now rule out several numbers
  (`values`). Grades: Easy → Medium (Pointing) → Hard (Pairs) → "Harder than Hard".
- **Survey** (100 fully erased): Easy 39, Medium 11, Hard 3, harder 47. Pairs alone unlocks few puzzles; more
  tricks are needed before Expert.
- **1 Hard puzzle** (`makeLevel("Hard")`, `scripts/sudoku_make_hard.ts` → `packs/sudoku9-hard.json`, "Hard: 1").
- **Checked:** 30 checks (Pairs is in the "every move matches the answer" check; hints alone solve the Hard
  puzzle). Browser: pair ringed, cleared cell striped.

## 2026-10-20 — Expert Sudoku, trick 1: Pointing (+ 1 Medium puzzle)
- **Pointing** (`engine/sudoku/techniques.ts`): in a box, if every spot for a number is in one row/column, the
  number is ruled out of the rest of that line. First trick that rules out instead of placing, so the engine
  now carries "ruled out" facts (`RuledOut`), and the easy tricks respect them.
- **Grades:** Easy → Medium (adds Pointing) → "Harder than Medium". Survey of 100 fully erased puzzles
  (`scripts/sudoku_grade_survey.ts`): Easy 40, Medium 9, harder 51.
- **Hints (Colin chose A):** a ruled-out hint stripes the cells and rings the box's spots; Show me removes that
  number from your pencil marks there. If you don't use pencil marks, nothing else changes. The page remembers
  what hints ruled out so the next hint moves on.
- **1 Medium puzzle** (`scripts/sudoku_make_medium.ts` → `packs/sudoku9-medium.json`, "Medium: 1" on the page).
- **Checked:** 28 checks, including every trick move on 30 fully erased puzzles (Pointing used 50+ times) and
  "hints alone solve the Medium puzzle". Browser: stripes, rings, pencil mark 1 removed and 4 kept.
- **Colin's asks while testing:**
  - Sudoku hints (Only spot, Pointing) show the numbers that block the other cells: the number outlined in blue,
    and the row, column or box it blocks through shaded light blue (from Explain on).
  - **Pause** on both games: tap the timer (it has a small pause icon). An opaque "Paused" cover hides the
    puzzle so it can't be studied; Resume continues the clock. Switching tabs pauses too. No mockup existed,
    so it follows the sheet style (new design, Colin to judge).

## 2026-10-20 — What if plays out on the board (Colin's idea)
- Colin got "after 5 forced moves column 7 would have nowhere left" and couldn't see why. Now "Show me" on a
  What if hint plays it out: faint terracotta pretend star → Next → each forced move (ringed, region in full
  color, one-line why) → the empty line turns red → "Cross it out" puts in the real ×.
- Each star now rules out its neighbors in the same move, so filler "a star rules out…" steps are gone.
  Colin's board went from 5 moves to 2.
- New check: every What if play-through in the Expert puzzle really empties its line, in 5 moves or fewer.
- Colin played the Expert puzzle to the end ("this was really good"). Follow-ups from his play:
  - What if Nudge rings the cell to imagine instead of lighting up the line where the chain ends.
  - Wrong-star hints say WHY: a clash with another star, or a What if chain from the wrong star (Show me plays
    it out, then "Take it off"). If it only breaks after a long chain, it says so honestly. Checked on all 56
    wrong cells of the Expert puzzle.
  - Solved sheet has a close × (on the last puzzle of a pack there was no way out).

## 2026-10-20 — Expert Star Battle (folder now `Python\Buddies\SolveBuddy`)
- **New tricks** (`engine/starbattle/techniques.ts`), in ladder order: Would block (Medium), Groups: N regions in
  N rows/columns and the mirror, N = 2–4 (Hard), What if: pretend a star, follow forced moves, and if a row,
  column or region runs dry, cross the cell (Expert). The grade is the lowest tier that solves it, and
  "Too hard" is never shipped.
- **Survey** (`scripts/starbattle_grade_survey.ts`, 100 even-region layouts): Easy 6, Medium 14, Hard 59,
  Expert 21, Too hard 0.
- **1 Expert puzzle** (`scripts/starbattle_make_expert.ts`): made 8 Expert candidates and kept the toughest
  (What if ×5, groups ×2). Test page: "Expert: 1" (`?pack=expert`).
- **Hint fix:** What if first picked the first failing cell in reading order (chains up to 11 moves, too hard to
  follow). Now it picks the shortest chain (3–5 moves).
- **Checked:** 24 checks, including "every move of every trick matches the answer on 15 random puzzles" and
  "hints alone solve the Expert puzzle with only correct moves" (41 hints).

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
