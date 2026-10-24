# SolveBuddy — build log

Newest first.

## 2026-10-23 — Nonogram phone-test tweaks: tap × first, ■ switch, tap a clue to finish a line, no highlight; zoom uses the whole screen
- Colin's phone test (10/23). **Pushed** (this ships Nonogram + zoom, the Water Sort pour fix and these tweaks).
- **Tap** (`web/nonogram.js`): × → fill → clear, like Star Battle. A small quiet **"× · ■" switch** in the info row
  (next to the timer): on ■ a tap fills first (fill → × → clear). Remembered per puzzle in its own store
  (`solvebuddy.nonogramMode`), so picking it alone doesn't make a puzzle "in progress" in the Library.
- **Drag:** paints what the first square shows after its tap: empty → × (or fill on ■), filled → fill, × → ×. Only
  onto empty squares, so a drag never clears (clear stays the third tap). Still locked to its row or column. To fill
  a run on ×: tap the first square twice, then drag from it.
- **Tap a clue** (row or column numbers): if the line's filled squares are exactly the picture's, × goes into every
  other empty square with a quick sweep along the line (≤ 4 light ticks, then the firm "line done" one); one Undo
  takes it all back. If not exactly right: the clue gives a small shake, nothing else (no buzz, no reveal).
- **No row/column highlight** any more (cells and clue strips). Hint's own line colour stays.
- **Zoom window uses the whole free space** (`web/zoom.js` new `area` option, both Nonogram 15×15 and Star Battle
  10×10+): the stage becomes the area between the info row (+ the hint line under Fit) and the dock, 16px gutters.
  At fit the window is the board, centred (15×15 already fills the width edge to edge); zoomed, it grows with the
  board until it fills the whole area (taller than wide). Fingers are measured against the area so pinching stays
  steady while the window grows. The info row keeps the Fit control's height on zoomable boards so the area never
  changes size. Star Battle's zoomed star count moved up to the hint line (left of "Two fingers to move…").
- Tip line and How-to-play updated (tap order, ■, drag from a filled square, tap the numbers).
- Checks: `run_all.ts` 48 PASS; `pages_smoke.mjs` 78 PASS (new: tap order × → fill → clear; no highlight while
  touching; drag from empty paints ×, from filled paints fill, from × paints × and never clears; ■ tap + drag fill;
  ■ remembered per puzzle; clue tap on a right line sweeps ×, ticks then firm, one Undo; wrong line only shakes;
  15×15 fit fills the width; zoomed window height within 8px of the free space and 16px gutters, Nonogram and Star
  Battle 12×12).

