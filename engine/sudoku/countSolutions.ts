// The checker: how many answers does this puzzle have? We only care about 0, 1, or "2 or more",
// so it stops counting at 2. It tries every possibility (no human tricks), so it is never wrong.
// found (optional) gets a copy of each answer, e.g. for an imported puzzle's solution (Colin, 10/22).
import { type Grid, fits } from "./fullGrid.ts";

export function countSolutions(puzzle: Grid, limit = 2, found: Grid[] = []): number {
  const grid = puzzle.map((row) => [...row]);
  let count = 0;

  // If the numbers already there break a rule, there are no answers.
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const n = grid[row][col];
      if (n === 0) continue;
      grid[row][col] = 0;
      const ok = fits(grid, row, col, n);
      grid[row][col] = n;
      if (!ok) return 0;
    }
  }

  function search(): void {
    // Pick the empty cell with the fewest possible numbers. Same answer, much faster.
    let best: { row: number; col: number; options: number[] } | null = null;
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] !== 0) continue;
        const options = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((n) => fits(grid, row, col, n));
        if (!best || options.length < best.options.length) best = { row, col, options };
      }
    }
    if (!best) {
      count++; // no empty cells left: one complete answer
      found.push(grid.map((row) => [...row]));
      return;
    }
    for (const n of best.options) {
      grid[best.row][best.col] = n;
      search();
      grid[best.row][best.col] = 0;
      if (count >= limit) return;
    }
  }

  search();
  return count;
}
