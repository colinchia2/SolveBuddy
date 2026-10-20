// Free checks. Run before every push: npm run checks
import { makeFullGrid, isValidSolution } from "../engine/sudoku/fullGrid.ts";
import { countSolutions } from "../engine/sudoku/countSolutions.ts";
import { erase } from "../engine/sudoku/erase.ts";
import { grade } from "../engine/sudoku/grade.ts";
import { makeEasy } from "../engine/sudoku/makePuzzle.ts";
import { existsSync, readFileSync } from "node:fs";

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed++;
}

// A broken grid must be caught, or the check below proves nothing.
const broken = makeFullGrid();
[broken[0][0], broken[0][1]] = [broken[0][1], broken[0][0]];
check("validity test catches a broken grid", !isValidSolution(broken));

const grids = Array.from({ length: 200 }, makeFullGrid);
check("200 full Sudoku grids all follow the rules", grids.every(isValidSolution));
check("grids are random (no two of 200 alike)", new Set(grids.map((g) => g.join())).size === 200);

// The checker must tell 1 answer from 2+, or erasing can't be trusted.
const empty = Array.from({ length: 9 }, () => Array(9).fill(0));
check("checker: an empty grid has 2+ answers", countSolutions(empty) === 2);
check("checker: a full grid has exactly 1 answer", countSolutions(grids[0]) === 1);
const clash = grids[0].map((r) => [...r]);
clash[0][0] = clash[0][1]; // same number twice in a row
check("checker: a rule-breaking grid has 0 answers", countSolutions(clash) === 0);

const erased = Array.from({ length: 10 }, () => {
  const solution = makeFullGrid();
  const { puzzle } = erase(solution, 0);
  const keepsGivens = puzzle.every((row, r) => row.every((n, c) => n === 0 || n === solution[r][c]));
  return keepsGivens && countSolutions(puzzle) === 1;
});
check("10 erased puzzles each have exactly one answer", erased.every(Boolean));

// Every move the tricks make must match the real answer, or a hint could be wrong.
const graded = Array.from({ length: 20 }, () => {
  const solution = makeFullGrid();
  const g = grade(erase(solution, 30).puzzle);
  return g.steps.every((s) => solution[s.row][s.col] === s.value);
});
check("grader: every trick move in 20 puzzles matches the answer", graded.every(Boolean));
const oneHole = grids[1].map((r) => [...r]);
oneHole[4][4] = 0;
check("grader: one missing number = Easy", grade(oneHole).level === "Easy");
check("grader: empty grid is not Easy", grade(empty).level !== "Easy");

// A puzzle is only good if it has one answer, that answer is the saved one, and the easy tricks solve it.
type Saved = { givens: number[][]; solution: number[][] };
function goodEasy(p: Saved) {
  const givensMatch = p.givens.every((row, r) => row.every((n, c) => n === 0 || n === p.solution[r][c]));
  return isValidSolution(p.solution) && givensMatch && countSolutions(p.givens) === 1 && grade(p.givens).level === "Easy";
}
check("maker: 10 new Easy puzzles are all good", Array.from({ length: 10 }, makeEasy).every(goodEasy));
const packFile = "packs/sudoku9-easy-starter.json";
if (existsSync(packFile)) {
  const pack = JSON.parse(readFileSync(packFile, "utf8"));
  check("saved pack: 5 puzzles, all good", pack.puzzles.length === 5 && pack.puzzles.every(goodEasy));
}

if (failed) process.exit(1);