## 2026-10-23 — Water Sort pour: stream from the lip, liquid stays at the bottom (pushed with the Nonogram tweaks)
- Colin (phone screenshot, Hard #3): the tilted tube showed the poured colour at the OPEN end with empty space behind
  it, and the stream dropped from the tube's underside partway along. Same tilt kept.
- Fix (`web/watersort.js` `startPour` / `drawPour`): the tube is placed so the LOWEST corner of its mouth (the lip,
  worked out from the tilt) sits just above the other tube's opening, and the stream starts there. Inside the pouring
  tube nothing slides any more: the liquid stays against the closed bottom in tube space and the poured colour shrinks
  from its top, so empty space only shows at the open end (the old full-height box + slide-to-mouth is gone). The
  other tube still fills upward to meet the stream. Reduced motion and haptics unchanged.
- New page checks (sampled mid-pour): stream starts within 8px of the lip and lands inside the target's opening; the
  poured colour's height drops while the colours under it stay and nothing is moved toward the mouth; the target's
  new colour grows. `pages_smoke.mjs` 69 PASS. Mid-pour shot: scratchpad `nono_shots/pour_mid.png`.

## 2026-10-23 — Nonogram + two-finger zoom (backlog C; phone-tested, pushed with the tweaks above)
- Built from `docs/design/zoom_nonogram_mockup.html` + Colin's 10/23 decisions and comments.
- **Engine** `engine/nonogram/`: `line.ts` (line solver: what every arrangement of a clue shares), `solve.ts` (line logic
  to a standstill + an answer counter that guesses, so "one answer" is checked separately), `hint.ts` (a wrong filled
  square first, wrong × never trusted; then ONE row or column: Empty line / Line done / Fits exactly / Overlap / Out of
  reach / Every fit, each with a plain "why"; filling steps before ×-only steps).
- **Packs** (`scripts/nonogram_make_packs.ts`): 5×5 Easy (Heart, Tree, House, Boat, Cat), 10×10 Medium (Fish, Mushroom,
  Umbrella, Apple, Rocket), 15×15 Hard (Sailboat, Teacup, Butterfly, Snail, Whale). Every puzzle a named picture with a
  colour, exactly one answer, solvable one line at a time.
- **Page** `web/nonogram.html/js`: tap fill → × → clear; drag: first square decides (fill / clear / ×), locks to its row
  or column, fills every square between; haptics light per square, firm ("thud") when a row/column becomes complete
  and right, win buzz; finished clues grey; your row/column lights up; thick lines every 5; Hint (Nudge / Explain with
  striped squares / Show me), Undo (one per drag), Restart, Settings (timer, show mistakes), pause, timer.
  Finish: zooms to fit, × and grid lines melt, the picture sweeps into its colour; Solved card says "A heart!" with the
  picture as the medal (`celebrate()` takes `heading` + `medal`; no name = the usual card).
- **Zoom** `web/zoom.js` (touch events in the page, no app change): Star Battle 10×10+ (Double, Triple, big imports)
  and Nonogram 15×15 only. One finger always plays; two fingers pinch and slide; past fit it gives a little and
  springs back with a small bounce; Fit control (tiny map + zoom + Fit) only while zoomed, with "Two fingers to move ·
  pinch to zoom out" under it; at fit the tip says "Pinch with two fingers to zoom" (first 3 boards, until you've zoomed
  twice); two-finger double-tap = fit; zoom saved with the puzzle, a new puzzle starts at fit; the board holds every
  touch move (no page scroll). Nonogram's clue strips stay pinned and show only the visible rows/columns.
- **Library:** Nonogram is the 5th tile with "New" for 7 days from first seen (slate-blue icon from the mockup); its
  pack page rows 5×5 / 10×10 / 15×15 with the last solved picture as thumb and "zoom" only on 15×15; Packs tab block
  and Stats come from `GAMES` (bridge.js).
- **App shell finding:** the app only opens game pages in its own list (`App.js` GAMES) and only downloads its 8 known
  pages, so a new `nonogram.html` can't open on the phone without an app change. Workaround (no app change): the
  built `app/starbattle.html` also carries Nonogram and becomes it with `?game=nonogram` (`scripts/build_site.ts`,
  `bridge.js` HOSTED + `pageGame()`). Next time the app shell changes anyway: add "nonogram" to App.js GAMES and
  `pull-pages.mjs`, then drop HOSTED. The viewport/touch side needed nothing.
- Bugs caught by the new page test: Star Battle redraws its cells, which detached the touched cell mid-pinch (fix:
  redraw after the fingers lift, `zoom.whenFree`); a frozen getter meant zoom was never saved.
- Checks: `checks/nonogram.ts` (line solver vs brute force on 3000 random lines; every pack puzzle one answer + line
  logic; Hint alone solves all 15 with every step right and explained; wrong fill flagged first; no-name puzzle plays)
  in `run_all.ts` (48 PASS); `pages_smoke.mjs` +23 (tap cycle, row-locked drag with one light buzz per square, firm
  buzz on a finished row, grey clues, hint text, picture card, plain card; zoom only on the right boards; real
  simulated touches: pinch, two-finger move, one finger marks while zoomed, a second finger cancels a drag, spring
  back, Fit, two-finger double-tap, no page scroll, zoom remembered; Star Battle 12×12 zoom; the app's hosted page;
  Library tile/New/pack rows, Packs, Stats) = 66 PASS.

