# SolveBuddy — build log

Newest first.

## 2026-10-20 — Trick tests + 1 Expert Sudoku
- Colin's idea: one test puzzle per harder trick, then a full Expert. `scripts/sudoku_make_trick_tests.ts` →
  `packs/sudoku9-tricks.json` (Tricks 1–6: Pointing, Claiming, Pairs, Hidden pairs, X-wing, Y-wing) and
  `packs/sudoku9-expert.json` (Expert 1, needs Y-wing). Each test is kept only if a player following the hints
  is actually shown that trick (`playHints`, `tricksShown` in `hint.ts`). All 7 made in about 12 seconds.
- `makeLevel(level, tricks)` replaces the Medium/Hard makers.
- Hint text: a chain's Explain shows only the first step ("…leads to a number in 2 more steps: tap Show me");
  repeated notes are merged; "an 8".
- **Checked:** 34 checks (trick tests solved by hints and showing their trick; Expert graded Expert). Browser:
  X-wing chain (X-wing → Y-wing → 8) and Y-wing hint.

## 2026-10-20 — Expert Sudoku, trick 6: Y-wing
- **Y-wing** (`techniques.ts`, Expert): a two-number cell sees an a-or-c cell and a b-or-c cell; one of them must
  be c, so c is ruled out of cells that see both. The three cells are ringed in a hint.
- **Survey** (100 fully erased): Easy 55, Medium 8, Hard 4, **Expert 2**, Too hard 31. Y-wing used in 8. First
  Expert puzzles appear.
- **Checked:** 32 checks pass (Y-wing in the "every move matches the answer" check).

## 2026-10-20 — Expert Sudoku, trick 5: X-wing (first Expert trick)
- **X-wing** (`techniques.ts`): in two rows a number fits only the same two columns, so it's ruled out of the
  rest of those columns (and the same with rows/columns swapped). Grades now: Easy → Medium → Hard → Expert
  (adds X-wing) → "Too hard" (never shipped).
- **Survey** (100 fully erased): Easy 43, Medium 16, Hard 8, Expert 0, Too hard 33. X-wing appeared in 2 but
  finished none: more Expert tricks needed (Y-wing next).
- **Checked:** 32 checks pass (X-wing in the "every move matches the answer" check).

## 2026-10-20 — Expert Sudoku, trick 4: Hidden pairs
- **Hidden pairs** (`techniques.ts`, graded Hard): two numbers that can only go in the same two cells of a unit
  fill those cells, so every other number is ruled out of them. Blockers for both numbers show in blue.
- **Survey** (100 fully erased): Easy 46, Medium 8, Hard 4, harder 42. Hidden pairs used in 12, but it rarely
  finishes a puzzle on its own. The harder 42 need bigger tricks (triples, X-wing…).
- **Checked:** 32 checks (Hidden pairs in the "every move matches the answer" check). Not seen in the browser
  yet: no pack puzzle uses it; it reuses the Pairs visuals (rings, stripes, blue blockers).

## 2026-10-20 — Sudoku hints use only what's on the board
- Colin caught a Pairs hint that relied on an earlier hint's rule-out he couldn't see. New rule (backlog,
  Decided): hints read only correct numbers + center pencil marks; the page no longer remembers rule-outs.
- `engine/sudoku/hint.ts`: mistakes (numbers, then pencil marks that leave out the answer) → a number now →
  shortest chain of rule-outs to a number (breadth-first, up to 3; Show me plays "Step 1 of 2… So it's a 9")
  → else one rule-out whose Show me writes center pencil marks. Hints say where a ruled-out fact came from
  ("your pencil marks…" or "in the step above").
- Tricks record what they relied on (`uses`) and can list every rule-out (`allRuleOuts`).
- **Checked:** 32 checks, including Medium/Hard packs solved from the board only, 10 hard random puzzles with no
  wrong move (chains and pencil-mark hints), and a wrong pencil mark flagged first. Hints take under 20 ms.
  Browser: the 4-6 pair → 9 chain, pair kept ringed on the last step.

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

## 2026-10-21: Trick tests start at the trick
- Colin couldn't find Pairs, Hidden pairs, X-wing or Y-wing: each showed up only 11–23 hints in.
- The maker now fills in the easy numbers first, so each test's very first hint is its trick. Pairs needed
  a new puzzle (the old one always needed Pointing first). The Expert puzzle is left as it was.
- Check updated: each trick test opens on its trick. 34 checks pass.

