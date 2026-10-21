// Make 1 Hard 9×9 Sudoku (needs Pairs at least twice) and save it as a pack, to try Pairs hints.
// Run: node scripts/sudoku_make_hard.ts
import { writeFileSync } from "node:fs";
import { makeLevel } from "../engine/sudoku/makePuzzle.ts";

const t0 = Date.now();
const p = makeLevel("Hard");
console.log(`${p.clues} numbers showing · tricks: ${p.techniquesUsed.join(", ")} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const pack = { id: "sudoku9-hard", game: "sudoku", size: 9, difficulty: "Hard", puzzles: [{ id: "sudoku9-hard-1", ...p }] };
writeFileSync("packs/sudoku9-hard.json", JSON.stringify(pack, null, 1));
console.log("Saved to packs/sudoku9-hard.json");