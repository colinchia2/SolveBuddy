// Step 4: put steps 1–3 together to make one Easy 9×9 Sudoku.
// Fill a full grid, then erase down to EASY_CLUES numbers, keeping an erase only if
// the puzzle still has one answer AND the easy tricks can still solve it.
import { makeFullGrid, type Grid } from "./fullGrid.ts";
import { erase } from "./erase.ts";
import { grade } from "./grade.ts";

export const EASY_CLUES = 36; // numbers left showing; more = gentler start

export type Puzzle = { givens: Grid; solution: Grid; clues: number; techniquesUsed: string[] };

export function makeEasy(): Puzzle {
  const solution = makeFullGrid();
  const { puzzle } = erase(solution, EASY_CLUES, (p) => grade(p).level === "Easy");
  const used = new Set(grade(puzzle).steps.map((s) => s.technique));
  return {
    givens: puzzle,
    solution,
    clues: puzzle.flat().filter((n) => n !== 0).length,
    techniquesUsed: [...used],
  };
}
