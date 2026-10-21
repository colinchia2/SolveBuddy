// Make 1 Medium 9×9 Sudoku (needs Pointing at least twice) and save it as a pack, to try Pointing hints.
// Run: node scripts/sudoku_make_medium.ts
import { writeFileSync } from "node:fs";
import { makeMedium } from "../engine/sudoku/makePuzzle.ts";

const t0 = Date.now();
const p = makeMedium();
console.log(`${p.clues} numbers showing · tricks: ${p.techniquesUsed.join(", ")} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const pack = { id: "sudoku9-medium", game: "sudoku", size: 9, difficulty: "Medium", puzzles: [{ id: "sudoku9-medium-1", ...p }] };
writeFileSync("packs/sudoku9-medium.json", JSON.stringify(pack, null, 1));
console.log("Saved to packs/sudoku9-medium.json");
