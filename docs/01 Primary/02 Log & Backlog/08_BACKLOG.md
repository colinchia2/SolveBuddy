# SolveBuddy — backlog

Top item = what's next.

## Next (after the 10/22 save point; items 1–14 of the 10/22 voice note and Import v1 are DONE)
**From round 10/27 (S16, Colin):** a hint review after a puzzle: which hints, when, how much of each (thirds), and a
replay of the board at that moment. Fits the future Stats/analysis tab (D). The "Hints used" sheet (S13) says it's
coming. Also from 10/27: Water Sort "show me a shorter way" after finishing (par is already worked out).

**From 10/24 (app shell, `C:\dev\SolveBuddyApp`):**
- **DONE 10/25: Colin ran the OTA** (app `948e38d`: Library tab → home, Nonogram + Shikaku in GAMES) and confirmed it.
- **Optional cleanup:** drop `bridge.js` HOSTED + the hosting in `scripts/build_site.ts` now the OTA is confirmed
  (keeping it only helps an older app copy; no rush).
- **Next app OTA** (App.js + `src/GlassBack.js`, JS only, no build while the fingerprint holds): the glass back
  button uses `impactAsync(Light)`, which Colin doesn't feel; make it `selectionAsync`. In App.js map light
  impacts to `selectionAsync` and "warn" to `notificationAsync(Warning)`. Pages already send only "pick"/"success"
  (`bridge.js`, 10/24), so this is for the native button and for any older page.
- **Nonogram and Shikaku in the app's GAMES list:** DONE 10/25 (app `948e38d`, in the OTA above).

**From 10/24 evening (Shikaku round 2, build log "Shikaku Patches clues"):** Colin confirmed on the phone 10/25. Not built: making Patches puzzles by hand
in the Import tab (only Claude adds them from a screenshot for now).

**From Colin 10/23 (Buddy Family chat), in this order:**
- **A. FIRST TALK on pick-up: is the app's whole structure right?** Colin finds Packs confusing: tapping a pack on
  the Packs tab jumps to Library; "which ones do I have vs what am I downloading?". Talk first (where packs live,
  Library vs Packs vs Get more), no building until he decides.
