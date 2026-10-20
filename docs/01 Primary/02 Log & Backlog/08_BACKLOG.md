# SolveBuddy — backlog

Top item = what's next.

## Next
1. **Expert Star Battle** (Colin said yes to the idea 10/20; not started). Teach the engine harder tricks
   first, explaining each one to Colin in plain English before adding it. Then make 1 Expert 8×8 puzzle that
   needs them, and Colin plays it with hints to pressure-test the less obvious hints.
   Harder tricks to consider: "Would block" (already written, graded as Medium), "N regions share N rows/columns",
   and more as needed. Grade = the hardest trick required.
2. **Expert Sudoku**, the same way: pairs, pointing, box/line, then harder (X-wing, etc.).

## Decided
- 10/20: v1 = **Star Battle + Sudoku** (Mini 6×6 and Classic 9×9). Both have finished screens, and they're
  the ones Colin gets stuck on most. Other games and Sudoku variants come later.
- 10/20: puzzles are **made by the app**, with no importing for now. Made puzzles are always checked and graded;
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
