// Step 3 of making a Sudoku: solve it like a person would, using the tricks in techniques.ts.
// The grade is the easiest set of tricks that finishes it: Easy, then Medium (adds Pointing and Claiming), then Hard (adds Pairs and Hidden pairs), then Expert (adds X-wing).
import { type Grid } from "./fullGrid.ts";
import { nextStep, applyStep, type Step, type RuledOut, EASY_TECHNIQUES, MEDIUM_TECHNIQUES, HARD_TECHNIQUES, EXPERT_TECHNIQUES } from "./techniques.ts";

export type Level = "Easy" | "Medium" | "Hard" | "Expert" | "Too hard";

export type Grade = {
  level: Level;
  steps: Step[]; // every move, in order, using the tricks of that level
  stuckWith: number; // empty cells left when the tricks ran out (0 = solved)
};

export function solveWith(puzzle: Grid, techniques = EXPERT_TECHNIQUES) {
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
  if (!medium.stuckWith) return { level: "Medium", ...medium };
  const hard = solveWith(puzzle, HARD_TECHNIQUES);
  if (!hard.stuckWith) return { level: "Hard", ...hard };
  const expert = solveWith(puzzle, EXPERT_TECHNIQUES);
  return { level: expert.stuckWith ? "Too hard" : "Expert", ...expert };
}
