# SolveBuddy — session primer

Read this first in any new session ("pick up SolveBuddy"). Short on purpose.

## Right now (save point 2026-10-23, from the Buddy Family chat)
- **Shipped 10/23 (live):** haptics (Sudoku select/drag ticks, Star Battle per-cell drag taps; star stays the firmer
  thud, Colin agreed), the **calmer screens** redesign (Library, pick-a-pack, one pack, Packs tab as blocks, Import as
  blocks; approved mockup `docs/design/calmer_screens_mockup.html`), Killer/Thermo no longer "coming soon", and the
  header frost fades lower (not at the smile). Build log 2026-10-23.
- **Next on pick-up:** backlog "Next", the 10/23 block at the top: **A. talk about the app's structure first**
  (Packs vs Library is confusing), then Shikaku (Patches-style), Nonogram 15×15 with zoom, Stats tab, the Killer hint-speed check.
- Older detail below (10/22) still holds.

### Earlier: save point 2026-10-22, evening
- **Live on Colin's phone** (app `C:\dev\SolveBuddyApp`, iOS build on runtime 513e3eaf…; pages from GitHub Pages):
  4 tabs (Library · Packs · Stats · Import), 4 games: Star Battle (Single 8×8 Easy 10 + Expert 10, Double 10×10
  Expert 10, Triple 12×12 Hard 10), Sudoku (Easy/Medium/Hard/Expert 10 each + 6 Trick tests; Killer Easy 5 + Expert 5; Thermo Easy 5 + Expert 1), Water Sort
  (30 levels), Block Drop (endless). Import tab: Star Battle any size 5–12 with 1–3 stars, Sudoku 9×9, Water Sort
  4–18 tubes; build one by hand, or Colin sends a screenshot to Claude in chat and Claude adds it to
  `packs/imports.json` (4 Star Battles added 10/22, read with `scripts/read_starbattle_screenshot.py`: thick-line reading +
  "exactly one answer" check).
- **App backup:** `C:\dev\SolveBuddyApp` pushes to the private repo `colinchia2/SolveBuddyApp` (since 10/22).
- **This chat is closing.** From now on Colin uses ONE agent for all Buddy apps ("pick up Buddy Family work"):
  `Buddies\00 Family\00_PRIMER.md`, section "How Colin works from now on".
- **Next (backlog top):** in-app photo reading (needs a small server, likely a Cloudflare Worker since SolveBuddy
  never uses PythonAnywhere, + a SolveBuddy Anthropic key Colin makes; ~1–3¢ a photo); deeper 3-star "What if" so a real Expert Triple pack is possible; Sudoku variants;
  after-puzzle review; new games (Binairo, Shikaku, Five Letters, Groups).
- **Open questions:** none waiting. **Colin is playing for a few days (from 10/22) and will come back with comments**:
  start by asking for them, then work through them one at a time. Next steps otherwise: backlog "Next".
- **To pick up, read:**
  1. This section, then "Key rules" and "How to ship" below.
  2. `../02 Log & Backlog/06_BUILD_LOG.md`: the 10/22 entries.
  3. `../02 Log & Backlog/08_BACKLOG.md`: "Next".
  4. Code map: `web/` (pages; `bridge.js` = GAMES, saves, haptics, imports), `engine/<game>/` (rules, hints,
     makers), `checks/run_all.ts` + `checks/pages_smoke.mjs` (hidden-browser page test).

## How to ship (SolveBuddy)
1. `node scripts/build_site.ts`, `node checks/run_all.ts` (all PASS), and with `node web/server.ts` running,
   `node checks/pages_smoke.mjs` (hidden Chrome, no tabs; Colin asked not to drive his Chrome).
2. `git push` = pages live on GitHub Pages; the phone gets them after open, ~15s, quit, reopen twice.
3. Only if the app shell changed (or to refresh the packed starting copy): in `C:\dev\SolveBuddyApp`,
   `node scripts/pull-pages.mjs`, bundle check (`npx expo export --platform ios`), fingerprint must still be
   513e3eaf… (`npx expo-updates fingerprint:generate --platform ios`), then
   `npx eas-cli update --channel production --environment production --message "…" --non-interactive`.
   Never an EAS build without Colin's explicit go.

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
- `node scripts/step4_make_easy.ts` / `node scripts/starbattle_make_easy.ts` remake the Easy packs (overwrites).
- **Test page:** `node web/server.ts`, then open http://localhost:4321. Plays both packs with real hints.
  It runs the real engine in the browser (the server strips the TypeScript types). Shared styles live in
  `web/common.css`. Settings are remembered in the browser under `solvebuddy.settings`.
- `npm run checks`: 21 free checks (rules, one answer, grades, hints solve every pack puzzle, mistakes first).

## Gotchas already hit
- **Never bulk-edit files with PowerShell `Get-Content`/`Set-Content`.** It read UTF-8 as the wrong encoding and
  garbled every ×, · and →. Use the Edit tool, or Python reading/writing bytes as UTF-8.
- Browser test tools drag in one jump, and so can a fast finger. Drag code must fill in the cells in between.
- The answer-counter must reject a puzzle that already breaks a rule. Otherwise a full but wrong grid counts as
  "1 answer". It's fixed and covered by a check.