## 2026-10-23 — Thermo bulb and tube are one shape
- Colin (phone screenshot, Thermo Easy #1): each thermometer looked like two pieces; where the tube ran into the
  bulb it showed through, darker. Cause: the tube and the bulb each had their own 55% see-through, so the overlap
  was drawn twice. Fix (`web/sudoku.js` `extraLayer`): bulb and tube are opaque inside one `<g class="thermo">`
  that carries the 55% opacity, so the whole thermometer is one flat colour and highlights still show under it.
  The rules sheet has no thermometer drawing (only its text); the "rules sheet covers the board" check still passes.
- New check in `pages_smoke.mjs`: every thermometer is one group with exactly one tube + one bulb, neither with its
  own alpha, and the group is see-through. All PASS (run_all + pages_smoke); hidden-browser shot looked clean.
  Not pushed yet.

## 2026-10-23 — Header frost fades lower
- Colin (phone, Packs): scrolling, the header's frost faded right at the smile, so text showed through under the face.
  `web/screens.css` `.brandbar::before` now runs 18 below the bar and fades over 20 (was 0 and 10). Checked with a
  hidden-browser shot of Packs scrolled 30; `pages_smoke.mjs` 42 PASS.

## 2026-10-23 — Calmer screens (Library, pick a pack, one pack, Packs tab, Import tab)
- Built from `docs/design/calmer_screens_mockup.html` (Colin approved 10/23: "looks way better, do it"); it now
  supersedes the older handoff mockups for these five screens.
- **Library:** half-height tiles (38 icon, name + count beside it), smaller "What are we solving?" under the logo,
  streak without its box, the 4 unbuilt games as one quiet "Coming soon" line (never lists a playable game).
- **Pick a pack (every game):** plain back/help icons, title + "N of M done", one soft hairline list per pack family
  ("Starter – Single" → heading Starter, row Single; Sudoku's own packs under "Packs"), size + levels under each row,
  a small ring + "5/20", chevron; Get more packs = a quiet blue link (same place as before).
- **One pack:** short title ("Single", "Killer"), small bars + "4/10" per level (no bar), 50-high squares, solved =
  blue with best time and no star badge, in progress = blue outline + "Resume", key down to Solved / In progress.
- **Packs tab:** grouped by game, 2-wide blocks, one per pack named once with its levels underneath (Sudoku Starter
  = one 40 block; Trick tests 6, Killer 10, Thermo 6; Star Battle Single 20 / Double 10 / Triple 10; Water Sort
  Starter 30), all from the real pack data. No green ticks. **Fixed:** Killer and Thermo were still under "Coming
  soon"; that section is gone. Tapping a block opens that pack on Library (`openPack` in bridge.js: in the app a
  note in shared storage + switch tab, Library opens it on sbRefresh; no app shell change).
- **Import tab:** blue New import button + one line under it; "Your imports · N" with "All games" (opens a small
  sheet with the same four choices) and "Newest/Oldest" in one row; imports as 2-wide blocks under their day
  (icon + New / In progress / Solved, game, size/stars, time added; "…" Delete on hand-built ones kept).
- Browser preview only: the sticky header no longer sits 24px low over the next line (`html:not(.app) .brandbar`).
- `checks/pages_smoke.mjs`: Star Battle list under Starter, one-pack page, Packs blocks match the pack files (Sudoku
  Starter one 40 block), nothing playable is "coming soon", block opens the pack (browser and app), import blocks +
  filter + sort. run_all 47 PASS (the Sudoku variants hint-speed check flaked once; passed alone and on rerun),
  pages smoke 42 PASS. Not pushed yet.

## 2026-10-23 — Haptics on cell selection and drag marking
- Sudoku (classic, Killer, Thermo): selecting a cell = the selection tick ("pick", the lightest), one per cell a drag
  adds; a number, a note or Erase = the light "tap". Select and place are separate taps, so never two at once.
- Star Battle: a drag now taps once for each cell it marks or clears (before: nothing). Tapping a cell unchanged:
  × = "tap", star = "thud" (family standard: a star is a big mark).
- Water Sort (pick up, pour) and Block Drop (each piece lands) already buzzed; left as they are.
- No haptics on/off setting exists; all go through `haptic()` in `web/bridge.js`. No app shell change.
- `checks/pages_smoke.mjs`: stubbed app bridge counts every buzz on select / number / note / drag (all 3 Sudokus) and
  ×, star, drag-mark, drag-wipe (Star Battle); fails on the old code. run_all 47 PASS, pages smoke 34 PASS.
- Not pushed yet.

## 2026-10-22 (final) — Hints used on the Solved card; pop-ups above the board
- Hints count in thirds: each step (Nudge, Explain, Show me) adds 1/3 in Star Battle, Sudoku and Water Sort. The
  Solved card shows "1.33 hints used" (or "No hints"); the solve log keeps 2 decimals, saves keep exact thirds.
- Fixed: Thermo/Killer lines and numbers showed through the "How to play" sheet (pop-ups now z-index 50; the
  Sudoku board isolates its layers). Page tests check both.
- Colin now plays for a few days, then comes back with comments.

## 2026-10-22 (night, last) — Expert Killer (5) and Expert Thermo (1)
- New variant tricks (Expert only, `advanced: true`, so Easy hints stay byte-identical): the **45 rule** (innie/outie,
  1- and 2-cell, single and 2–3 adjacent houses), Cage claims a number, Cage squeeze / Thermo squeeze.
- `sudoku9-killer-expert.json`: 5 puzzles, 1–4 numbers showing, 45 rule used 4–7 times each.
  `sudoku9-thermo-expert.json`: 1 puzzle (Colin asked for one), 9 showing, 10 thermos, needs Hidden pairs + Thermo squeeze.
- Generators were slow (35 min, nothing) on a busy 8 GB PC: relaxed to 0–4 givens / 45 rule ≥1 (every puzzle uses
  it 4+ times anyway), one generator at a time, 20s per attempt with rejection reasons logged.
- Snapshots: classic Sudoku and Easy Killer/Thermo unchanged. run_all 47 PASS, pages smoke 0 FAIL.
- Next: Colin plays them; more Thermo Expert (4 to go), Medium/Hard levels, emphasise cage outlines in 45-rule hints.

## 2026-10-22 (night) — Killer and Thermo Sudoku (Easy)
- `engine/sudoku/variants.ts`: cage sums + no repeats; thermos climb from the bulb. countSolutions/hint/playHints take
  the rules. Hint order: (1) a cage/thermo trick that PLACES a number, (2) a classic number, (3) cage/thermo
  narrowing as pencil marks, (4) classic rule-outs. Tricks: Last cell in cage, Cage sum, Cage digits, Thermo order.
- Packs: `sudoku9-killer-easy.json` (5; 12 numbers showing, cages 2–5) and `sudoku9-thermo-easy.json` (5; 20 showing,
  5–7 thermos). Each: one answer (and more than one without the extra rules), solved by hints alone, a variant
  hint within the first 5. New Sudoku sets "Killer" and "Thermo". Classic Sudoku hints byte-identical
  (`checks/sudoku_snapshot.sha256`).
- Next: Colin plays them and calls out hints; then more puzzles and Medium/Hard (45 rule / innies-outies for Killer).

## 2026-10-22 (late) — Centring, last phone fixes, app backup
- Every game centred between the info row and the bottom bar (Star Battle was 95px high); `checks/pages_smoke.mjs`
  fails if a board is >40px off at 844 or 750px tall. Hint cards float over the bottom (no more squeezing).
- Water Sort: the poured colour drains from one end only (the clip box no longer follows it).
- Block Drop: swipe up = Save, quick flick down = drop, hold = faster; scores shrink to fit past 99,999; Next/Save
  pieces centred within 1px; scoring checks (guideline 100/300/500/800 × level, soft 1, hard 2 per row).
- App folder backed up: private repo `colinchia2/SolveBuddyApp` (push works now).
- Backlogs: TasteBuddy haptics question (TasteBuddy backlog), launch screens + CheckBuddy bar (family backlog).

## 2026-10-22 (evening) — Two new games, Import tab, phone feedback rounds
- **Water Sort** (30 levels, Starter pack Easy/Medium/Hard): solver hints that say WHY (`engine/watersort/explain.ts`,
  1–3 moves ahead, no move counts), tilt-and-pour animation where only the poured colour moves, tap to speed up.
- **Block Drop** (endless): swipe/tap controls (no buttons), Save piece (once per piece, bottom right), Resume or New +
  3-2-1, line-clear / 4-line / game-over effects, best score on the Home tile, stuck-input bug fixed.
- **Colin's 14 fixes** (voice note): Star Battle pretend-mark bars (a `.ghost` class clash), View solved shows YOUR
  board (`saveFinal`/`finalBoard`), Resume never wrong (the game hands Home its exact state on close + board picture
  in the Resume sheet), sticky Home/Packs/Stats header (and "What are we solving?" stays with it), no selectable
  text, tips moved into the ? sheets.
- **Hints and wrong marks (Colin agreed the POV):** hints build only on correct marks; a wrong × is never flagged on
  sight, only when the next step puts a star on it, with that step's reason. Wrong stars are still flagged first.
- **Import tab (4th tab):** list by day added + filters; build by hand (Star Battle paint regions, Sudoku printed/yours,
  Water Sort tubes); live answer check; wrong marks allowed with "Start anyway". Screenshot route for now: Colin
  sends it, Claude reads thick borders by pixel thickness (`scripts/read_starbattle_screenshot.py`) and only adds a board with exactly one
  answer. Mockup: canvas row "Import a puzzle (10/22)".
- **Star Battle engine:** stars per puzzle (`withStars`/`perUnit(regions)`), any size 5–12, 1–3 stars,
  `countAnswers.ts`; a stuck multi-star What if retries with fuller chains (budgeted 700ms); Hint pulses while thinking.
  Single/Double packs grade and hint byte-identically (`checks/starbattle_snapshot.sha256`).
- **Packs:** Easy Sudoku and Easy single Star Battle to 10; **Starter – Triple** (12×12, 3 stars) labelled **Hard**:
  real Expert 3-star puzzles had hints over the time budget, so a phone could get different hints.
- **Testing:** `checks/pages_smoke.mjs` runs the pages in hidden Chrome (Playwright, `channel: "chrome"`), replacing
  Chrome-extension clicking (Colin: too slow).
- **Checked:** run_all 46 PASS; pages smoke all PASS; each of Colin's 4 imports solved by hints; OTAs published.

## 2026-10-22 — More puzzles + Double Star Battle
- **Sudoku:** Medium, Hard and Expert now 10 each (`scripts/fill_pack.ts`; old puzzles kept so saves still match).
  A hint must never show a trick from a harder level (one Medium showed a Y-wing; replaced).
- **Star Battle Expert (8×8):** 10 puzzles (toughest of 6 tries each, as before).
- **Double Star Battle** (Colin: "Starter – Double" pack): 10×10, 2 stars per row, column and region.
  Engine counts stars needed (`perUnit`, `isAnswer` in `layout.ts`); every trick generalised, plus **Squeeze**
  (try every way to fit a unit's stars). One-star grading and hints are byte-identical to before
  (`checks/starbattle_one_star_snapshot.ts`). Generator `engine/starbattle/makeDouble.ts` (random regions → repair
  to one answer), 10 Experts in `packs/starbattle10-double-expert.json`.
- **Speed:** a Double "What if" chain follows the simpler tricks only (no groups), and the What if search stops
  chains that can't be shortest: slowest hint went from 2.5s to under 0.2s on the PC.
- **Game:** Star Battle has 2 packs: "Starter – Single" (Easy, Expert) and "Starter – Double" (Expert). Board,
  stars, red clashes, rules text, counter, view-solved and Solved! card handle 10×10 / 2 stars. 10th region
  colours: lime and grey. Packs tab shows each pack's real size.
- **Checked:** all checks pass (+ Double: one answer each, Hint alone solves all 10). Browser: Double #3 solved
  by Hint presses to the Solved! card; pack picker and pack page.

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
- Follow-up (Colin: "yes"): the board shows only the part of the X-wing marks that rules out that cell (column 6
  and its two marked 2s), not both columns. Mark groups can give a `near(r, c)` part. Checked in the browser.

## 2026-10-21: Y-wing in two hints, colored cell names
- Colin (Tricks 6): the Y-wing "went a little too far" and the words didn't match the board. All four fixes:
  1. **Colored names:** from Explain on, cell names in the hint text are blue for the trick's cells and red for
     ruled-out cells, matching the board (all hints, `paint` in `sudoku.js`).
  2. **Two hints:** first "R4C7 can only be 1 or 3, R5C8 1 or 8, R3C7 3 or 8"; Show me writes those pencil
     marks. Then the Y-wing, with the marks on the board (`hint.ts`, skipped if the marks are already there).
  3. **Why each is 8:** "If R4C7 is 1, R5C8 can't be 1 too (it shares a box), so R5C8 is 8."
  4. **Names the loser:** "R6C7 shares a box with R5C8 and a column with R3C7, so it can't be 8."
- **Checked:** 36 checks (new: Y-wing writes pairs first, then rules out). Browser: both Y-wing hints.

## 2026-10-21: On GitHub, live on GitHub Pages
- Repo `colinchia2/SolveBuddy` (PUBLIC, Colin's choice: free Pages). No PythonAnywhere for SolveBuddy.
- Live: https://colinchia2.github.io/SolveBuddy/ (opens Sudoku). Every push to main runs the checks, builds the
  site (`scripts/build_site.ts` → `_site/`, engine .ts → .js) and publishes it (`.github/workflows/pages.yml`).
  A push that fails the checks doesn't publish.
- Pages now use relative paths so the same files work on localhost, Pages and (soon) inside the app. The local
  server sends "/" to `/web/sudoku.html` (needs a server restart to take effect).
- **Checked:** built site served locally (Sudoku hints + Star Battle); live site loads and hints work.
- **Next:** phone app at `C:\dev\SolveBuddyApp` (WebView of the live site + offline copy, one production build,
  every native module and purpose string up front; never build without Colin's go).

## 2026-10-21: Phone app shell ready for its one build (not built)
- **Site:** the build now also makes `app/sudoku.html` and `app/starbattle.html`: one file each with style, code
  and packs inside (esbuild; pages read `window.SB_PACKS` before fetching). Checked: served alone, both load and
  hints work.
- **App:** `C:\dev\SolveBuddyApp` (local git; Expo project @colinchia2/solvebuddy, bundle com.colinchia.solvebuddy,
  SDK 56 like CheckBuddy). WebView opens the newest saved page (or the packed-in copy) with GitHub Pages as its
  address, so progress stays put and it works offline. Downloads newer pages in the background → a git push
  reaches the phone next launch, no build, no OTA. Haptics bridge, screen stays awake.
- **Installed up front:** web view, Liquid Glass, blur, haptics, notifications, mic + speech, photos/camera,
  image editing, media library, files, sharing, clipboard, keep-awake, audio, store review, splash, links,
  gradients, SVG, gestures, animations, screens + navigation (native tab bar), storage. Left out: Google sign-in,
  calendar, contacts, location (SolveBuddy has no accounts).
- **Purpose strings:** camera, photos, save to photos, microphone, speech. Background audio turned OFF (Apple
  rejects unused background modes). `scripts/check-build.mjs` checks all of it: 14/14 pass.
- SDK 57 exists (expo-doctor warns of an SDK 56 memory issue); stayed on 56 because CheckBuddy built fine on it.
- **Waiting on Colin:** icon colour (blue logo vs the app's terracotta), then his go for the build.

## 2026-10-21: Blue main screens + the app around them (ready to build)
- **Web:** `home.html` (face top left, tap = wink + hop + buzz; streak chip; game tiles, 4 "Coming soon"; level
  picker incl. Trick tests → plays the next unsolved puzzle), `packs.html` (7 packs on the phone with progress;
  "Coming soon": Killer, Thermo, Two-star), `stats.html` (streaks, month calendar, by puzzle, % without hints).
  Shared: `bridge.js` (app bridge, packs, solve log `solvebuddy.solves`), `screens.js/.css`. Game pages: blue brand
  tokens (`--brand*`; hint red stays `--accent*`), back button works, hints counted, each solve logged.
  App mode (`html.app`): full screen, 390-wide viewport on every iPhone, test strip hidden.
- **App:** Apple's native tab bar (`createNativeBottomTabNavigator`) Library · Packs · Stats, games on a native
  stack (swipe back), opening animation copied from TasteBuddy (`src/SplashOverlay.js`; Home reports its logo
  spot), keep-awake only in games, `--tabbar` padding injected.
- **Checked:** 36 checks; all 5 pages in phone-sized frames in app mode (layout, Play → open message, back →
  close message, Home logo spot 16,26 size 40); app bundles (953 modules); pre-build check 16/16.
  NOT checked: anything on a real iPhone (tab bar, animation, haptics). Fixes for those go by OTA, no build.
