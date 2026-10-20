// Make one complete Sudoku grid and print it.  Run: node scripts/step1_full_grid.ts
import { makeFullGrid, isValidSolution } from "../engine/sudoku/fullGrid.ts";

const grid = makeFullGrid();
grid.forEach((row, r) => {
  if (r > 0 && r % 3 === 0) console.log("------+-------+------");
  const parts = [row.slice(0, 3), row.slice(3, 6), row.slice(6, 9)].map((p) => p.join(" "));
  console.log(parts.join(" | "));
});
console.log(`\nFollows every rule: ${isValidSolution(grid) ? "yes" : "NO"}`);
