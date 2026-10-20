// Make a full grid, then erase as much as possible while keeping exactly one answer.
// Run: node scripts/step2_erase.ts
import { makeFullGrid, type Grid } from "../engine/sudoku/fullGrid.ts";
import { erase } from "../engine/sudoku/erase.ts";
import { countSolutions } from "../engine/sudoku/countSolutions.ts";

function show(grid: Grid) {
  grid.forEach((row, r) => {
    if (r > 0 && r % 3 === 0) console.log("------+-------+------");
    const cells = row.map((n) => (n === 0 ? "." : String(n)));
    console.log([cells.slice(0, 3), cells.slice(3, 6), cells.slice(6, 9)].map((p) => p.join(" ")).join(" | "));
  });
}

const solution = makeFullGrid();
const { puzzle, kept, putBack } = erase(solution, 0);
show(puzzle);
const clues = puzzle.flat().filter((n) => n !== 0).length;
console.log(`\nNumbers left: ${clues} of 81`);
console.log(`Erases kept: ${kept}   Put back (would allow 2+ answers): ${putBack}`);
console.log(`Answers the checker finds: ${countSolutions(puzzle)}`);