- **B. Shikaku: BUILT + pushed 10/24 (build log 2026-10-24 "Shikaku"), waiting on Colin's phone test.** Was:
  (Colin likes LinkedIn's "Patches" UI/UX): every shape has a number (no blank "any" shapes), any
  rectangle or square; the stretch animation as you drag a shape out; a clear error state (Patches: hatched red +
  "this region can only contain 8 cells"); a celebratory finish animation that turns the solved grid into a graphic.
  Screenshots were in the 10/23 chat. A full new game: mockup first.
- **C. Nonogram + zoom: BUILT 10/23, done pending Colin's phone test (not pushed).** See build log 2026-10-23.
  To check on the phone: pinch/move feel in the app's web view, the drag lock, the firm buzz on a finished line, the
  picture finish. In the app Nonogram runs inside the Star Battle page (`?game=nonogram`) because the app only opens
  pages it lists; add "nonogram" to App.js GAMES + pull-pages at the next app change and drop `bridge.js` HOSTED.
- **Thermo bulb** looks like one solid shape: done 10/23 (d3ccecb).
- **D. Stats tab** still uses the older glass cards; bring it in line with the 10/23 calmer screens.
- **E. Check fails narrowly:** `sudoku_variants.ts` slowest Killer Expert hint ~520–530ms vs the 500ms limit (failed
  even alone on 10/23). Engine untouched that day; look at speeding the hint up (or the limit) before the next variant work.

1. **In-app photo reading** for imports: a small server holding a SolveBuddy Anthropic key (Colin makes the key and
   adds it; Claude never sees it). OPEN: which server — 10/21 decision was "no PythonAnywhere for SolveBuddy, ever",
   so likely a free Cloudflare Worker; ask Colin; ~1–3¢ a photo; the confirm screen already exists. Until then Colin sends
   screenshots in chat.
2. **Real Expert Triple:** make 3-star "What if" fast enough (<150ms) that Expert 3-star puzzles fit the hint budget.
3. **Sudoku variants:** Killer Easy 5 + Expert 5 (45 rule), Thermo Easy 5 + Expert 1, shipped 10/22. Next: 4 more
   Thermo Expert, Medium/Hard levels, cage outlines highlighted in 45-rule hints. Next: Colin's hint feedback, more puzzles,
   Medium/Hard (45 rule, innies/outies), then Arrow and a creator's own rules from a photo.
4. **After-puzzle review** ("here's what you could have done").
5. **New games:** Binairo, Shikaku, Five Letters, Groups (hold until Colin picks).
6. **Import several at once** (Colin 10/22: later; one or two at a time for now).
7. **Block Drop harder modes (idea):** today it gets harder only by speed, like modern versions, with a fair 7-piece
   bag. Options if Colin wants more challenge: pick a start level, a faster speed curve, or a "garbage rows" mode.
8. **Star Battle hint polish:** Colin will call out confusing hints as he plays; fix them one at a time.
9. **"Get more packs":** the card goes to the Packs tab; real downloadable packs (e.g. Halloween) come later.

## Colin's 10/22 evening voice note (phone testing), one at a time, improvements first
Improvements:
1. Star Battle hint: white bars behind the pretend × marks in a What if play-through (class clash with `.ghost`).
2. Star Battle "View solved puzzle": show YOUR finished board, with your × marks, not just the answer stars.
3. Resume tiles: never show a wrong state; show the pack page only once solved / resume / new are confirmed.
   The Resume sheet should say clearly what you're resuming.
4. Home: the header (face + SolveBuddy) stays fixed while the games scroll under it (now it scrolls into the clock).
5. All games: move the one-line tips ("Tap a tube, then…") into the ? sheet as a Controls section; keep the game clean.
6. Water Sort pour: liquid should visibly leave the source tube's mouth (stream starts at the liquid, no gap).
7. Water Sort hint card: always fully on screen above the game (Next reachable); the game can sit behind it.
8. Water Sort hints: say WHY in a step or two ("this frees the red underneath, which lets…"), not just the move.
9. No selectable text anywhere in any game (Block Drop showed Copy / Look Up).
10. Block Drop: Save card bottom right of the side panel.
11. Block Drop: controls stopped working after ~10 turns (had to quit the app). Bug.
12. Block Drop: remove the 4 bottom buttons; controls go in the ? sheet (incl. hold to drop faster).
13. Block Drop: opening asks Resume or New game, then a short 3-2-1 / "Go!" countdown.
14. Block Drop: short fun line-clear animation (bigger for 4 lines) and a game-over animation.
Bigger builds (after the improvements):
15. Import a puzzle from a screenshot (Star Battle, Sudoku, Water Sort): a "does this look right?" check screen,
    keep playing in SolveBuddy or get a hint from that exact spot. Maybe a 4th tab "Import". Open: where imports live;
    reading a photo needs AI (internet) — the solver and hints stay offline.
16. Sudoku variants (Killer, Thermo, a creator's own rules from a photo of the rules). Later.
17. After-puzzle review ("here's what you could have done"). Later.
18. Binairo, Shikaku, Five Letters, Groups: hold.

## Next
- **App main screens (Colin approved the blue mockup 10/21, canvas row "Blue SolveBuddy"):** Home/Library, Packs,
  Stats in blue. Plus, like TasteBuddy: (1) opening intro: logo centred → glides + shrinks to the top-left header
  logo (TasteBuddy `src/components/SplashOverlay.js`; native splash already matches: logo on #F6F4F1);
  (2) tap the top-left logo → wink/wiggle (TasteBuddy `WigglyLogo.js`); (3) the TRUE Apple Liquid Glass tab bar
  (`createNativeBottomTabNavigator`, like TasteBuddy `GlassTabs.js`), tabs Library · Packs · Stats. All app code:
  ships by update, no build.
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
