// Step 3 of making a Sudoku: solve it like a person would, using the tricks in techniques.ts.
// If the easy tricks alone finish it, it's Easy. If they get stuck, it needs harder tricks.
import { type Grid } from "./fullGrid.ts";
import { nextStep, type Step } from "./techniques.ts";

export type Grade = {
  level: "Easy" | "Harder than Easy";
  steps: Step[]; // every move, in order
  stuckWith: number; // empty cells left when the tricks ran out (0 = solved)
};

export function grade(puzzle: Grid): Grade {
  const grid = puzzle.map((row) => [...row]);
  const steps: Step[] = [];
  let step: Step | null;
  while ((step = nextStep(grid))) {
    grid[step.row][step.col] = step.value;
    steps.push(step);
  }
  const stuckWith = grid.flat().filter((n) => n === 0).length;
  return { level: stuckWith === 0 ? "Easy" : "Harder than Easy", steps, stuckWith };
}
