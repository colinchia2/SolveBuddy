# SolveBuddy — backlog

Top item = what's next.

## Next
- Mock the blue SolveBuddy look (accent terracotta → blue; hint red stays), then build it after Colin picks.
1. **Expert Star Battle** (Colin said yes to the idea 10/20; not started). Teach the engine harder tricks
   first, explaining each one to Colin in plain English before adding it. Then make 1 Expert 8×8 puzzle that
   needs them, and Colin plays it with hints to pressure-test the less obvious hints.
   Harder tricks to consider: "Would block" (already written, graded as Medium), "N regions share N rows/columns",
   and more as needed. Grade = the hardest trick required.
   - Built 10/20 (see build log). Waiting on Colin to play it (he was away from his computer).
   - **Colin's idea (10/20): show the "What if" chain step by step.** Don't just say "after 3 forced moves";
     play the forced moves out on the board one at a time so he can *see* why the row, column or region runs dry.
     Why: he tries What-if in his head all the time and loses track. Keep chains short (3–5) so it fits.
     Built 10/20 (see build log). Colin played the Expert puzzle through and liked it. DONE.
2. **Expert Sudoku**, the same way: pairs, pointing, box/line, then harder (X-wing, etc.).

## New ideas from Colin (10/20), not started, one at a time
- **Import a puzzle from a screenshot** (changes the earlier "no importing" decision). Two cases: a fresh puzzle
  ("put it in SolveBuddy so I can solve it there") and a half-done one ("help me from here"). For Star Battle,
  Sudoku and Water Sort. Hints are the whole point: he wants to *learn* by getting hints on puzzles he finds.
  Example: `docs/03 Ideas/import-example-starbattle-in-progress.png` (8×8 1-star Hard, partly solved).
  Open: how the screenshot becomes a board (reading an image needs AI or typing it in; the solver/hints stay code).
- **Water Sort** (pour-the-colors tube game). Make new levels + hints, plus "help me from here" on his phone game.
  Example: `docs/03 Ideas/watersort-example-level171.png` (14 tubes, 12 colors × 4, 2 empty).
  Note: it's a planning puzzle, not deduction. With every color visible there's no luck, so a solver can search
  for a full solution and hints = the next good move plus the strategy behind it. Versions that hide colors
  do involve luck. Colin also wants the strategy and best practices written up.
- **Two-star Star Battle** (2 stars per row, column and region, e.g. 10×10). Partly answers open question 2.
- **Block-dropping game** (Tetris-style), offline for the subway. No logic or hints: random pieces, speed
  increases, swipe or tap to move/rotate/drop. Needs a generic name (not "Tetris", a trademark; handoff rule).
- **Said no: Flow Free.** His App Store version is already perfect and free, so there's no reason to rebuild it.

## Decided
- **SolveBuddy is blue (Colin, 10/21).** App icon = the blue light-bulb face. The app's terracotta accent changes to blue
  (web change, no build). Hints keep red for blocked cells, separate from the brand blue. Mock it first.
- 10/20: v1 = **Star Battle + Sudoku** (Mini 6×6 and Classic 9×9). Both have finished screens, and they're
  the ones Colin gets stuck on most. Other games and Sudoku variants come later.
- 10/20: puzzles are **made by the app**, with no importing for now (later the same day Colin asked for
  screenshot import as a future feature; see New ideas). Made puzzles are always checked and graded;
  imported ones may belong to someone else and would still need checking.
- 10/20: first build = 5 Easy 9×9 Sudokus + 5 Easy 8×8 Star Battles, step by step so Colin understands how
  each is made. Done.
- 10/20 (Claude's pick, Colin didn't object): the engine is written in **TypeScript** so the iPhone app and the
  website share one copy of the puzzle logic. Tricks live in one ordered list, and the same list drives
  the Hint button.
- 10/20 (Colin): **Easy Sudoku keeps 2–6 numbers in every row, column and box.** Why: an empty row or an
  almost-full row looked lopsided.
- 10/20 (Claude, after seeing lopsided output): **Star Battle regions are 3–14 cells** (no 1-cell freebie, no
  giant region). Even sizes made one-answer layouts rare, so the generator now *repairs* layouts (moves a cell
  into a neighboring region to break a second answer) instead of starting over.
- 10/20 (Colin): test on a **localhost page before any app** ("not ready to make it an app yet").
- 10/20 (Colin): the game screen gets its own **settings button** (sliders icon, next to Restart). It opens a
  "Game settings" sheet with the toggles for that puzzle (Show timer, Show mistakes as I play, plus the
  per-game ones), so you don't have to leave the puzzle. Same settings as the main Settings screen.
  Why: sometimes he wants wrong numbers flagged as he places them, sometimes not.
- 10/20 (Colin): Star Battle "Auto-cross around stars" is **off by default** (the Settings mockup had it on).
- 10/20 (Colin): Star Battle **press-and-drag marks ×** on every empty cell you pass (starting on an × wipes
  instead). Same on mouse and finger. One drag = one Undo. Fast swipes fill the cells in between.
- 10/20 (Colin): **a hint only uses what's on the board**: correct numbers and your center pencil marks. Never
  a hidden "earlier step". Prefer hints that end in a placed number; if it needs rule-outs first, Show me plays
  the short chain (up to 3) step by step. If no short chain exists, give one rule-out and write it into pencil
  marks so it's visible. Why: "an earlier step that I didn't see... then I don't know that." Corner marks are
  not read as "this cell is one of these" (see 10/21: they're read as "this box's N is in one of these").
- 10/21 (Colin): **a trick and the number it leads to are two separate hints.** The trick hint writes its
  result into pencil marks and shows no answer cell; the next hint uses those marks to place the number.
  Why: one hint that jumped from the pair to a number in another box was hard to follow.
- 10/21 (Colin): **a trick hint's pencil marks go only in the trick's own cells** (a 5 in the two cells where
  5 can go; the pair's two numbers), never full lists in the cells it clears. Hints read corner marks as "this
  box's N is in one of these" when they're right. Why: "be careful with pencil marks, that would be confusing."
  X-wing / Y-wing still write full lists in cleared cells; revisit when Colin plays Tests 5–6.
- 10/20: design-checker warnings about Inter, glass borders and nested cards are left as-is, because they
  come from the approved mockups.

## Parked
- A real "Solved!" screen design (the test pages use a stand-in sheet).
- Mini Sudoku 6×6 generator (same steps, 2×3 boxes).
- Medium / Hard grades for both games (comes with the Expert work).
- Putting the repo on GitHub.

## Open questions (from handoff §9), one at a time
1. iPhone app: Expo like TasteBuddy, plus an installable website? Confirm.
2. Star Battle at Expert: bigger boards or two stars per row? (For now: Expert = 8×8, harder tricks.)
3. Which Sudoku variant first (killer? thermo?), after v1.
4. Dark theme design (the setting exists, no mockup yet).
5. Later stats charts; sync stats across devices?
6. Is there any "daily" puzzle (for streaks)?
7. Groups: brainstorm handmade word groups with Claude when ready.
