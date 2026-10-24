# SolveBuddy — project status

**As of 2026-10-24:** 5 games live (Nonogram added 10/23, inside the Star Battle page in the app until the next
app OTA). 10/24 round confirmed by Colin: Nonogram clue bar, stronger haptics, no "New"/"zoom" labels. Tapping the
Library tab again → Library home is pushed on the page side; the app side waits for Colin's OTA. Checks: run_all
48 PASS, pages_smoke 102 PASS.

---

**As of 2026-10-22 (evening):** a full phone app with 4 tabs and 4 games, shipping by git push + OTA.

- App: `C:\dev\SolveBuddyApp` (Expo SDK 56, native iOS 26 tabs, Liquid Glass back button, opening animation,
  haptics). Pages: `web/*` built into `_site/app/*.html` by `scripts/build_site.ts`, served by GitHub Pages.
- Games: Star Battle (any size 5–12, 1–3 stars; packs Single / Double / Triple), Sudoku (4 levels + trick tests),
  Water Sort (solver hints that say why), Block Drop (endless, Save piece, countdown, line-clear effects).
- Import tab: build by hand with an exactly-one-answer check, or screenshots added by Claude to `packs/imports.json`.
  In-app photo reading not built yet (needs a key + small server).
- Checks: `checks/run_all.ts` (46 PASS) + `checks/pages_smoke.mjs` (hidden browser).
- Family: follows `Buddies\00 Family\BUDDY_STANDARD.md` (logo, wink, opening, bar, sheets, haptics).

---

**As of 2026-10-20:** two games work end to end on a localhost test page. No app yet.

- Design canvas: https://claude.ai/artifact/X4xg7mJWsbHr38WbVCppqi (8 screens). Copies:
  `docs/02 Hand-off from Chat/design/solvebuddy/`.
- Engine (TypeScript, `engine/`): Sudoku 9×9 and Star Battle 8×8. Each makes puzzles, checks for exactly one
  answer, grades with human-style tricks (Easy only so far), and gives hints (mistakes first, then
  Nudge → Explain → Show me).
- Packs: `packs/sudoku9-easy-starter.json`, `packs/starbattle8-easy-starter.json` (5 Easy each).
- Test page: `node web/server.ts` → http://localhost:4321 (Sudoku and Star Battle, in-game settings, drag to ×).
- 21 free checks pass (`npm run checks`).
- Git: local only (no GitHub yet).
- Next: Expert Star Battle (harder tricks + 1 puzzle), then Expert Sudoku.
