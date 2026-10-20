// Free checks. Run before every push: npm run checks
import { makeFullGrid, isValidSolution } from "../engine/sudoku/fullGrid.ts";
import { countSolutions } from "../engine/sudoku/countSolutions.ts";
import { erase } from "../engine/sudoku/erase.ts";

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

if (failed) process.exit(1);
