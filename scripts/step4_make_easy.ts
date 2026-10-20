// Make 5 Easy 9×9 Sudokus, print them, and save them as a pack.
// Run: node scripts/step4_make_easy.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { type Grid } from "../engine/sudoku/fullGrid.ts";
import { makeEasy } from "../engine/sudoku/makePuzzle.ts";

function show(grid: Grid) {
  grid.forEach((row, r) => {
    if (r > 0 && r % 3 === 0) console.log("------+-------+------");
    const cells = row.map((n) => (n === 0 ? "." : String(n)));
    console.log([cells.slice(0, 3), cells.slice(3, 6), cells.slice(6, 9)].map((p) => p.join(" ")).join(" | "));
  });
}

const puzzles = Array.from({ length: 5 }, (_, i) => ({ id: `sudoku9-easy-${i + 1}`, ...makeEasy() }));
puzzles.forEach((p, i) => {
  console.log(`\nPuzzle ${i + 1}: ${p.clues} numbers showing · tricks: ${p.techniquesUsed.join(", ")}`);
  show(p.givens);
});

const pack = { id: "sudoku9-easy-starter", game: "sudoku", size: 9, difficulty: "Easy", puzzles };
mkdirSync("packs", { recursive: true });
writeFileSync("packs/sudoku9-easy-starter.json", JSON.stringify(pack, null, 1));
console.log("\nSaved to packs/sudoku9-easy-starter.json");
