# SolveBuddy — project status

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
