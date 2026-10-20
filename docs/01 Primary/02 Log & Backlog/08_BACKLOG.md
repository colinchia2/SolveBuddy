# SolveBuddy — backlog

Top item = what's next.

## Next
1. Sudoku step 4: make 5 Easy 9×9 Sudokus (an erase must keep one answer AND stay Easy). Show Colin.
2. Star Battle 8×8, the same slow way: make a region layout → check for one answer → grade → 5 Easy puzzles.

## Decided
- 10/20: v1 = **Star Battle + Sudoku** (Mini 6×6 and Classic 9×9). Both have finished screens, and they're
  the ones Colin gets stuck on most. Other games and Sudoku variants come later.
- 10/20: puzzles are **made by the app**, with no importing for now. Made puzzles are always checked and graded;
  imported ones may belong to someone else and would still need checking.
- 10/20: first build = 5 Easy 9×9 Sudokus + 5 Easy 8×8 Star Battles, step by step so Colin understands how
  each is made.
- 10/20 (Claude's pick, Colin didn't object): the engine is written in **TypeScript** so the iPhone app and the
  website share one copy of the puzzle logic. Tricks live in one ordered list, and the same list will drive
  the Hint button.

## Parked
- Harder Sudoku tricks (pairs, pointing, etc.) for Medium / Hard / Expert grades. Today the grader only says
  "Easy" or "Harder than Easy".
- Mini Sudoku 6×6 generator (same steps, 2×3 boxes).
- Saving puzzles as pack files (handoff §8 format) for the app to load offline.
- Turning a trick move into the three hint levels (Nudge → Explain → Show me), plus the "mistakes first" check.
- Putting the repo on GitHub.

## Open questions (from handoff §9), one at a time
1. iPhone app: Expo like TasteBuddy, plus an installable website? Confirm.
2. Star Battle at Expert: bigger boards or two stars per row?
3. Which Sudoku variant first (killer? thermo?), after v1.
4. Dark theme design (the setting exists, no mockup yet).
5. Later stats charts; sync stats across devices?
6. Is there any "daily" puzzle (for streaks)?
7. Groups: brainstorm handmade word groups with Claude when ready.
