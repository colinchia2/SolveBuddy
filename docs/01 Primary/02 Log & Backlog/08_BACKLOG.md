# SolveBuddy — backlog

Top item = what's next. Lists set by Colin's triage on 11/1 (priority High / Med / Low, blank = not set; size S / M / L).

## Next up
1. **Talk through the app's structure (Packs vs Library vs Get more)** · High · M
   - Colin said this comes first, before more building. He finds Packs confusing: tapping a pack on the Packs tab
     jumps to Library; "which ones do I have vs what am I downloading?". Talk first, no building until he decides.
2. **Clean up old hosting code** · Low · S
   - Drop `bridge.js` HOSTED + the hosting in `scripts/build_site.ts` (the app OTA that made it unneeded landed 10/25).
3. **A daily puzzle for streaks (streaks already show)** · M
4. **Stats tab still uses the older glass cards** · S
   - Bring it in line with the 10/23 calmer screens.
5. **Make Shikaku puzzles by hand in Import** · M
   - Today only Claude adds them from a screenshot.

## Backlog
1. **FactPack: next cards** · High · M
   - Review card batches 2 and 3.
   - Re-run the Denver roads card.
   - Roads cards for SF, LA and Tokyo; redo NYC.
2. **iPad check and layouts** · M
   - Go through it with Colin on the iPad, both ways up (he only looked quickly 10/27); fix what he finds, one at a
     time. Every screen has its own iPad layout now (11/2).
3. **FactPack: housekeeping** · S
   - Give it its own git repo.
   - Ski cards false alarm.
   - Clear old test maps.
   - Hide words like BART, WMATA, CTA.
   - Rebuild the overlay page.
4. **Read puzzles from a photo inside the app (needs a small server and a key)** · L
   - A small server holding a SolveBuddy Anthropic key (Colin makes and adds the key; Claude never sees it). Not
     PythonAnywhere (10/21 decision), so likely a free Cloudflare Worker; ask Colin. ~1–3¢ a photo; the confirm screen
     already exists. Until then Colin sends screenshots in chat.
5. **Real downloadable packs (like Halloween)** · Low · L
6. **Stats charts, and syncing stats across devices** · Low · L
7. **FactPack ideas: a roads hint from parks and water; own subway diagrams** · Low · L
8. **More Sudoku variants** · Low · L
   - More Thermo Expert, Medium and Hard levels, cage outlines.
   - Later: Arrow, rules from a photo.
9. **After-puzzle review: "here's what you could have done"** · Low · L
10. **New games** · Low · L
    - Binairo, Five Letters or Groups (Colin picks).
    - Brainstorm word groups for Groups.

## Done (marked by Colin 11/1)
- Freeze fix (10/29 OTA, app `f9bce34`).
- All hint items: Star Battle hint polish, Killer hint speed (backlog E, 59df283), the slim hint card's stray line (S3).
- Water Sort items: par, shades per import, pour chains.
- The quick "Solved!" screen.
- Everything from the 10/20 ideas and the 10/22 voice note: import, Water Sort, Two-star Star Battle, Block Drop,
  Expert Star Battle + Sudoku, the blue look, Killer + Thermo, Nonogram, Shikaku.

## Decided
- **SolveBuddy is blue (Colin, 10/21).** App icon = the blue light-bulb face. The app's terracotta accent changes to blue
  (web change, no build). Hints keep red for blocked cells, separate from the brand blue. Mock it first.
- 10/20: v1 = **Star Battle + Sudoku** (Classic 9×9). Both have finished screens, and they're
  the ones Colin gets stuck on most. Other games and Sudoku variants come later.
- 10/20: puzzles are **made by the app**, with no importing for now (later the same day Colin asked for
  screenshot import; built 10/22). Made puzzles are always checked and graded;
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
- **10/27 (round 10/27, Colin's picks; mockups https://claude.ai/artifact/UmE8Eo1KnGWSXb8xB7haKK):**
  - Corner pencil marks: smallest first, 3 top right, 3 bottom left, 3 bottom right; top left left free for a cage sum.
    (He tried the keypad layout first and didn't like it.)
  - "Show mistakes" reds a pencil mark only when it clashes with a number you can see; never checked against the answer
    (that would give it away).
  - Hints used = a small number on the Hint button's corner (tap = "Hints used"); not a line above it.
  - Hint card = the slim card in the bottom bar's spot; boards stay centred (his 10/22 rule), never moved up.
  - Water Sort par stays visible after a hint, greyed "hint used"; it just doesn't count.
  - Pack pictures = option C: the pack's first puzzle as it starts + a size sticker; never progress, never the answer.
  - No Patches pack and no LinkedIn screenshots ("those come from LinkedIn, I don't want them"). Shape clues stay in the
    engine only for imports.
  - Shikaku: no line of text under the board, ever.
  - Water Sort and Block Drop need no pack picture (no pack list).
- 10/20 (Colin): **said no to Flow Free.** His App Store version is already perfect and free.

## Open questions
None. The handoff §9 ones are answered or now on the lists above.