## 2026-10-21: A trick and its number are two hints
- Colin clicked through Tests 1–4 and got lost: the answer cell lit up while he was still reading about the
  pair, the pair was never written down, and the blue blocking lines were too faint to see.
- Now a trick hint never shows an answer cell. Its Show me writes pencil marks (e.g. "8 9" in a hidden pair,
  the pair plus cleared cells for Pairs, the three cells for Y-wing). The next hint reads those marks and
  places the number. The chain play-through ("Step 1 of 2") is gone.
- Blocking numbers draw a solid blue bar along the whole row or column they block (a tint for a box).
- New check: a rule-out hint never points at an answer cell. 34 checks pass.

## 2026-10-21: Trick hints mark only the trick's own cells
- Colin: the blue bars looked odd, and Pointing's pencil marks (167, 1678, 467 in the cleared cells) looked
  like the wrong spots. He expected a 5 in the two highlighted cells.
- Blocked lines are a light-blue shade again (now shown over the hint's own shading).
- Pointing/Claiming write the number as a corner mark in the cells where it can go. Pairs/Hidden pairs write
  the two numbers in the pair only. X-wing/Y-wing still write what's left in the cells they clear.
- Hints now read corner marks the usual way ("this box's N is in one of these cells"), only when they're right
  (wrong ones are ignored, not flagged), and a pair of matching two-number center marks. The next hint outlines
  those marks and shades the line they block, and says so in its explanation.
- Dropped "so the next hint can use them" from Show me. 34 checks pass.

## 2026-10-21: Hint colors flipped
- Colin: the hint's own row/column/box is now light blue, and the lines that blocking numbers cast are light red
  (blocking numbers get a red outline). The test server now runs in its own window so low memory doesn't stop it.
- Then: cells where the number can go, and the answer cell, are outlined blue (the placed number is blue too).
  Rule: blue = can go / goes here, red = can't go.

## 2026-10-21: Stripes vs red, R8C6 names, Pairs says why, drag-to-select
- Colin's rule: a plain red shade = there's already that number in the row/column/box; red stripes = ruled out
  by a trick or your marks (e.g. the cells your corner 7s rule out). Hints now stripe those cells.
- Cells are named R8C6 in hint text (was "row 8, column 6", which read badly with commas).
- Pairs now says why the two cells are down to two numbers ("every other number is already in their row,
  column or box").
- Sudoku drag-to-select (like Star Battle): press and drag over cells, or Ctrl/Shift-click to add; a number,
  pencil mark or Erase then changes them all (a pencil mark comes off all of them if they all have it).
  Givens are skipped. One Undo per change.
- Kept Pointing's marks in the corner, not the center: a lone center 5 would mean "this cell is a 5".

## 2026-10-21: Pairs in two steps, X-wing marks its corners
- **Pairs** (Colin: Tricks 3 still unclear): Explain says what the box still needs, then which line already has
  the other numbers ("Box 8 still needs 2, 3, 4, 5 and 9. Column 6 already has 4, 5 and 9, so R8C6 and R9C6 can
  only be 2 or 3."). Those numbers are outlined in red with their line.
- **X-wing** (Tricks 5): Show me puts a corner mark in the four cells where the number can go, not full pencil
  lists in the cells it clears. `fromGroups` reads X-wing corner marks back (used only if right), so the next hint
  places the number. A single corner mark in a box no longer counts as "the box's N is here".
- Colin: Tricks 1–4 good now. Y-wing (Tricks 6) still writes pencil lists in the cell it clears; see what he says.
- **Checked:** 35 checks (new: X-wing marks its 4 corners, then a number follows). Browser: Tricks 3 and 5.

## 2026-10-21: "Only number for cell" in two steps when marks are involved
- Colin (Tricks 5, the 3 hints after the X-wing): "every number except 3 is either already in its row, column or
  box, or ruled out" was too much at once. Now: "R5C6's row, column and box already have 1, 4, 5, 6, 7, 8 and 9.
  That leaves 2 or 3. It can't be 2: your marked 2s say column 6's 2 is at R2C6 or R7C6. So it's a 3."
- How: the step's text has a `{ruled}` slot; `withNotes` fills it with one reason per ruled-out number, from each
  mark group's new `why(r, c, n)` (pairs, box corner marks, X-wing corner marks, the cell's own pencil marks).
- **Checked:** 35 checks; Test 5's next 3 hints printed from the engine.
