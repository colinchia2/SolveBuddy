// Step 3 of making a Sudoku: solve it like a person would, using the tricks in techniques.ts.
// The grade is the easiest set of tricks that finishes it: Easy, then Medium (adds Pointing).
import { type Grid } from "./fullGrid.ts";
import { nextStep, applyStep, type Step, type RuledOut, EASY_TECHNIQUES, MEDIUM_TECHNIQUES } from "./techniques.ts";

export type Level = "Easy" | "Medium" | "Harder than Medium";

export type Grade = {
  level: Level;
  steps: Step[]; // every move, in order, using the tricks of that level
  stuckWith: number; // empty cells left when the tricks ran out (0 = solved)
};

export function solveWith(puzzle: Grid, techniques = MEDIUM_TECHNIQUES) {
  const grid = puzzle.map((row) => [...row]);
  const out: RuledOut = new Set();
  const steps: Step[] = [];
  let step: Step | null;
  while ((step = nextStep(grid, out, techniques))) {
    applyStep(grid, out, step);
    steps.push(step);
  }
  return { steps, stuckWith: grid.flat().filter((n) => n === 0).length };
}

export function grade(puzzle: Grid): Grade {
  const easy = solveWith(puzzle, EASY_TECHNIQUES);
  if (!easy.stuckWith) return { level: "Easy", ...easy };
  const medium = solveWith(puzzle, MEDIUM_TECHNIQUES);
  return { level: medium.stuckWith ? "Harder than Medium" : "Medium", ...medium };
}
