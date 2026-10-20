// Step 2 of making a Sudoku: erase numbers from a full grid, one at a time, in random order.
// After each erase, the checker counts answers. Still exactly one? Keep the erase. Otherwise put it back.
import { type Grid } from "./fullGrid.ts";
import { countSolutions } from "./countSolutions.ts";

export type EraseResult = { puzzle: Grid; kept: number; putBack: number };

// Stops once only `minClues` numbers are left (or every cell has been tried).
// `stillOk` is an extra test an erase must pass (e.g. "still Easy"); by default, any one-answer puzzle is fine.
export function erase(solution: Grid, minClues: number, stillOk: (p: Grid) => boolean = () => true): EraseResult {
  const puzzle = solution.map((row) => [...row]);
  const cells = shuffled(Array.from({ length: 81 }, (_, i) => i));
  let clues = 81;
  let putBack = 0;
  for (const cell of cells) {
    if (clues <= minClues) break;
    const row = Math.floor(cell / 9);
    const col = cell % 9;
    const saved = puzzle[row][col];
    puzzle[row][col] = 0;
    if (countSolutions(puzzle) === 1 && stillOk(puzzle)) {
      clues--;
    } else {
      puzzle[row][col] = saved; // two or more answers, or failed the extra test: put it back
      putBack++;
    }
  }
  return { puzzle, kept: 81 - clues, putBack };
}

function shuffled<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
